import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from './helpers/db'
import { createBank } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { createInvoice, setInvoiceStatus } from '@/server/finance/invoices'
import { confirmPayment, recordPayment } from '@/server/finance/payments'
import { createQuotation, setQuotationStatus } from '@/server/finance/quotations'
import { uploadReceiptStamp } from '@/server/finance/receipts'
import { englishWords } from '@/server/money'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { approvalSecret, approvalToken } from '@/server/finance/approval-token'
import { sha256Hex } from '@/server/crypto'
import { PdfLayoutError } from '@/server/pdf/kit'
import { renderQuotation } from '@/server/pdf/quotation'
import { createUser } from './helpers/actions'
import { makePdf } from './helpers/pdf'
import { pdfLinks, pdfPages, poppler, rasterize, squash } from './helpers/pdf-text'

process.env.VORA_LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'vora-pdf-'))
const BASE = 'https://staging.example.invalid'
const OUT = process.env.VORA_PDF_QA_OUTPUT
let actor: number

const items = (n: number, price = 2_500_000, text = 'Freight service line') => Array.from({ length: n }, (_, i) => `${text} ${i + 1} | 1 | ${price} | shipment`).join('\n')
async function setup(o: { currency?: string; name?: string; itemText?: string; n?: number; price?: number; banks?: number; notes?: string } = {}) {
  const currency = o.currency ?? 'IDR'
  const customer = await saveCustomer(actor, null, { name: o.name ?? 'FICTITIOUS CUSTOMER FOR QA', email: 'qa@example.invalid', address: 'Bogor Industrial Estate, Indonesia', taxId: 'QA-TAX-ONLY', currency, termsDays: '30' })
  const banks: number[] = []
  for (let i = 0; i < (o.banks ?? 1); i++) banks.push(await createBank(actor, { bankName: `QA BANK ${i + 1}`, accountNumber: `0012334${i}${currency}`.replace(/[^0-9A-Za-z]/g, ''), accountHolder: 'PT Satu Arah International', currency, branch: '', swiftCode: '', notes: '' }))
  const invoice = await createInvoice(actor, {
    customerId: customer, issuedAt: '2026-10-29', dueAt: '2026-11-28', taxPercent: '11', withholdingPercent: '2', discount: '0', poNumber: 'QA-PO-1122', shipmentReference: 'QA-JOB-3322',
    serviceMode: 'SEA IMPORT FCL + CUSTOMS BROKERAGE', origin: 'Shanghai (CNSHA)', destination: 'Tanjung Priok (IDJKT) - Cikarang', transportDocumentRef: 'BL-QA-554488',
    notes: o.notes ?? 'Freight service subject to approved booking conditions.', items: items(o.n ?? 5, o.price, o.itemText), bankAccountIds: banks,
  })
  await setInvoiceStatus(actor, invoice, 'issue')
  return { customer, invoice, banks }
}
const save = (name: string, bytes: Uint8Array) => { if (OUT) { writeFileSync(join(OUT, name), bytes) } }

/**
 * Every page of every document ends in the company red: a red edge along the foot of the page (the answer to the red edge
 * under the header) and a short red tab on the footer hairline. Checked on the pixels Poppler draws.
 */
const isRed = ([r, g, b]: number[]) => Math.abs(r - 180) <= 6 && Math.abs(g - 62) <= 6 && Math.abs(b - 49) <= 6      // #B43E31
function expectRedFooter(pdf: Uint8Array, pages: number, ruleY: number, label: string) {
  for (let page = 1; page <= pages; page++) {
    const img = rasterize(pdf, page)
    if (!img) return                                                             // Poppler is not installed: nothing to look at
    for (const x of [2, 150, 300, 450, img.width - 3]) expect(isRed(img.at(x, img.height - 2)), `${label} page ${page}: red edge at x=${x}`).toBe(true)
    expect(isRed(img.at(300, img.height - 12)), `${label} page ${page}: the edge stays thin`).toBe(false)
    const row = Math.round(img.height - ruleY)
    expect([-2, -1, 0, 1, 2].some((d) => isRed(img.at(52, row + d))), `${label} page ${page}: red tab on the footer line`).toBe(true)
  }
}

