import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from '@/server/db'
import { saveMailConfig } from '@/server/mail/config'
import { dispatch, enqueue } from '@/server/mail/outbox'
import { setSender } from '@/server/mail/transport'
import { createBank } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { createInvoice, sendInvoice, setInvoiceStatus, type InvoiceInput } from '@/server/finance/invoices'
import { confirmPayment, recordPayment } from '@/server/finance/payments'
import { ensurePrepayment, sendPrepayment, uploadPrepaymentStamp, voidPrepayment } from '@/server/finance/prepayments'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { Sheet } from '@/server/pdf/kit'
import { renderPrepayment } from '@/server/pdf/prepayment'
import { createUser } from './helpers/actions'
import { makePdf } from './helpers/pdf'
import { pdfLinks, pdfPages, rasterize, squash } from './helpers/pdf-text'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
process.env.VORA_LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'vora-prepay-'))
const BASE = 'https://testserver'
let actor: number

const customer = (currency = 'IDR') => saveCustomer(actor, null, { name: 'PT Pelanggan Satu', email: 'billing@pelanggan.example', address: 'Jl. Contoh 1\nJakarta', taxId: '01.234.567.8-901.000', currency, termsDays: '14' })
const bank = (currency = 'IDR') => createBank(actor, { bankName: 'Bank Contoh', accountNumber: '1234567890', accountHolder: 'PT Satu Arah International', currency, branch: 'Tebet', swiftCode: '', notes: '' })
/** A plain invoice whose total is exactly `price` (no tax, no withholding, no discount). */
const invoiceFor = async (customerId: number, price: number | string, o: Partial<InvoiceInput> = {}) => createInvoice(actor, {
  customerId, issuedAt: '2026-10-05', dueAt: '2026-10-19', taxPercent: '0', withholdingPercent: '0', discount: '0', poNumber: 'PO-77', shipmentReference: 'JOB-9',
  serviceMode: 'Sea Import FCL', origin: 'Shanghai', destination: 'Jakarta', transportDocumentRef: 'BL-1', notes: '', items: `Ocean freight | 1 | ${price} | shipment`, bankAccountIds: [], ...o,
})
const row = async (invoiceId: number) => (await sql`select * from prepayment_receipts where invoice_id = ${invoiceId} order by id desc limit 1`)[0]
const rejects = async (p: Promise<unknown>, message: RegExp | string, status?: number) => {
  const e = await p.then(() => null, (x: Error & { status?: number }) => x)
  expect(e, 'expected a refusal').not.toBeNull()
  expect(e!.message).toMatch(message)
  if (status) expect(e!.status).toBe(status)
}
const sent: Array<{ to: string; subject: string; attachment?: string; content?: Uint8Array }> = []
async function smtp(...rules: string[]) {
  await saveMailConfig(sql, { host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
  for (const r of rules) await sql`update email_rules set enabled = true where key = ${r}`
}

beforeAll(async () => { actor = (await createUser('prepayment@example.invalid', 'admin')).id })
beforeEach(async () => {
  sent.length = 0
  setSender(async (_conf, to, subject, _html, attachment) => { sent.push({ to, subject, attachment: attachment?.filename, content: attachment?.content }) })
  await sql`truncate customers, bank_accounts, quotations, invoices, payments, receipts, document_verification_tokens, email_jobs, leads, mail_config restart identity cascade`
  await sql`update email_rules set enabled = false`
})

describe('a pre-payment receipt is made with every invoice', () => {
  it('as a draft with its own number, verification link, amount and currency', async () => {
    const cid = await customer()
    const id = await invoiceFor(cid, 3_000_000)
    const p = await row(id)
    const [c] = await sql`select public_code from customers where id = ${cid}`
    expect(p.number).toMatch(new RegExp(`^PPR-VORA-${c.publicCode}-202610-\\d{5}$`))
    expect(p).toMatchObject({ status: 'draft', currency: 'IDR', amountMinor: 3_000_000, stampRequired: false })
    const [t] = await sql`select revoked from document_verification_tokens where kind = 'prepayment' and document_id = ${p.id}`
    expect(t.revoked).toBe(false)
    expect((await sql`select count(*)::int as n from prepayment_receipts`)[0].n).toBe(1)
  })

  it('carries the invoice total after tax and withholding, not the subtotal', async () => {
    const id = await invoiceFor(await customer(), 10_000_000, { taxPercent: '11', withholdingPercent: '2' })
    const [inv] = await sql`select total_minor from invoices where id = ${id}`
    expect((await row(id)).amountMinor).toBe(inv.totalMinor)
  })

  it('needs an e-meterai above IDR 5,000,000 and in any foreign currency, never at or below the limit', async () => {
    const cid = await customer()
    const at = await row(await invoiceFor(cid, 5_000_000))
    const above = await row(await invoiceFor(cid, 5_000_001))
    expect(at.stampRequired).toBe(false); expect(above.stampRequired).toBe(true)
    const usd = await customer('USD')
    expect((await row(await invoiceFor(usd, '10'))).stampRequired).toBe(true)         // no exchange rate is assumed
  })

  it('is released when the invoice is issued: at once without a stamp, or waiting for the manual e-meterai', async () => {
    const cid = await customer()
    const small = await invoiceFor(cid, 1_000_000)
    const large = await invoiceFor(cid, 12_000_000)
    expect([(await row(small)).status, (await row(large)).status]).toEqual(['draft', 'draft'])
    await setInvoiceStatus(actor, small, 'issue'); await setInvoiceStatus(actor, large, 'issue')
    expect((await row(small)).status).toBe('issued')
    expect((await row(large)).status).toBe('pending_stamp')
  })

  it('is voided, and its QR link revoked, with the invoice', async () => {
    const id = await invoiceFor(await customer(), 12_000_000)
    await setInvoiceStatus(actor, id, 'issue')
    await setInvoiceStatus(actor, id, 'void')
    const p = await row(id)
    expect(p.status).toBe('void')
    expect((await sql`select revoked from document_verification_tokens where kind = 'prepayment' and document_id = ${p.id}`)[0].revoked).toBe(true)
  })

  it('can be made later for an invoice that has none, only while the invoice is unpaid, and only one at a time', async () => {
    const cid = await customer(); await bank()
    const id = await invoiceFor(cid, 12_000_000, { bankAccountIds: [] })
    await setInvoiceStatus(actor, id, 'issue')
    await rejects(ensurePrepayment(actor, id), 'already has a pre-payment receipt', 409)
    await sql`delete from document_verification_tokens where kind = 'prepayment'`; await sql`delete from prepayment_receipts`      // an invoice from before the feature
    const made = await ensurePrepayment(actor, id)
    expect((await row(id))).toMatchObject({ id: made, status: 'pending_stamp', stampRequired: true, amountMinor: 12_000_000 })
    await voidPrepayment(actor, made)
    expect((await row(id)).status).toBe('void')
    const again = await ensurePrepayment(actor, id)                                                      // a voided one can be replaced
    expect(again).not.toBe(made)
    // A paid invoice needs no pre-payment receipt.
    await sql`update prepayment_receipts set status = 'void'`
    await sql`update invoices set status = 'paid', outstanding_minor = 0 where id = ${id}`
    await rejects(ensurePrepayment(actor, id), 'unpaid', 409)
    await rejects(ensurePrepayment(actor, 999_999), 'Invoice not found', 404)
  })
})

describe('the manual e-meterai', () => {
  it('is uploaded as a stamped PDF that keeps both numbers; the stored file is what is served from then on', async () => {
    const id = await invoiceFor(await customer(), 12_000_000)
    await setInvoiceStatus(actor, id, 'issue')
    const p = await row(id)
    const [inv] = await sql`select number from invoices where id = ${id}`
    const draft = await renderDocumentPdf(sql, 'prepayment', p.id as number, BASE)
    expect(Buffer.from(draft.subarray(0, 5)).toString()).toBe('%PDF-')

    const stamp = (o: Partial<{ providerReference: string; reviewed: boolean; file: Uint8Array | null }> = {}) => uploadPrepaymentStamp(actor, p.id as number, { providerReference: 'PERURI-0001', reviewed: true, file: null, ...o })
    await rejects(stamp(), /all required/)
    await rejects(stamp({ providerReference: 'x', file: await makePdf([p.number as string, inv.number as string]) }), /all required/)
    await rejects(stamp({ reviewed: false, file: await makePdf([p.number as string, inv.number as string]) }), /all required/)
    await rejects(stamp({ file: await makePdf(['unrelated']) }), /must retain VORA receipt/)
    const stamped = await makePdf([p.number as string, inv.number as string, 'E-METERAI 10000'])
    await stamp({ file: stamped })
    const after = await row(id)
    expect(after).toMatchObject({ status: 'issued', stampProviderReference: 'PERURI-0001' })
    expect(after.stampSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(Buffer.from(await renderDocumentPdf(sql, 'prepayment', p.id as number, BASE)).equals(Buffer.from(stamped))).toBe(true)
    await rejects(stamp({ file: stamped }), /not waiting for a manual e-meterai/, 409)           // once only
  })

  it('is refused for a receipt that needs none, and for one whose invoice is not issued yet', async () => {
    const cid = await customer()
    const small = await row(await invoiceFor(cid, 1_000_000))
    const draftLarge = await row(await invoiceFor(cid, 12_000_000))
    for (const p of [small, draftLarge]) await rejects(uploadPrepaymentStamp(actor, p.id as number, { providerReference: 'PERURI-0001', reviewed: true, file: await makePdf(['x']) }), /not waiting for a manual e-meterai/, 409)
  })

  it('never serves a stored file whose fingerprint no longer matches', async () => {
    const id = await invoiceFor(await customer(), 12_000_000)
    await setInvoiceStatus(actor, id, 'issue')
    const p = await row(id); const [inv] = await sql`select number from invoices where id = ${id}`
    await uploadPrepaymentStamp(actor, p.id as number, { providerReference: 'PERURI-0002', reviewed: true, file: await makePdf([p.number as string, inv.number as string]) })
    await sql`update prepayment_receipts set stamp_sha256 = ${'0'.repeat(64)} where id = ${p.id}`
    await rejects(renderDocumentPdf(sql, 'prepayment', p.id as number, BASE), /integrity check/, 409)
  })
})

describe('the pre-payment receipt PDF', () => {
  it('is one English page: payer, invoice, amount, wording that it is not proof of payment, bank, QR link; no signature block', async () => {
    const cid = await customer(); await bank()
    const id = await invoiceFor(cid, 12_500_000, { bankAccountIds: [(await sql`select id from bank_accounts limit 1`)[0].id as number] })
    await setInvoiceStatus(actor, id, 'issue')
    const p = await row(id); const [inv] = await sql`select number from invoices where id = ${id}`
    const pdf = await renderDocumentPdf(sql, 'prepayment', p.id as number, BASE)
    const pages = await pdfPages(pdf)
    expect(pages).toHaveLength(1)
    const text = squash(pages[0])
    for (const part of ['PRE-PAYMENT RECEIPT', p.number as string, inv.number as string, 'PT Pelanggan Satu', 'IDR 12,500,000', 'Twelve Million Five Hundred Thousand Indonesian Rupiah',
      'It is NOT proof that payment has been made', 'official VORA payment receipt', 'Bank Contoh', '1234567890', 'PENDING E-METERAI', 'E-METERAI HERE',
      'because the amount is above IDR 5,000,000', 'PRE-PAYMENT RECEIPT / PAGE 01 OF 01', 'PO-77', 'JOB-9']) expect(text, part).toContain(part)
    // It is a receipt that travels with the invoice, not something anyone approves: no signature area, and the whole document is English.
    for (const absent of ['SIGNATURE', 'AUTHORISED', 'POSITION', 'kwitansi', 'terbilang', 'sejumlah', 'pembayaran', 'diterima']) expect(text, absent).not.toContain(absent)
    const [token] = (await sql`select token from document_verification_tokens where kind = 'prepayment' and document_id = ${p.id}`).map((r) => r.token as string)
    expect((await pdfLinks(pdf)).flat()).toContain(`${BASE}/verify/${token}`)
  })

  it('reserves a square (1:1) dashed box for the e-meterai, as tall as the amount block and level with it, and only when one is required', async () => {
    const cid = await customer()
    type Box = [number, number, number, number]
    const draw = async (invoice: number) => {
      const dashed: Box[] = []; const solid: Box[] = []; const texts: Array<[number, string]> = []
      const outline = vi.spyOn(Sheet.prototype, 'outline').mockImplementation(function (this: Sheet, x, y, w, h, _stroke, _thickness, dash) { if (dash) dashed.push([x, y, w, h]) })
      const round = vi.spyOn(Sheet.prototype, 'roundRect').mockImplementation(function (this: Sheet, x, y, w, h) { solid.push([x, y, w, h]) })
      const text = vi.spyOn(Sheet.prototype, 'text').mockImplementation(function (this: Sheet, _x, y, value) { texts.push([y, String(value)]) })
      try { await renderDocumentPdf(sql, 'prepayment', (await row(invoice)).id as number, BASE) } finally { outline.mockRestore(); round.mockRestore(); text.mockRestore() }
      return { dashed, amount: solid[0], words: texts.find(([, t]) => /(Rupiah|Cents|Dollars|Euros|Yen)$/.test(t)) }
    }
    // IDR above the limit: the square runs from the top of the amount box to the bottom of the amount in words.
    const a = await draw(await invoiceFor(cid, 12_000_000))
    expect(a.dashed).toHaveLength(1)
    const [x, y, w, h] = a.dashed[0]
    expect(w).toBe(h)
    expect(w).toBeGreaterThanOrEqual(76); expect(w).toBeLessThanOrEqual(84)                                // about 2.8 cm
    expect(x + w).toBeCloseTo(595.28 - 44, 1)                                                              // against the right margin
    expect(y + h).toBeCloseTo(a.amount[1] + a.amount[3], 1)                                                // level with the top of the amount box
    expect(a.amount[0] + a.amount[2]).toBeLessThan(x)                                                      // the amount box gives up that width
    expect(Math.abs(y - (a.words![0] - 3))).toBeLessThanOrEqual(2.5)                                       // and ends with the amount in words (its baseline less the descenders)
    // A foreign currency is written out too, so its block is built exactly the same way.
    const usd = await draw(await invoiceFor(await customer('USD'), '100'))
    expect(usd.words![1]).toBe('One Hundred US Dollars')
    expect(usd.dashed[0][3]).toBe(w); expect(usd.amount[3]).toBe(a.amount[3])
    expect(Math.abs(usd.dashed[0][1] - (usd.words![0] - 3))).toBeLessThanOrEqual(2.5)
    // Only an amount too large to write out leaves the amount box to fill the height of the block alone.
    const tall: Box[] = []; const boxes: Box[] = []
    const o = vi.spyOn(Sheet.prototype, 'outline').mockImplementation(function (this: Sheet, x, y, bw, bh, _s, _t, dash) { if (dash) tall.push([x, y, bw, bh]) })
    const r = vi.spyOn(Sheet.prototype, 'roundRect').mockImplementation(function (this: Sheet, x, y, bw, bh) { boxes.push([x, y, bw, bh]) })
    try {
      await renderPrepayment({ number: 'PPR-X', status: 'pending_stamp', stampRequired: true, issuedOn: '2026-10-30', currency: 'IDR', amountMinor: 2_000_000_000_000_000,
        invoice: { number: 'INV-X', issuedAt: '2026-10-30', dueAt: '2026-11-30', poNumber: '', shipmentReference: '' }, payer: { name: 'X', address: '', email: '', taxId: '' }, banks: [] },
      { legalName: 'PT Satu Arah International', address: '', email: 'info@voraworld.id', taxId: '' }, `${BASE}/verify/x`)
    } finally { o.mockRestore(); r.mockRestore() }
    expect(boxes[0][3]).toBe(tall[0][3]); expect(boxes[0][1] + boxes[0][3]).toBeCloseTo(tall[0][1] + tall[0][3], 1)
    // Up to the limit there is no placeholder, and the amount box has the full width again.
    const none = await draw(await invoiceFor(cid, 5_000_000))
    expect(none.dashed).toEqual([])
    expect(none.amount[2]).toBeCloseTo(595.28 - 88, 1)
    expect(none.amount[2]).toBeGreaterThan(a.amount[2] + w)
  })

  it('says no e-meterai is needed at or below the limit, and shows no empty stamp box', async () => {
    const id = await invoiceFor(await customer(), 5_000_000)
    await setInvoiceStatus(actor, id, 'issue')
    const text = squash((await pdfPages(await renderDocumentPdf(sql, 'prepayment', (await row(id)).id as number, BASE))).join(' '))
    expect(text).toContain('No e-meterai is required: the amount does not exceed IDR 5,000,000.')
    expect(text).not.toContain('E-METERAI HERE'); expect(text).toContain('ISSUED')
  })

  it('writes a foreign-currency amount out in that currency, and shows DRAFT before the invoice is issued', async () => {
    const id = await invoiceFor(await customer('USD'), '1234.56')
    const text = squash((await pdfPages(await renderDocumentPdf(sql, 'prepayment', (await row(id)).id as number, BASE))).join(' '))
    expect(text).toContain('USD 1,234.56'); expect(text).toContain('DRAFT'); expect(text).toContain('because the amount is in a foreign currency')
    expect(text).toContain('AMOUNT IN WORDS'); expect(text).toContain('One Thousand Two Hundred Thirty-Four US Dollars and Fifty-Six Cents')
    expect(text).not.toContain('Indonesian Rupiah')
  })

  it('ends in the company red like every other document', async () => {
    const id = await invoiceFor(await customer(), 12_000_000)
    const pdf = await renderDocumentPdf(sql, 'prepayment', (await row(id)).id as number, BASE)
    const img = rasterize(pdf, 1)
    if (!img) return
    const [r, g, b] = img.at(300, img.height - 2)
    expect(Math.abs(r - 180) <= 6 && Math.abs(g - 62) <= 6 && Math.abs(b - 49) <= 6).toBe(true)
  })

  it('stays on one page for a long customer name, a long address and many bank accounts', async () => {
    const cid = await saveCustomer(actor, null, { name: 'PT Perusahaan Pelayaran dan Logistik Nusantara Raya Bersama Sejahtera Abadi Makmur Tbk', email: 'a@b.example', address: 'Jalan Panjang Sekali Nomor 123, Kawasan Industri Terpadu, Blok C-12, Cikarang Barat, Kabupaten Bekasi, Jawa Barat 17530', taxId: '', currency: 'IDR', termsDays: '14' })
    const banks = []
    for (let i = 0; i < 5; i++) banks.push(await createBank(actor, { bankName: `Bank Nomor ${i + 1}`, accountNumber: `99000${i}`, accountHolder: 'PT Satu Arah International', currency: 'IDR', branch: '', swiftCode: '', notes: '' }))
    const id = await invoiceFor(cid, 12_000_000, { bankAccountIds: banks })
    const text = squash((await pdfPages(await renderDocumentPdf(sql, 'prepayment', (await row(id)).id as number, BASE))).join(' '))
    expect(text).toContain('Bank Nomor 1'); expect(text).toContain('Bank Nomor 3'); expect(text).toContain('2 more account(s) are listed on the invoice.')
  })
})

describe('emailing the pre-payment receipt', () => {
  it('travels with the invoice when released and its rule is on; the stamped file is what is attached', async () => {
    const cid = await customer()
    const id = await invoiceFor(cid, 12_000_000)
    await setInvoiceStatus(actor, id, 'issue')
    const p = await row(id); const [inv] = await sql`select number from invoices where id = ${id}`
    await smtp('invoice_customer', 'prepayment_receipt_customer')
    // Waiting for its e-meterai: only the invoice goes.
    await sendInvoice(actor, id, BASE)
    await dispatch(BASE, 10)
    expect(sent.map((s) => s.attachment)).toEqual([`${inv.number}.pdf`])
    await rejects(sendPrepayment(actor, p.id as number, BASE), /upload the stamped PDF first/, 409)

    const stamped = await makePdf([p.number as string, inv.number as string, 'stamped'])
    await uploadPrepaymentStamp(actor, p.id as number, { providerReference: 'PERURI-0003', reviewed: true, file: stamped })
    sent.length = 0
    await sql`delete from email_jobs`
    await sendInvoice(actor, id, BASE)
    await dispatch(BASE, 10)
    expect(sent.map((s) => s.attachment).sort()).toEqual([`${inv.number}.pdf`, `${p.number}.pdf`].sort())
    const mail = sent.find((s) => s.attachment === `${p.number}.pdf`)!
    expect(mail.subject).toBe(`VORA pre-payment receipt ${p.number}`)
    expect(Buffer.from(mail.content!).equals(Buffer.from(stamped))).toBe(true)
    const [job] = await sql`select html from email_jobs where event = 'prepayment_receipt_customer'`
    expect(job.html).toContain(inv.number as string); expect(job.html).toContain('not proof that payment has been made')
  })

  it('has its own button, needs SMTP and the rule, and sends once per minute', async () => {
    const id = await invoiceFor(await customer(), 1_000_000)
    const p = await row(id)
    await rejects(sendPrepayment(actor, p.id as number, BASE), /Only a released pre-payment receipt/, 409)       // still a draft
    await setInvoiceStatus(actor, id, 'issue')
    await rejects(sendPrepayment(actor, p.id as number, BASE), /Enable SMTP and the prepayment_receipt_customer email rule/, 409)
    await smtp('prepayment_receipt_customer')
    await sendPrepayment(actor, p.id as number, BASE); await sendPrepayment(actor, p.id as number, BASE)
    expect((await sql`select count(*)::int as n from email_jobs where event = 'prepayment_receipt_customer'`)[0].n).toBe(1)
    await dispatch(BASE, 10)
    expect(sent.map((s) => s.attachment)).toEqual([`${p.number}.pdf`])
    await sql`update customers set email = ''`
    await rejects(sendPrepayment(actor, p.id as number, BASE), /no billing email/)
  })

  it('never attaches a pre-payment receipt that is not released (draft, waiting for the e-meterai, void)', async () => {
    const cid = await customer()
    await smtp('prepayment_receipt_customer')
    const draft = await row(await invoiceFor(cid, 1_000_000))
    const waiting = await row(await (async () => { const i = await invoiceFor(cid, 12_000_000); await setInvoiceStatus(actor, i, 'issue'); return i })())
    const voided = await row(await (async () => { const i = await invoiceFor(cid, 1_000_000); await setInvoiceStatus(actor, i, 'issue'); await voidPrepayment(actor, (await row(i)).id as number); return i })())
    for (const p of [draft, waiting, voided]) {
      await enqueue(sql, 'prepayment_receipt_customer', 'billing@pelanggan.example', { customer_name: 'x', document_number: p.number, invoice_number: 'x', verify_url: 'x' }, { attachmentKind: 'prepayment', attachmentId: p.id as number, force: true })
    }
    await dispatch(BASE, 10)
    expect(sent).toHaveLength(0)
    expect((await sql`select status, error from email_jobs order by id`).map((j) => [j.status, j.error])).toEqual(Array(3).fill(['retry', 'Attachment is not eligible for sending']))
  })
})

describe('next to the payment receipt', () => {
  it('stays a separate document: confirming the payment still issues the official receipt, and the pre-payment receipt is untouched', async () => {
    const cid = await customer(); const b = await bank()
    const id = await invoiceFor(cid, 3_000_000, { bankAccountIds: [b] })
    await setInvoiceStatus(actor, id, 'issue')
    const before = await row(id)
    const paymentId = await recordPayment(actor, id, { amount: '3000000', date: '', method: 'bank transfer', reference: 'TRX-1', receivingBankId: b })
    await confirmPayment(actor, paymentId, { fundsCleared: true, receivingBankId: null }, BASE)
    expect((await sql`select count(*)::int as n from receipts`)[0].n).toBe(1)
    expect(await row(id)).toMatchObject({ id: before.id, number: before.number, status: 'issued' })
    expect((await sql`select number from receipts`)[0].number).toMatch(/^RCP-/)
  })
})
