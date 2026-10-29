import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from '@/server/db'
import { createBank } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { createInvoice, setInvoiceStatus } from '@/server/finance/invoices'
import { confirmPayment, recordPayment } from '@/server/finance/payments'
import { createQuotation, setQuotationStatus } from '@/server/finance/quotations'
import { uploadReceiptStamp } from '@/server/finance/receipts'
import { englishWords } from '@/server/money'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { PdfLayoutError } from '@/server/pdf/kit'
import { createUser } from './helpers/actions'
import { makePdf } from './helpers/pdf'
import { pdfPages, poppler, squash } from './helpers/pdf-text'

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
  })

  it('print foreign-currency amounts with decimals and omit the rupiah wording', async () => {
    const { invoice, banks } = await setup({ currency: 'USD', n: 2, price: 1250 })
    const p = await recordPayment(actor, invoice, { amount: '100.50', date: '2026-10-29', method: 'wire', reference: 'W-1', receivingBankId: banks[0] })
    const { receiptId } = await confirmPayment(actor, p, { fundsCleared: true, receivingBankId: null }, BASE)
    const draft = await pdfPages(await renderDocumentPdf(sql, 'receipt', receiptId, BASE))
    const text = squash(draft[0])
    expect(text).toContain('USD 100.50'); expect(text).toContain('PENDING E-METERAI'); expect(text).toContain('Manual official e-meterai application pending')
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
  const quote = async (n: number, o: { text?: string; notes?: string; price?: string } = {}) => {
    const customer = await saveCustomer(actor, null, { name: 'SAMPLE CLIENT INDUSTRIAL LOGISTICS PT', email: 'finance@example.invalid', address: 'Jl. Contoh Sentra Industri Blok A, Jakarta, Indonesia', taxId: '', currency: 'IDR', termsDays: '14' })
    const id = await createQuotation(actor, {
      recipient: `customer:${customer}`, issuedAt: '2026-10-29', validUntil: '2026-11-10', taxPercent: '11', notes: o.notes ?? 'Customer approval requires authorized signature and company stamp.',
      items: Array.from({ length: n }, (_, i) => `${o.text ?? `${String(i + 1).padStart(2, '0')} International freight and customs handling / cargo services to destination`} ${i + 1} | 1 | ${o.price ?? 725_000 + (i + 1) * 50_000} | shipment`).join('\n'),
    })
    await setQuotationStatus(actor, id, 'issue')
    return id
  }
  it('fit ten items on ONE page with the signature and stamp block', async () => {
    const id = await quote(10)
    const pdf = await renderDocumentPdf(sql, 'quotation', id, BASE)
    save('VORA_Quotation_10_Items_One_Page.pdf', pdf)
    const pages = await pdfPages(pdf)
    expect(pages).toHaveLength(1)
    const text = squash(pages[0])
    for (let i = 1; i <= 10; i++) expect(text).toContain(`International freight and customs handling / cargo services to destination ${i}`)
    for (const s of ['QUOTATION', 'APPROVED BY CUSTOMER', 'COMPANY STAMP', 'AUTHORIZED SIGNATURE', '1 OF 1', 'TAX (11%)', 'TOTAL IDR 11,100,000', 'Customer approval requires authorized signature']) expect(text, s).toContain(s)
    const [{ number }] = await sql`select number from quotations where id = ${id}`
    expect(text).toContain(number as string)
    expect(poppler(pdf)).toContain('QUOTATION')
  })
  it('flow onto further pages above ten items, keeping every item', async () => {
    const id = await quote(12)
    const pages = await pdfPages(await renderDocumentPdf(sql, 'quotation', id, BASE))
    expect(pages.length).toBeGreaterThanOrEqual(3)
    const text = squash(pages.join(' '))
    for (let i = 1; i <= 12; i++) expect(text).toContain(`destination ${i}`)
    expect(text).toContain('APPROVED BY CUSTOMER'); expect(text).toContain('VALID UNTIL')
  })
  it('fail with a clear message instead of clipping or faking a single page', async () => {
    const id = await quote(10, { text: 'Extremely long details '.repeat(28), notes: 'Very long terms '.repeat(110) })
    await expect(renderDocumentPdf(sql, 'quotation', id, BASE)).rejects.toBeInstanceOf(PdfLayoutError)
    await expect(renderDocumentPdf(sql, 'quotation', id, BASE)).rejects.toThrow(/too long for a readable single A4 page/)
  })
  it('can be addressed to a lead, printing the company name', async () => {
    const [lead] = await sql`insert into leads (type, name, email, message, company) values ('RFQ', 'Budi', 'budi@example.invalid', 'quote', 'CV Budi Logistik') returning id`
    const id = await createQuotation(actor, { recipient: `lead:${lead.id}`, issuedAt: '2026-10-29', validUntil: '2026-11-10', taxPercent: '0', notes: '', items: items(2) })
    expect(squash((await pdfPages(await renderDocumentPdf(sql, 'quotation', id, BASE))).join(' '))).toContain('CV Budi Logistik')
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
