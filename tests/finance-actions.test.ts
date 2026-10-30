import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { submitApprovalAction } from '@/actions/approval'
import {
  cancelPaymentAction, confirmPaymentAction, createBankAction, createInvoiceAction, createQuotationAction, invoiceStatusAction, quotationStatusAction, recordPaymentAction,
  requestApprovalAction, reviewApprovalAction, saveCustomerAction, sendInvoiceAction, updateBankAction, uploadStampAction, voidReceiptAction,
} from '@/actions/finance'
import { sql } from './helpers/db'
import { saveMailConfig } from '@/server/mail/config'
import { setSender } from '@/server/mail/transport'
import { today } from '@/server/dates'
import { act, createUser, q, sessionFor } from './helpers/actions'
import { makePdf } from './helpers/pdf'
import { pdfLinks } from './helpers/pdf-text'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
process.env.PUBLIC_BASE_URL = 'https://testserver'      // production links are https; the sanitiser drops plain http hrefs
process.env.VORA_LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'vora-finact-'))
let admin: string
const as = () => ({ as: admin })
const pdfFile = (bytes: Uint8Array, name = 'doc.pdf') => new File([bytes as BlobPart], name, { type: 'application/pdf' })
const sent: Array<{ to: string; subject: string; attachment?: string; content?: Uint8Array }> = []