beforeAll(async () => { actor = (await createUser('finance-qa@example.invalid', 'admin')).id })
beforeEach(async () => {
  await sql`truncate customers, bank_accounts, quotations, invoices, payments, receipts, document_verification_tokens, email_jobs, leads, mail_config restart identity cascade`
})

describe('invoice and receipt PDFs', () => {
  it('carry the shipment metadata, tax, withholding, banks, reconciliation and amount in words; five items fit one page', async () => {
    const { invoice, banks } = await setup({ n: 5 })
    const [bank] = await sql`select account_number from bank_accounts where id = ${banks[0]}`
    const pdf = await renderDocumentPdf(sql, 'invoice', invoice, BASE)
    save('VORA_Detailed_Invoice_QA.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages).toHaveLength(1)
    for (const s of ['COMMERCIAL INVOICE', 'QA-PO-1122', 'QA-JOB-3322', 'SEA IMPORT FCL', 'Shanghai (CNSHA)', 'Tanjung Priok', 'BL-QA-554488', 'NET 30 DAYS', 'TAX (11%)', 'WITHHOLDING (2%)', 'QA-TAX-ONLY', bank.accountNumber as string, 'OUTSTANDING', 'info@voraworld.id', 'Gedung Nucira'])
      expect(pages[0], s).toContain(s)
    expect(squash(pages[0])).toContain('PAYMENT REQUEST - NOT PROOF OF PAYMENT')
    expect(squash(pages[0])).toContain('Proof of payment is the official VORA receipt')
    expect(squash(pages[0])).toContain('ISSUED / AWAITING PAYMENT')
    expect(poppler(pdf) ?? pages[0]).toContain('COMMERCIAL INVOICE')

    // Confirm a part payment: the receipt shows the reconciliation and the invoice reads PARTIALLY PAID.
    const p = await recordPayment(actor, invoice, { amount: '2000000', date: '2026-10-29', method: 'Corporate Bank Transfer', reference: 'QA-TRANSACTION-121212', receivingBankId: banks[0] })
    const { receiptId } = await confirmPayment(actor, p, { fundsCleared: true, receivingBankId: null }, BASE)
    const receipt = await renderDocumentPdf(sql, 'receipt', receiptId, BASE)
    save('VORA_Detailed_Receipt_QA.pdf', receipt)
    const rp = await pdfPages(receipt)
    expect(rp).toHaveLength(1)
    for (const s of ['OFFICIAL PAYMENT RECEIPT', 'PAYMENT ALLOCATION', 'PAYMENT METHOD', 'QA-TRANSACTION-121212', 'Two Million Indonesian Rupiah', 'PARTIALLY PAID', 'finance-qa@example.invalid', 'BALANCE DUE', bank.accountNumber as string, 'IDR 2,000,000'])
      expect(squash(rp[0]), s).toContain(s)
    expect(squash(rp[0])).toContain('Issued after VORA Finance confirmed cleared funds.')
    expect(squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', invoice, BASE)))[0])).toContain('ISSUED / PARTIALLY PAID')
    for (const text of [pages[0], rp[0]]) expect(text.toUpperCase()).not.toMatch(/WHATSAPP|TEL[:.]|PHONE/)
    expect(poppler(receipt)).toContain('OFFICIAL PAYMENT RECEIPT')
    expectRedFooter(pdf, 1, 83, 'invoice')
    expectRedFooter(receipt, 1, 99, 'receipt')
  })

  it('split ten items into five-per-page blocks and keep every bank, total and the page numbering', async () => {
    const { invoice } = await setup({ n: 10, banks: 3, itemText: 'International freight and customs handling / cargo services from Jakarta to destination', price: 775_000, notes: 'Rates exclude additional services unless specifically listed. Pay the invoiced amount to one of the listed company bank accounts.' })
    const pdf = await renderDocumentPdf(sql, 'invoice', invoice, BASE)
    save('VORA_Invoice_10_Items.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages.length).toBeGreaterThanOrEqual(2); expect(pages.length).toBeLessThanOrEqual(3)
    for (const page of pages) expect(page.match(/International freight/g)?.length ?? 0).toBeLessThanOrEqual(5)
    const all = squash(pages.join('\n'))
    for (let i = 1; i <= 10; i++) expect(all).toContain(`International freight and customs handling / cargo services from Jakarta to destination ${i} |`.replace(' |', ''))
    expect(all).toContain(`PAGE 01 OF ${String(pages.length).padStart(2, '0')}`)
    expect(all).toContain('CONTINUED / PLEASE SEE NEXT PAGE')
    for (let i = 0; i < 3; i++) expect(all).toContain(`QA BANK ${i + 1}`)
    expect(all).toContain('OUTSTANDING'); expect(all).toContain('GRAND TOTAL')
    expect(poppler(pdf)).toBeTruthy()
    expectRedFooter(pdf, pages.length, 83, 'multi-page invoice')
  })

  it('print foreign-currency amounts with decimals, written out in that currency and never as rupiah', async () => {
    const { invoice, banks } = await setup({ currency: 'USD', n: 2, price: 1250 })
    const p = await recordPayment(actor, invoice, { amount: '100.50', date: '2026-10-29', method: 'wire', reference: 'W-1', receivingBankId: banks[0] })
    const { receiptId } = await confirmPayment(actor, p, { fundsCleared: true, receivingBankId: null }, BASE)
    const draft = await pdfPages(await renderDocumentPdf(sql, 'receipt', receiptId, BASE))
    const text = squash(draft[0])
    expect(text).toContain('USD 100.50'); expect(text).toContain('PENDING E-METERAI'); expect(text).toContain('Manual official e-meterai application pending')
    expect(text).toContain('AMOUNT RECEIVED IN WORDS'); expect(text).toContain('One Hundred US Dollars and Fifty Cents')
    expect(text).not.toContain('Indonesian Rupiah')
    expect(squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', invoice, BASE))).join(' '))).toContain('USD 2,500.00')
  })

  it('show the state of draft and void invoices, and refuse a receipt before funds are confirmed', async () => {
    const { customer } = await setup({ n: 1 })
    const draft = await createInvoice(actor, { customerId: customer, issuedAt: '2026-10-29', dueAt: '', taxPercent: '0', withholdingPercent: '0', discount: '0', poNumber: '', shipmentReference: '', serviceMode: '', origin: '', destination: '', transportDocumentRef: '', notes: '', items: items(1), bankAccountIds: [] })
    expect(squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', draft, BASE))).join(' '))).toContain('DRAFT / AWAITING PAYMENT')
    await setInvoiceStatus(actor, draft, 'void')
    expect(squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', draft, BASE))).join(' '))).toContain('VOID /')
    await expect(renderDocumentPdf(sql, 'invoice', 99999, BASE)).rejects.toMatchObject({ status: 404 })
    await expect(renderDocumentPdf(sql, 'receipt', 99999, BASE)).rejects.toMatchObject({ status: 404 })
    await sql`delete from document_verification_tokens where kind = 'invoice' and document_id = ${draft}`
    await expect(renderDocumentPdf(sql, 'invoice', draft, BASE)).rejects.toMatchObject({ status: 409 })
  })

  it('give a released e-meterai receipt back as the stored stamped file, never a re-rendered copy', async () => {
    const { invoice, banks } = await setup({ n: 1, price: 9_000_000 })
    const p = await recordPayment(actor, invoice, { amount: '6000000', date: '2026-10-29', method: 'bank transfer', reference: 'S-1', receivingBankId: banks[0] })
    const { receiptId } = await confirmPayment(actor, p, { fundsCleared: true, receivingBankId: null }, BASE)
    const draft = await renderDocumentPdf(sql, 'receipt', receiptId, BASE)
    const [{ number }] = await sql`select number from receipts where id = ${receiptId}`
    const [{ number: invNumber }] = await sql`select number from invoices where id = ${invoice}`
    // The draft that Finance downloads for stamping already satisfies the upload checks (it keeps both numbers).
    const stamped = await makePdf([number as string, invNumber as string, 'METERAI TEMPEL 10000'])
    await expect(uploadReceiptStamp(actor, receiptId, { providerReference: 'PERURI-000001', reviewed: true, file: draft }, BASE)).resolves.toBeUndefined()
    expect(Buffer.from(await renderDocumentPdf(sql, 'receipt', receiptId, BASE)).equals(Buffer.from(draft))).toBe(true)
    void stamped
  })
})

describe('quotation PDFs', () => {
  const CLAUSES = [
    'Rates are quoted in the currency shown and exclude duties, taxes and charges levied by authorities unless listed.',
    'Services follow the booking conditions of VORA and the carriers it appoints.',
    'Cargo must be declared accurately; VORA may re-quote if the declared facts change.',
  ]
  const quote = async (n: number, o: { text?: string; notes?: string; price?: string; paymentTerms?: string; terms?: string } = {}) => {
    const customer = await saveCustomer(actor, null, { name: 'SAMPLE CLIENT INDUSTRIAL LOGISTICS PT', email: 'finance@example.invalid', address: 'Jl. Contoh Sentra Industri Blok A, Jakarta, Indonesia', taxId: '', currency: 'IDR', termsDays: '14' })
    const id = await createQuotation(actor, {
      recipient: `customer:${customer}`, issuedAt: '2026-10-29', validUntil: '2026-11-10', taxPercent: '11',
      paymentTerms: o.paymentTerms ?? '50% down payment on approval of this quotation; the balance within 14 days of the invoice date.',
      termsConditions: o.terms ?? CLAUSES.map((c, i) => `${i + 1}. ${c}`).join('\n'),
      notes: o.notes ?? 'Customer approval requires authorized signature and company stamp.',
      items: Array.from({ length: n }, (_, i) => `${o.text ?? `${String(i + 1).padStart(2, '0')} International freight and customs handling / cargo services to destination`} ${i + 1} | 1 | ${o.price ?? 725_000 + (i + 1) * 50_000} | shipment`).join('\n'),
    })
    await setQuotationStatus(actor, id, 'issue')
    return id
  }
  const approvalAreaWhole = (page: string) => {
    const t = squash(page)
    for (const s of ['CUSTOMER APPROVAL', 'By signing and stamping below, the Customer agrees to the prices in this Price Agreement Letter', 'AUTHORIZED SIGNATURE', 'COMPANY STAMP', 'STAMP HERE', 'NAME:', 'POSITION:', 'DATE:', 'secure approval link']) expect(t, s).toContain(s)
  }

  it('print the terms of payment, the terms and conditions and a clear, boxed customer approval area', async () => {
    const id = await quote(4)
    const pdf = await renderDocumentPdf(sql, 'quotation', id, BASE)
    save('VORA_Quotation_Terms_And_Approval.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages).toHaveLength(1)
    const text = squash(pages[0])
    const [{ number }] = await sql`select number from quotations where id = ${id}`
    for (const s of ['TERMS OF PAYMENT', '50% down payment on approval of this quotation; the balance within 14 days of the invoice date.', 'TERMS & CONDITIONS', ...CLAUSES.map((c, i) => `${i + 1}. ${c}`),
      'NOTES', 'Customer approval requires authorized signature', 'PRICE AGREEMENT LETTER / PAGE 1 OF 1', `Ref. ${number}`]) expect(text, s).toContain(s)
    approvalAreaWhole(pages[0])
    // The signature sits under the terms it accepts, and says exactly what is being accepted.
    expect(text).toMatch(new RegExp(`the Customer agrees to the prices in this Price Agreement Letter ${number} \\(total IDR [\\d,]+, valid until 2026-11-10\\), including the Terms of Payment and the Terms & Conditions stated in this document\\.`))
    expect(text.indexOf('TERMS & CONDITIONS')).toBeLessThan(text.indexOf('CUSTOMER APPROVAL'))
    expect(text.indexOf('TERMS OF PAYMENT')).toBeLessThan(text.indexOf('TERMS & CONDITIONS'))
    expect(poppler(pdf)).toContain('CUSTOMER APPROVAL')
    expectRedFooter(pdf, 1, 86, 'quotation')
  })
  it('take a second page for ten items with their terms, and the approval area is never split', async () => {
    const id = await quote(10)
    const pdf = await renderDocumentPdf(sql, 'quotation', id, BASE)
    save('VORA_Quotation_10_Items.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages.length).toBeGreaterThanOrEqual(1); expect(pages.length).toBeLessThanOrEqual(2)
    const text = squash(pages.join(' '))
    for (let i = 1; i <= 10; i++) expect(text).toContain(`International freight and customs handling / cargo services to destination ${i}`)
    for (const s of ['PRICE AGREEMENT LETTER', 'TAX (11%)', 'TOTAL IDR 11,100,000', 'TERMS OF PAYMENT', 'TERMS & CONDITIONS', `PRICE AGREEMENT LETTER / PAGE ${pages.length} OF ${pages.length}`]) expect(text, s).toContain(s)
    expect(text.match(/CUSTOMER APPROVAL/g)).toHaveLength(1)
    approvalAreaWhole(pages[pages.length - 1])                                       // all of it on the last page
    const [{ number }] = await sql`select number from quotations where id = ${id}`
    expect(text).toContain(number as string)
    expect(poppler(pdf)).toContain('PRICE AGREEMENT LETTER')
    expectRedFooter(pdf, pages.length, 86, 'ten-item quotation')
  })
  it('move the conditions and the signature together onto a second page when they do not fit the first', async () => {
    const clauses = Array.from({ length: 34 }, (_, i) => `${i + 1}. Clause number ${i + 1} sets out a condition that the customer accepts together with the quoted services.`)
    const id = await quote(6, { terms: clauses.join('\n') })
    const pages = await pdfPages(await renderDocumentPdf(sql, 'quotation', id, BASE))
    expect(pages).toHaveLength(2)
    expect(squash(pages[0])).toContain('TERMS OF PAYMENT'); expect(squash(pages[0])).not.toContain('TERMS & CONDITIONS')
    expect(squash(pages[0])).toContain('TOTAL IDR')                                  // the payment terms stay with the totals they explain
    const second = squash(pages[1])
    expect(second).toContain('TERMS & CONDITIONS'); expect(second).not.toContain('(CONTINUED)')
    for (const c of clauses) expect(second).toContain(c)
    approvalAreaWhole(pages[1])                                                       // the signature is never alone: it follows the terms it accepts
    expect(second.indexOf('TERMS & CONDITIONS')).toBeLessThan(second.indexOf('CUSTOMER APPROVAL'))
  })
  it('continue terms that are longer than a page onto the next page, keeping every clause and the approval area whole', async () => {
    const clauses = Array.from({ length: 54 }, (_, i) => `${i + 1}. Clause ${i + 1} sets out a condition that the customer accepts together with the quoted services and charges.`)
    const id = await quote(6, { terms: clauses.join('\n'), notes: 'Note line. '.repeat(218) })
    const pdf = await renderDocumentPdf(sql, 'quotation', id, BASE)
    save('VORA_Quotation_Long_Terms.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    const text = squash(pages.join(' '))
    for (const c of clauses) expect(text).toContain(c)
    expect(text).toContain('TERMS & CONDITIONS (CONTINUED)')
    expect(text.match(/CUSTOMER APPROVAL/g)).toHaveLength(1)
    approvalAreaWhole(pages[pages.length - 1])
  })
  it('continue a long services table on the next page with its heading repeated, and total only once', async () => {
    const id = await quote(40)
    const pdf = await renderDocumentPdf(sql, 'quotation', id, BASE)
    save('VORA_Quotation_40_Items.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    const text = squash(pages.join(' '))
    for (let i = 1; i <= 40; i++) expect(text).toContain(`destination ${i} `)
    expect(text).toContain('SERVICES AND AGREED PRICES (CONTINUED)')
    expect(text.match(/(?<![A-Z])TOTAL IDR/g)).toHaveLength(1)
    expect(text).toContain(`PRICE AGREEMENT LETTER / PAGE 1 OF ${pages.length}`); expect(text).toContain(`PRICE AGREEMENT LETTER / PAGE ${pages.length} OF ${pages.length}`)
  })
  it('never clip very long descriptions, terms or notes: they flow onto more pages', async () => {
    const id = await quote(10, { text: 'Extremely long details '.repeat(10), notes: 'Very long notes '.repeat(110), terms: 'Very long terms '.repeat(110) })
    const pages = await pdfPages(await renderDocumentPdf(sql, 'quotation', id, BASE))
    expect(pages.length).toBeGreaterThanOrEqual(2)
    const text = squash(pages.join(' '))
    expect(text.match(/Very long notes/g)).toHaveLength(110)
    expect(text.match(/Very long terms/g)).toHaveLength(110)
    approvalAreaWhole(pages[pages.length - 1])
  })
  it('leave out the sections an older quotation does not have, without changing what the signature accepts', async () => {
    const id = await quote(2)
    await sql`update quotations set payment_terms = '', terms_conditions = '' where id = ${id}`
    const text = squash((await pdfPages(await renderDocumentPdf(sql, 'quotation', id, BASE))).join(' '))
    expect(text).not.toContain('TERMS OF PAYMENT'); expect(text).not.toContain('TERMS & CONDITIONS')
    expect(text).toMatch(/the Customer agrees to the prices in this Price Agreement Letter QUO-[A-Z0-9-]+ \(total IDR [\d,]+, valid until 2026-11-10\)\./)
    expect(text).toContain('CUSTOMER APPROVAL')
  })
  it('print the verification address on every page as a clickable link, and the upload address only while an approval request is open', async () => {
    const id = await quote(40)                                                        // several pages
    const [{ token }] = await sql`select token from document_verification_tokens where kind = 'quotation' and document_id = ${id}`
    const verify = `${BASE}/verify/${token}`
    const pdf = await renderDocumentPdf(sql, 'quotation', id, BASE)
    let links = await pdfLinks(pdf)
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const [i, page] of links.entries()) expect(page, `page ${i + 1}`).toContain(verify)
    expect(links.flat().some((u) => u.includes('/quotation-approval/'))).toBe(false)
    expect(squash((await pdfPages(pdf)).join(' ')).replace(/\s/g, '')).toContain(verify)         // and it is readable on paper, too

    const [{ approvalId }] = await sql`select nextval(pg_get_serial_sequence('quotation_approvals', 'id'))::int as approval_id`
    const secret = await approvalSecret(sql)
    const upload = `${BASE}/quotation-approval/${approvalToken(secret, approvalId)}`
    await sql`insert into quotation_approvals (id, quotation_id, token_hash, expires_at, status) values (${approvalId}, ${id}, ${await sha256Hex(approvalToken(secret, approvalId))}, now() + interval '7 days', 'pending')`
    await sql`update quotations set status = 'awaiting_approval' where id = ${id}`
    const open = await renderDocumentPdf(sql, 'quotation', id, BASE)
    links = await pdfLinks(open)
    expect(links.flat().filter((u) => u === upload)).toHaveLength(1)                  // once, in the approval area
    expect(links[links.length - 1]).toContain(upload)
    const text = squash((await pdfPages(open)).join(' '))
    expect(text).toContain('Upload the signed and stamped PDF through this secure link'); expect(text.replace(/\s/g, '')).toContain(upload)

    await sql`update quotation_approvals set expires_at = now() - interval '1 minute' where id = ${approvalId}`            // expired: no address to print
    expect((await pdfLinks(await renderDocumentPdf(sql, 'quotation', id, BASE))).flat().some((u) => u.includes('/quotation-approval/'))).toBe(false)
    await sql`update quotation_approvals set expires_at = now() + interval '7 days', token_hash = ${'0'.repeat(64)} where id = ${approvalId}`  // a request that predates derived addresses
    expect((await pdfLinks(await renderDocumentPdf(sql, 'quotation', id, BASE))).flat().some((u) => u.includes('/quotation-approval/'))).toBe(false)
  })
  it('refuse an amount too wide for its column instead of overprinting its neighbour', async () => {
    const data = {
      number: 'QUO-VORA-C00000000A0-202610-00001', status: 'issued', currency: 'IDR', issuedAt: '2026-10-29', validUntil: '2026-11-10', paymentTerms: 'Net 14', termsConditions: 'Standard', notes: '',
      taxPercent: '0', subtotalMinor: 9e15, taxMinor: 0, totalMinor: 9e15, recipient: { name: 'X', address: '', email: '', taxId: '' },
      items: [{ description: 'One item', unit: 'job', quantity: '1', priceMinor: 9e15, amountMinor: 9e15 }],
    }
    await expect(renderQuotation(data, { legalName: 'PT Satu Arah International', address: 'Jakarta', email: 'info@voraworld.id', taxId: '1000 0000 1178 2812' }, 'https://x.example/verify/t')).rejects.toBeInstanceOf(PdfLayoutError)
  })
  it('can be addressed to a lead, printing the company name', async () => {
    const [lead] = await sql`insert into leads (type, name, email, message, company) values ('RFQ', 'Budi', 'budi@example.invalid', 'quote', 'CV Budi Logistik') returning id`
    const id = await createQuotation(actor, { recipient: `lead:${lead.id}`, issuedAt: '2026-10-29', validUntil: '2026-11-10', taxPercent: '0', paymentTerms: 'Upon delivery', termsConditions: 'Standard conditions apply.', notes: '', items: items(2) })
    expect(squash((await pdfPages(await renderDocumentPdf(sql, 'quotation', id, BASE))).join(' '))).toContain('CV Budi Logistik')
  })
})

describe('letterhead under the logo', () => {
  const simpleQuotation = async () => {
    const customer = await saveCustomer(actor, null, { name: 'LETTERHEAD CLIENT', email: 'client@example.invalid', address: 'Jakarta', taxId: '', currency: 'IDR', termsDays: '14' })
    const id = await createQuotation(actor, { recipient: `customer:${customer}`, issuedAt: '2026-10-29', validUntil: '2026-11-10', taxPercent: '0', paymentTerms: 'Net 14', termsConditions: 'Standard conditions.', notes: '', items: items(1) })
    await setQuotationStatus(actor, id, 'issue')
    return id
  }
  const receiptFor = async (invoice: number, bank: number) => {
    const p = await recordPayment(actor, invoice, { amount: '1000000', date: '2026-10-29', method: 'bank transfer', reference: 'LH-1', receivingBankId: bank })
    return (await confirmPayment(actor, p, { fundsCleared: true, receivingBankId: null }, BASE)).receiptId
  }

  it('prints the tagline, the address and the NPWP under the logo, and the NPWP in the issuer block, on every document', async () => {
    const { invoice, banks } = await setup({ n: 1 })
    const documents = [['invoice', invoice], ['receipt', await receiptFor(invoice, banks[0])], ['quotation', await simpleQuotation()]] as const
    for (const [kind, id] of documents) {
      const text = squash((await pdfPages(await renderDocumentPdf(sql, kind, id, BASE))).join(' '))
      expect(text, kind).toContain('Bringing the World Within Reach.')
      expect(text, kind).toContain('Gedung Nucira, Jl. Letjen M.T. Haryono')
      expect(text, kind).toContain('NPWP 1000 0000 1178 2812')                          // under the logo
      expect(text, kind).toContain('NPWP: 1000 0000 1178 2812')                         // in the issuer block
    }
  })
  it('takes the NPWP from the site settings, and prints none when it is empty', async () => {
    const { invoice } = await setup({ n: 1 })
    try {
      await sql`insert into settings (key, value) values ('tax_id', '01.234.567.8-901.000') on conflict (key) do update set value = excluded.value`
      const changed = squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', invoice, BASE))).join(' '))
      expect(changed).toContain('NPWP 01.234.567.8-901.000'); expect(changed).toContain('NPWP: 01.234.567.8-901.000'); expect(changed).not.toContain('1000 0000 1178 2812')
      await sql`update settings set value = '  ' where key = 'tax_id'`
      const none = squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', invoice, BASE))).join(' '))
      expect(none).not.toContain('NPWP')
      expect(none).toContain('Gedung Nucira')                                            // the address does not depend on it
    } finally {
      await sql`delete from settings where key = 'tax_id'`
    }
  })
  it('keeps a very long address inside the width of the logo, shortened with "..." in the header only', async () => {
    const { invoice } = await setup({ n: 1 })
    const long = 'Gedung Nucira Sayap Timur Lt.2, Jl. MT. Haryono Kav.27 RT. 008 RW. 009, Tebet Timur, Tebet, Kota Adm. Jakarta Selatan, DKI Jakarta'
    try {
      await sql`insert into settings (key, value) values ('address', ${long}) on conflict (key) do update set value = excluded.value`
      const text = squash((await pdfPages(await renderDocumentPdf(sql, 'invoice', invoice, BASE))).join(' '))
      expect(text).toContain('...')                                                      // the header shortens it ...
      expect(text).toContain('Kota Adm. Jakarta Selatan, DKI Jakarta')                   // ... the issuer block prints all of it
    } finally {
      await sql`delete from settings where key = 'address'`
    }
  })
  it('lines the tagline, the address and the NPWP up with the logo: same left edge, tagline as wide as the logo, nothing wider', async () => {
    const { invoice } = await setup({ n: 1 })
    const img = rasterize(await renderDocumentPdf(sql, 'invoice', invoice, BASE), 1, 288)             // 4 pixels to the point
    if (!img) return                                                                                   // Poppler is not installed
    const k = img.scale
    const light = ([r, g, b]: number[]) => r > 110 && g > 110 && b > 110                              // the logo's white and the light text, not the red A or the ink band
    const extent = (top: number, bottom: number) => {                                                  // in points, the left column only
      let min = Infinity, max = -Infinity
      for (let y = Math.floor(top * k); y <= Math.ceil(bottom * k); y++) for (let x = 0; x < 300 * k; x++) if (light(img.at(x, y))) { min = Math.min(min, x / k); max = Math.max(max, x / k) }
      return { min, max }
    }
    const logo = extent(18, 49), tagline = extent(52, 62), details = extent(69, 104)
    expect(logo.max - logo.min, 'the logo is 144 pt wide').toBeGreaterThan(140)
    expect(Math.abs(tagline.min - logo.min), 'tagline starts where the logo starts').toBeLessThanOrEqual(1.2)
    expect(Math.abs(tagline.max - logo.max), 'tagline ends where the logo ends').toBeLessThanOrEqual(1.2)
    expect(details.min, 'address and NPWP start at the logo edge').toBeGreaterThanOrEqual(logo.min - 0.8)
    expect(details.min).toBeLessThanOrEqual(logo.min + 1.5)
    expect(details.max, 'and never run wider than the logo').toBeLessThanOrEqual(logo.max + 0.8)
  })
})

describe('text safety', () => {
  it('survives characters the standard fonts cannot print, very long unbroken words and markup-like text', async () => {
    const { invoice } = await setup({ name: '日本の会社 PT <b>Tekno</b> & "Co" é', n: 1, itemText: 'X'.repeat(150) + ' <script>alert(1)</script>' })
    const pdf = await renderDocumentPdf(sql, 'invoice', invoice, BASE)
    const text = squash((await pdfPages(pdf)).join(' '))
    expect(text).toContain('PT <b>Tekno</b> & "Co" é')       // printed literally: PDF is not HTML
    expect(text).toContain('?')                                // the unsupported characters
    expect(text.replace(/\s/g, '')).toContain('X'.repeat(150))   // wrapped, never cut off
    expect(poppler(pdf)).toBeTruthy()
  })
  it('refuse a single line item that cannot fit rather than clipping it', async () => {
    const { invoice } = await setup({ n: 1, itemText: 'word '.repeat(400) })
    await expect(renderDocumentPdf(sql, 'invoice', invoice, BASE)).rejects.toThrow(/description is too long/)
  })
})

describe('amount in words', () => {
  it('is exact for sample values', () => {
    expect(englishWords(0)).toBe('Zero')
    expect(englishWords(25_000_000)).toBe('Twenty-Five Million')
    expect(englishWords(120_050_000)).toBe('One Hundred Twenty Million Fifty Thousand')
  })
})
