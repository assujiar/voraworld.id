import { beforeAll, describe, expect, it } from 'vitest'
import { createLead } from '@/server/leads'
import { addSection, restorePage, saveArticle, savePage, saveSection, restoreArticle } from '@/server/cms'
import { createDocument, setDocumentStatus, updateDocument } from '@/server/documents/general'
import { saveCustomer } from '@/server/finance/customers'
import { createBank, updateBank } from '@/server/finance/banks'
import { setInvoiceStatus, type InvoiceInput } from '@/server/finance/invoices'
import { createInvoice, createQuotation } from './helpers/commercial'
import { cancelPayment, confirmPayment, recordPayment } from '@/server/finance/payments'
import { ensurePrepayment, voidPrepayment } from '@/server/finance/prepayments'
import { voidReceipt } from '@/server/finance/receipts'
import { requestApproval, setQuotationStatus } from '@/server/finance/quotations'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { saveMailConfig } from '@/server/mail/config'
import { enqueue, dispatch, retryJob } from '@/server/mail/outbox'
import { setSender } from '@/server/mail/transport'
import { getPublishedPage } from '@/server/site'
import { createUser } from './helpers/actions'
import { sql } from './helpers/db'

/**
 * Not the regression suite: a smoke test that the whole server layer, now on the Data API and the database functions, does what it did on a
 * direct connection. One path through every module that used to open a transaction.
 */
const BASE = 'https://voraworld.id'
let actor: number
beforeAll(async () => { actor = (await createUser('smoke@example.invalid', 'admin')).id })

const input = (customerId: number, o: Partial<InvoiceInput> = {}): InvoiceInput => ({
  customerId, issuedAt: '2026-10-05', dueAt: '', taxPercent: '11', withholdingPercent: '2', discount: '0', poNumber: 'PO-77', shipmentReference: 'JOB-9', serviceMode: 'Sea Import FCL',
  origin: 'Shanghai', destination: 'Jakarta', transportDocumentRef: 'BL-1', notes: '', items: 'Ocean freight | 1 | 1000000 | shipment\nCustoms | 2 | 500000 | job', bankAccountIds: [], ...o,
})