beforeAll(async () => { admin = await sessionFor(await createUser('finance-actions@example.invalid', 'admin')) })
beforeEach(async () => {
  sent.length = 0
  setSender(async (_conf, to, subject, _html, attachment) => { sent.push({ to, subject, attachment: attachment?.filename, content: attachment?.content }) })
  await sql`truncate customers, bank_accounts, quotations, invoices, payments, receipts, document_verification_tokens, email_jobs, leads, mail_config restart identity cascade`
  await sql`update email_rules set enabled = false`
})
async function smtp(...rules: string[]) {
  await saveMailConfig(sql, { host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
  for (const r of rules) await sql`update email_rules set enabled = true where key = ${r}`
}
/** Emails go out right after the response; wait until the queue has been worked off (or give up after 5 s). */
const settle = async () => {
  for (let i = 0; i < 100; i++) {
    const [{ n }] = await sql`select count(*)::int as n from email_jobs where status in ('queued', 'sending')`
    if (!n) return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('email queue did not drain: ' + JSON.stringify(await sql`select event, status, error from email_jobs`))
}

async function customer(extra: Record<string, string> = {}) {
  const r = await act(saveCustomerAction, { name: 'PT Pelanggan', email: 'billing@pelanggan.example', currency: 'IDR', terms_days: '14', address: 'Jl. A', ...extra }, as())
  return Number(/\/admin\/customers\/(\d+)/.exec(r.redirect!)![1])
}

describe('forms that use useActionState', () => {
  it('return the message AND what was typed when the server refuses, and navigate only on success', async () => {
    const bad = await act(saveCustomerAction, { name: '', email: 'x@y.example', address: 'Jl. Mawar 1\nJakarta', terms_days: '14', currency: 'IDR' }, as())
    expect(bad.redirect).toBeUndefined()
    expect(bad.state).toMatchObject({ error: 'Customer name required', values: { email: 'x@y.example', address: 'Jl. Mawar 1\nJakarta' } })
    expect(bad.state!.values).not.toHaveProperty('$ACTION_ID')
    const ok = await act(saveCustomerAction, { name: 'PT Baru', email: '', terms_days: '14', currency: 'IDR' }, as())
    expect(ok.redirect).toMatch(/^\/admin\/customers\/\d+\?notice=Customer%20saved$/)
    expect(ok.state).toBeUndefined()
  })
  it('keep several values for the same field (the bank checkboxes)', async () => {
    const id = await customer()
    const r = await act(createInvoiceAction, { customer_id: String(id), items: 'bad line', bank_account_ids: ['3', '4'] }, as())
    expect(r.state?.values?.bank_account_ids).toEqual(['3', '4'])
    expect(r.state?.error).toMatch(/description \| quantity/)
  })
  it('never echo uploaded files back', async () => {
    const r = await act(createBankAction, { bank_name: '', account_number: '123', account_holder: 'x', currency: 'IDR', logo: new Blob(['x']) }, as())
    expect(JSON.stringify(r.state)).not.toContain('[object')
    expect(r.state?.values).not.toHaveProperty('logo')
  })
})

describe('the full money flow through the form actions', () => {
  it('quotation -> invoice -> pending payment -> confirmation -> receipt -> void, with emails going out after each response', async () => {
    await smtp('invoice_customer', 'payment_confirmed', 'receipt_customer')
    const cid = await customer()
    const bank = await act(createBankAction, { bank_name: 'Bank Contoh', account_number: '1234567890', account_holder: 'PT Satu Arah International', currency: 'IDR' }, as())
    expect(bank.redirect).toContain('Bank%20account%20saved')
    const [{ id: bankId }] = await sql`select id from bank_accounts`

    const inv = await act(createInvoiceAction, {
      customer_id: String(cid), issued_at: '2026-10-05', due_at: '2026-10-19', tax_percent: '11', withholding_percent: '0', discount: '0', po_number: 'PO-1', items: 'Ocean freight | 1 | 1000000 | shipment',
      bank_account_ids: [String(bankId)], notes: 'n',
    }, as())
    const invoiceId = Number(/\/admin\/invoices\/(\d+)\?notice=Invoice%20draft%20created/.exec(inv.redirect!)![1])
    expect((await sql`select total_minor, po_number from invoices where id = ${invoiceId}`)[0]).toMatchObject({ totalMinor: 1_110_000, poNumber: 'PO-1' })
    expect((await sql`select count(*)::int as n from invoice_bank_instructions where invoice_id = ${invoiceId}`)[0].n).toBe(1)

    expect((await act(invoiceStatusAction, { record: String(invoiceId), action: 'issue' }, as())).redirect).toContain('Invoice%20state%20updated')
    expect((await act(invoiceStatusAction, { record: String(invoiceId), action: 'issue', _back: `/admin/invoices/${invoiceId}` }, as())).redirect).toMatch(/error=Invalid%20state%20change/)
    expect((await act(sendInvoiceAction, { record: String(invoiceId) }, as())).redirect).toContain('Invoice%20email%20queued')
    await settle()
    expect(sent.map((s) => s.subject)).toEqual([expect.stringContaining('VORA invoice INV-VORA-')])
    expect(sent[0].attachment).toMatch(/^INV-VORA-.*\.pdf$/)          // a real PDF was rendered and attached

    const pay = await act(recordPaymentAction, { record: String(invoiceId), amount: '555000', date: today(), method: 'bank transfer', reference: 'TRX-9', receiving_bank_id: String(bankId) }, as())
    expect(pay.redirect).toContain('waiting%20for%20bank%20confirmation')
    const [{ id: paymentId }] = await sql`select id from payments`
    expect((await sql`select outstanding_minor from invoices where id = ${invoiceId}`)[0].outstandingMinor).toBe(1_110_000)

    const refuse = await act(confirmPaymentAction, { record: String(paymentId), _back: `/admin/invoices/${invoiceId}` }, as())     // checkbox not ticked
    expect(q(refuse.redirect).get('error')).toMatch(/funds are credited/)
    const done = await act(confirmPaymentAction, { record: String(paymentId), funds_cleared: 'yes' }, as())
    expect(done.redirect).toBe(`/admin/invoices/${invoiceId}?notice=Funds%20confirmed%3A%20invoice%20recalculated%2C%20receipt%20issued%2C%20customer%20emails%20queued`)
    await settle()
    expect(sent.map((s) => s.subject).slice(1).sort()).toEqual([expect.stringContaining('payment confirmation'), expect.stringContaining('payment receipt')].sort())
    expect(sent.find((s) => s.subject.includes('payment receipt'))!.attachment).toMatch(/^RCP-VORA-.*\.pdf$/)
    expect((await sql`select status, outstanding_minor from invoices where id = ${invoiceId}`)[0]).toMatchObject({ status: 'partially_paid', outstandingMinor: 555_000 })

    const [{ id: receiptId }] = await sql`select id from receipts`
    expect((await act(voidReceiptAction, { record: String(receiptId) }, as())).redirect).toContain('payment%20was%20reversed')
    expect((await sql`select status, outstanding_minor from invoices where id = ${invoiceId}`)[0]).toMatchObject({ status: 'issued', outstandingMinor: 1_110_000 })
    expect(q((await act(voidReceiptAction, { record: String(receiptId), _back: '/admin/receipts' }, as())).redirect).get('error')).toMatch(/already void/)
  })

  it('cancels a pending payment', async () => {
    const cid = await customer()
    const inv = await act(createInvoiceAction, { customer_id: String(cid), items: 'x | 1 | 5000 | u' }, as())
    const id = Number(/invoices\/(\d+)/.exec(inv.redirect!)![1])
    await act(invoiceStatusAction, { record: String(id), action: 'issue' }, as())
    await act(recordPaymentAction, { record: String(id), amount: '1000', method: 'cash' }, as())
    const [{ id: pid }] = await sql`select id from payments`
    expect((await act(cancelPaymentAction, { record: String(pid) }, as())).redirect).toContain('Pending%20payment%20cancelled')
    expect((await sql`select status from payments`)[0].status).toBe('cancelled')
  })

  it('walks a receipt that needs an e-meterai from confirmation to release', async () => {
    await smtp('receipt_customer')
    const cid = await customer()
    await act(createBankAction, { bank_name: 'Bank Contoh', account_number: '1234567890', account_holder: 'PT Satu Arah International', currency: 'IDR' }, as())
    const [{ id: bankId }] = await sql`select id from bank_accounts`
    const inv = await act(createInvoiceAction, { customer_id: String(cid), items: 'Project cargo | 1 | 9000000 | job' }, as())
    const invoiceId = Number(/invoices\/(\d+)/.exec(inv.redirect!)![1])
    await act(invoiceStatusAction, { record: String(invoiceId), action: 'issue' }, as())
    await act(recordPaymentAction, { record: String(invoiceId), amount: '6000000', method: 'bank transfer', receiving_bank_id: String(bankId) }, as())
    const [{ id: paymentId }] = await sql`select id from payments`
    const confirmed = await act(confirmPaymentAction, { record: String(paymentId), funds_cleared: 'yes' }, as())
    const receiptId = Number(/receipts\/(\d+)/.exec(confirmed.redirect!)![1])           // sent to the receipt page, where the stamp is uploaded
    expect(confirmed.redirect).toContain('needs%20a%20manual%20e-meterai')
    await settle(); expect(sent).toHaveLength(0)                                          // nothing is emailed yet
    const [r] = await sql`select r.number as rn, i.number as inum from receipts r join invoices i on i.id = r.invoice_id`
    const good = await makePdf([r.rn as string, r.inum as string])

    const attempt = (fields: Record<string, string | Blob>) => act(uploadStampAction, { record: String(receiptId), _back: `/admin/receipts/${receiptId}`, ...fields }, as())
    expect(q((await attempt({ stamp_provider_reference: 'PERURI-0001', approved: '1' })).redirect).get('error')).toMatch(/all required/)
    expect(q((await attempt({ stamp_provider_reference: 'PERURI-0001', approved: '1', stamped_pdf: pdfFile(await makePdf(['unrelated'])) })).redirect).get('error')).toMatch(/must retain VORA receipt/)
    const ok = await attempt({ stamp_provider_reference: 'PERURI-0001', approved: '1', stamped_pdf: pdfFile(good) })
    expect(ok.redirect).toContain('Stamped%20receipt%20stored')
    await settle()
    expect(sent.map((s) => s.attachment)).toEqual([expect.stringMatching(/^RCP-VORA-/)])
    expect((await sql`select status from receipts where id = ${receiptId}`)[0].status).toBe('issued')
  })
})

describe('quotation approval through the actions', () => {
  it('requires the email setup, then the customer link carries a submission that Finance reviews', async () => {
    const cid = await customer()
    const created = await act(createQuotationAction, { recipient: `customer:${cid}`, issued_at: today(), valid_until: '2999-01-01', tax_percent: '0', payment_terms: 'Payment within 14 days of the invoice date', terms_conditions: 'Rates are valid for the period stated.', items: 'Air freight | 1 | 50000 | kg' }, as())
    const id = Number(/quotations\/(\d+)/.exec(created.redirect!)![1])
    await act(quotationStatusAction, { record: String(id), action: 'issue' }, as())
    expect(q((await act(requestApprovalAction, { record: String(id), _back: `/admin/quotations/${id}` }, as())).redirect).get('error')).toMatch(/Configure SMTP/)
    await smtp('quotation_approval_request', 'quotation_approved_admin')
    expect((await act(requestApprovalAction, { record: String(id) }, as())).redirect).toContain('Approval%20email%20queued')
    await settle()
    expect(sent).toHaveLength(1); expect(sent[0].attachment).toMatch(/^QUO-VORA-/)
    const [job] = await sql`select html from email_jobs where event = 'quotation_approval_request'`
    const token = /quotation-approval\/([A-Za-z0-9_-]+)/.exec(job.html as string)![1]
    const [{ number }] = await sql`select number from quotations where id = ${id}`
    // The emailed PDF carries the same private address as the email, as a clickable link, and the document's verification address on every page.
    const [{ verifyToken }] = await sql`select token as verify_token from document_verification_tokens where kind = 'quotation' and document_id = ${id}`
    const emailed = await pdfLinks(sent[0].content!)
    expect(emailed.flat()).toContain(`https://testserver/quotation-approval/${token}`)
    for (const page of emailed) expect(page).toContain(`https://testserver/verify/${verifyToken}`)

    // The customer needs no account: this is a public action. Everything goes through one form.
    const form = (o: Record<string, string | Blob>) => ({ token, signer_name: 'Siti Rahma', signer_title: 'Finance Director', ack: 'yes', ...o })
    expect(q((await act(submitApprovalAction, form({ signed_pdf: pdfFile(await makePdf(['nothing relevant'])) }))).redirect).get('error')).toMatch(/exact VORA quotation number/)
    expect(q((await act(submitApprovalAction, form({ ack: '' , signed_pdf: pdfFile(await makePdf([number as string])) }))).redirect).get('error')).toMatch(/confirmation required/)
    const malformed = await act(submitApprovalAction, { ...form({ signed_pdf: pdfFile(await makePdf([number as string])) }), token: 'short' })
    expect(malformed.redirect).toBe('/en?error=This%20approval%20link%20is%20not%20valid')         // same answer for any wrong token: no oracle
    const ok = await act(submitApprovalAction, form({ signed_pdf: pdfFile(await makePdf([number as string])) }))
    expect(ok.redirect).toBe(`/quotation-approval/${token}?received=1`)
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('awaiting_approval')
    expect(q((await act(submitApprovalAction, form({ signed_pdf: pdfFile(await makePdf([number as string])) }))).redirect).get('error')).toMatch(/expired or was already used/)

    const [{ id: approvalId }] = await sql`select id from quotation_approvals`
    const review = (o: Record<string, string>) => act(reviewApprovalAction, { record: String(approvalId), _back: `/admin/quotations/${id}`, ...o }, as())
    expect(q((await review({ action: 'approve' })).redirect).get('error')).toMatch(/reviewed manually/)
    expect((await review({ action: 'approve', signature_and_stamp_verified: 'yes', review_note: 'ok' })).redirect).toContain('quotation%20status%20updated')
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('approved')
    await settle()
    expect(sent.some((s) => s.to === 'ops@example.invalid' && s.subject.includes('quotation accepted'))).toBe(true)
  })
})

describe('bank account actions', () => {
  it('route each button to the right change', async () => {
    for (const n of ['AAAAA11111', 'BBBBB22222']) await act(createBankAction, { bank_name: 'Bank', account_number: n, account_holder: 'PT X', currency: 'IDR' }, as())
    const [a, b] = (await sql`select id from bank_accounts order by id`).map((r) => String(r.id))
    const row = async (id: string) => (await sql`select is_default, active from bank_accounts where id = ${id}`)[0]
    await act(updateBankAction, { record: b, action: 'default' }, as())
    expect(await row(b)).toMatchObject({ isDefault: true }); expect(await row(a)).toMatchObject({ isDefault: false })
    await act(updateBankAction, { record: b, action: 'disable' }, as())
    expect(await row(b)).toMatchObject({ isDefault: false, active: false })
    await act(updateBankAction, { record: a, action: 'save', bank_name: 'Renamed', account_number: 'ZZZZZ99999', account_holder: 'PT Y', swift_code: 'bcaidjak' }, as())
    expect((await sql`select bank_name, account_number, swift_code from bank_accounts where id = ${a}`)[0]).toMatchObject({ bankName: 'Renamed', accountNumber: 'ZZZZZ99999', swiftCode: 'BCAIDJAK' })
    expect(q((await act(updateBankAction, { record: a, action: 'explode', _back: '/admin/bank-accounts' }, as())).redirect).get('error')).toBe('Invalid action')
  })
})