describe('finance', () => {
  it('runs customer -> bank -> invoice -> payment claim -> confirmation -> receipt void on database functions', async () => {
    const customer = await saveCustomer(actor, null, { name: 'PT Smoke', email: 'billing@smoke.example', address: 'Jl. A', taxId: '1', currency: 'IDR', termsDays: '14' }, { acknowledgeDuplicates: true })
    await saveCustomer(actor, customer, { name: 'PT Smoke Updated', email: 'billing@smoke.example', address: 'Jl. A', taxId: '1', currency: 'IDR', termsDays: '30' }, { acknowledgeDuplicates: true })
    const bank = await createBank(actor, { bankName: 'Bank Smoke', accountNumber: '1234567890', accountHolder: 'PT Satu Arah International', currency: 'IDR', branch: '', swiftCode: '', notes: '' })
    await updateBank(actor, bank, 'save', { bankName: 'Bank Smoke 2', accountNumber: '1234567890', accountHolder: 'PT Satu Arah International', currency: 'IDR', branch: 'X', swiftCode: '', notes: '' })
    const id = await createInvoice(actor, input(customer))
    const [inv] = await sql`select * from invoices where id = ${id}`
    expect(inv).toMatchObject({ status: 'draft', currency: 'IDR', dueAt: '2026-11-04' })              // due date from the customer's 30-day terms
    expect(inv.number).toMatch(/^INV-VORA-C[0-9A-F]{10}-202610-\d{5}$/)
    expect((await sql`select count(*)::int as n from invoice_bank_instructions where invoice_id = ${id}`)[0].n).toBe(1)
    expect((await sql`select count(*)::int as n from invoice_items where invoice_id = ${id}`)[0].n).toBe(2)
    const [pre] = await sql`select * from prepayment_receipts where invoice_id = ${id}`
    expect(pre).toMatchObject({ status: 'draft', stampRequired: false })
    expect((await sql`select count(*)::int as n from document_verification_tokens where (kind = 'invoice' and document_id = ${id}) or (kind = 'prepayment' and document_id = ${pre.id})`)[0].n).toBe(2)

    await setInvoiceStatus(actor, id, 'issue')
    expect((await sql`select status from prepayment_receipts where invoice_id = ${id}`)[0].status).toBe('issued')       // released with the invoice
    await expect(recordPayment(actor, id, { amount: '99999999', date: '', method: 'bank transfer', reference: 'X', receivingBankId: null })).rejects.toMatchObject({ status: 422 })
    const claim = await recordPayment(actor, id, { amount: '500000', date: '', method: 'bank transfer', reference: 'TRX-1', receivingBankId: bank })
    expect((await sql`select outstanding_minor from invoices where id = ${id}`)[0].outstandingMinor).toBe(inv.totalMinor)   // a claim credits nothing
    await cancelPayment(actor, claim)
    const claim2 = await recordPayment(actor, id, { amount: '500000', date: '', method: 'bank transfer', reference: 'TRX-2', receivingBankId: bank })
    const done = await confirmPayment(actor, claim2, { fundsCleared: true, receivingBankId: bank }, BASE)
    expect(done.stampRequired).toBe(false)
    const [after] = await sql`select status, outstanding_minor from invoices where id = ${id}`
    expect(after).toMatchObject({ status: 'partially_paid', outstandingMinor: inv.totalMinor - 500000 })
    await expect(confirmPayment(actor, claim2, { fundsCleared: true, receivingBankId: bank }, BASE)).rejects.toMatchObject({ status: 409 })      // exactly one confirmation
    expect((await sql`select count(*)::int as n from receipts where invoice_id = ${id}`)[0].n).toBe(1)
    const [pdf, receiptPdf] = [await renderDocumentPdf('invoice', id, BASE), await renderDocumentPdf('receipt', done.receiptId, BASE)]
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe('%PDF')
    expect(Buffer.from(receiptPdf).subarray(0, 4).toString()).toBe('%PDF')

    await voidReceipt(actor, done.receiptId)
    expect((await sql`select status, outstanding_minor from invoices where id = ${id}`)[0]).toMatchObject({ status: 'issued', outstandingMinor: inv.totalMinor })
    await voidPrepayment(actor, pre.id as number)
    await ensurePrepayment(actor, id)
    await setInvoiceStatus(actor, id, 'void')
    expect((await sql`select status from prepayment_receipts where invoice_id = ${id} and status <> 'void'`)).toHaveLength(0)
    expect((await sql`select count(*)::int as n from audit_logs where object_type in ('invoice','payment','receipt','prepayment-receipt')`)[0].n).toBeGreaterThan(8)
  })

  it('issues, requests approval for and voids a quotation', async () => {
    await saveMailConfig({ host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
    await sql`update email_rules set enabled = true where key = 'quotation_approval_request'`
    const customer = await saveCustomer(actor, null, { name: 'PT Quote', email: 'q@quote.example', address: '', taxId: '', currency: 'IDR', termsDays: '14' }, { acknowledgeDuplicates: true })
    const id = await createQuotation(actor, { recipient: `customer:${customer}`, issuedAt: '2026-10-05', validUntil: '2999-01-01', taxPercent: '0', paymentTerms: 'Within 14 days', termsConditions: 'Standard terms apply', notes: '', items: 'Freight | 1 | 500000 | job' })
    await setQuotationStatus(actor, id, 'issue')
    await requestApproval(actor, id, BASE)
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('awaiting_approval')
    const [req] = await sql`select * from quotation_approvals where quotation_id = ${id}`
    expect(req.status).toBe('pending')
    expect((await sql`select count(*)::int as n from email_jobs where event = 'quotation_approval_request'`)[0].n).toBe(1)
    expect(Buffer.from(await renderDocumentPdf('quotation', id, BASE)).subarray(0, 4).toString()).toBe('%PDF')
    await setQuotationStatus(actor, id, 'void')
    expect((await sql`select status from quotation_approvals where id = ${req.id}`)[0].status).toBe('revoked')
  })
})

describe('website content, documents, leads and mail', () => {
  it('saves, publishes and restores an article and a page with sections', async () => {
    const article = await saveArticle(actor, null, { title: 'Smoke article', slug: '', excerpt: 'x', body: '<p>one</p><script>1</script>', category: '', tags: '', locale: 'en', author: '', seoTitle: '', seoDescription: '', action: 'publish' })
    await saveArticle(actor, article, { title: 'Smoke article', slug: 'smoke-article', excerpt: 'x', body: '<p>two</p>', category: '', tags: '', locale: 'en', author: '', seoTitle: '', seoDescription: '', action: 'draft' })
    const [rev] = await sql`select id from revisions where resource = 'article' and resource_id = ${article} order by id limit 1`
    await restoreArticle(actor, article, rev.id as number)
    expect((await sql`select body, status from articles where id = ${article}`)[0]).toMatchObject({ body: '<p>one</p>', status: 'published' })
    await expect(saveArticle(actor, null, { title: 'Other', slug: 'smoke-article', excerpt: '', body: '', category: '', tags: '', locale: 'en', author: '', seoTitle: '', seoDescription: '', action: 'draft' })).rejects.toMatchObject({ message: 'Article slug already in use', status: 409 })

    const page = await savePage(actor, null, { title: 'Smoke page', slug: 'smoke-page', locale: 'en', description: 'd', seoTitle: '', action: 'draft' })
    await addSection(actor, page); await addSection(actor, page)
    const [s1, s2] = await sql`select id from sections where page_id = ${page} order by position`
    await saveSection(actor, s1.id as number, { title: 'Hello', body: 'b', kind: 'hero', layout: 'stack', surface: 'paper', visible: true, buttonLabel: '', buttonHref: '', image: '', move: '', remove: false })
    await saveSection(actor, s2.id as number, { title: '', body: '', kind: '', layout: '', surface: '', visible: true, buttonLabel: '', buttonHref: '', image: '', move: 'up', remove: false })
    expect((await sql`select id from sections where page_id = ${page} order by position`).map((r) => r.id)).toEqual([s2.id, s1.id])
    await savePage(actor, page, { title: 'Smoke page', slug: 'smoke-page', locale: 'en', description: 'd', seoTitle: '', action: 'publish' })
    expect((await getPublishedPage('smoke-page', 'en'))?.sections).toHaveLength(2)
    await saveSection(actor, s2.id as number, { title: '', body: '', kind: '', layout: '', surface: '', visible: true, buttonLabel: '', buttonHref: '', image: '', move: '', remove: true })
    await savePage(actor, page, { title: 'Smoke page', slug: 'smoke-page', locale: 'en', description: 'd', seoTitle: '', action: 'publish' })
    expect((await getPublishedPage('smoke-page', 'en'))?.sections).toHaveLength(1)
    const [r0] = await sql`select id from revisions where resource = 'page' and resource_id = ${page} order by id limit 1`
    await expect(restorePage(actor, page, r0.id as number)).rejects.toMatchObject({ status: 409 })        // the first revision is the empty page
  })

  it('writes, edits, issues and voids a letter', async () => {
    const id = await createDocument(actor, { kind: 'letter', language: 'id', customerId: null, documentDate: '2026-10-30', invoiceIds: [],
      values: { place: 'Jakarta', subject: 'Perihal', recipient_name: 'PT X', body: 'Isi surat', closing: 'Terima kasih', signatory_name: 'A', signatory_title: 'B' } })
    await updateDocument(actor, id, { kind: 'letter', language: 'id', customerId: null, documentDate: '2026-10-30', invoiceIds: [],
      values: { place: 'Jakarta', subject: 'Perihal baru', recipient_name: 'PT X', body: 'Isi surat', closing: 'Terima kasih', signatory_name: 'A', signatory_title: 'B' } })
    await setDocumentStatus(actor, id, 'issue')
    await expect(updateDocument(actor, id, { kind: 'letter', language: 'id', customerId: null, documentDate: '2026-10-30', invoiceIds: [], values: {} })).rejects.toMatchObject({ status: 409 })
    expect((await sql`select number, status, subject from documents where id = ${id}`)[0]).toMatchObject({ status: 'issued', subject: 'Perihal baru' })
    expect(Buffer.from(await renderDocumentPdf('document', id, BASE)).subarray(0, 4).toString()).toBe('%PDF')
    await setDocumentStatus(actor, id, 'void')
    expect((await sql`select revoked from document_verification_tokens where kind = 'document' and document_id = ${id}`)[0].revoked).toBe(true)
  })

  it('stores a website enquiry with its reference, throttles by address, queues mail and retries a failed message', async () => {
    await saveMailConfig({ host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
    await sql`update email_rules set enabled = true where key in ('lead_admin','lead_customer')`
    const lead = await createLead({ kind: 'rfq', name: 'Dewi', email: 'dewi@example.invalid', phone: '+62 812 3456 7890', message: 'Need a quote', company: 'PT C', mode: 'sea', origin: 'A', destination: 'B', cargo: 'c', pickup: '' })
    expect(lead.reference).toMatch(/^RFQ-VORA-L[0-9A-F]{10}-\d{6}-\d{5}$/)
    expect((await sql`select event from email_jobs where event like 'lead\\_%' order by id`).map((r) => r.event)).toEqual(['lead_admin', 'lead_customer'])
    for (let i = 0; i < 3; i++) await createLead({ kind: 'contact', name: 'Dewi', email: 'dewi@example.invalid', phone: '+62 812 3456 7890', message: 'again', company: '', mode: '', origin: '', destination: '', cargo: '', pickup: '' })
    await expect(createLead({ kind: 'contact', name: 'Dewi', email: 'dewi@example.invalid', phone: '+62 812 3456 7890', message: 'again', company: '', mode: '', origin: '', destination: '', cargo: '', pickup: '' })).rejects.toMatchObject({ status: 429 })

    setSender(async () => { throw new Error('smtp down') })
    expect(await dispatch(BASE, 10)).toMatchObject({ failed: expect.any(Number) })
    const [job] = await sql`select id, status from email_jobs where status in ('retry','failed') and event = 'lead_admin' order by id limit 1`
    await sql`update email_jobs set status = 'failed' where id = ${job.id}`
    await retryJob(actor, job.id as number)
    expect((await sql`select status from email_jobs where id = ${job.id}`)[0].status).toBe('queued')
    const sent: string[] = []
    setSender(async (_c, to) => { sent.push(to) })
    expect((await dispatch(BASE, 30)).sent).toBeGreaterThan(0)
    expect(sent.length).toBeGreaterThan(0)
    const again = await enqueue('lead_admin', 'ops@example.invalid', { name: 'x' }, { dedupeKey: 'smoke-dedupe' })
    expect(await enqueue('lead_admin', 'ops@example.invalid', { name: 'x' }, { dedupeKey: 'smoke-dedupe' })).toMatchObject({ id: again!.id })
  })
})
