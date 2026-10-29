import { randomBytes } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from '@/server/db'
import { sha256Hex } from '@/server/crypto'
import { saveMailConfig } from '@/server/mail/config'
import { dispatch } from '@/server/mail/outbox'
import { setSender } from '@/server/mail/transport'
import { createBank, updateBank } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { createInvoice, recomputeOutstanding, sendInvoice, setInvoiceStatus, type InvoiceInput } from '@/server/finance/invoices'
import { cancelPayment, confirmPayment, recordPayment } from '@/server/finance/payments'
import { approvalByToken, approvalIsOpen, createQuotation, readApprovalFile, requestApproval, reviewApproval, setQuotationStatus, submitApproval } from '@/server/finance/quotations'
import { readStampedReceipt, uploadReceiptStamp, voidReceipt } from '@/server/finance/receipts'
import { requiresStamp } from '@/server/finance/pdf-inspect'
import { today } from '@/server/dates'
import { createUser } from './helpers/actions'
import { makePdf } from './helpers/pdf'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
process.env.VORA_LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'vora-fin-'))
const BASE = 'https://testserver'
let actor: number

const customer = (o: Partial<{ name: string; email: string; currency: string; termsDays: string }> = {}) =>
  saveCustomer(actor, null, { name: 'PT Pelanggan Satu', email: 'billing@pelanggan.example', address: 'Jl. Contoh 1\nJakarta', taxId: '01.234.567.8-901.000', currency: 'IDR', termsDays: '14', ...o })
const bank = (o: Partial<Parameters<typeof createBank>[1]> = {}) =>
  createBank(actor, { bankName: 'Bank Contoh', accountNumber: '1234567890', accountHolder: 'PT Satu Arah International', currency: 'IDR', branch: 'Tebet', swiftCode: '', notes: '', ...o })
const invoiceInput = (customerId: number, o: Partial<InvoiceInput> = {}): InvoiceInput => ({
  customerId, issuedAt: '2026-10-05', dueAt: '2026-10-19', taxPercent: '11', withholdingPercent: '2', discount: '0', poNumber: 'PO-77', shipmentReference: 'JOB-9',
  serviceMode: 'Sea Import FCL', origin: 'Shanghai', destination: 'Jakarta', transportDocumentRef: 'BL-1', notes: 'Thank you', items: 'Ocean freight | 1 | 10000000 | shipment\nCustoms | 2 | 500000 | job',
  bankAccountIds: [], ...o,
})
const issued = async (customerId: number, o: Partial<InvoiceInput> = {}) => {
  const id = await createInvoice(actor, invoiceInput(customerId, o))
  await setInvoiceStatus(actor, id, 'issue')
  return id
}
const inv = async (id: number) => (await sql`select * from invoices where id = ${id}`)[0]
const pay = (invoiceId: number, amount: string, o: Partial<Parameters<typeof recordPayment>[2]> = {}) =>
  recordPayment(actor, invoiceId, { amount, date: '', method: 'bank transfer', reference: 'TRX-1', receivingBankId: null, ...o })
const confirm = (paymentId: number, bankId: number | null = null) => confirmPayment(actor, paymentId, { fundsCleared: true, receivingBankId: bankId }, BASE)
const rejects = async (p: Promise<unknown>, message: RegExp | string, status?: number) => {
  const e = await p.then(() => null, (x: Error & { status?: number }) => x)
  expect(e, 'expected a refusal').not.toBeNull()
  expect(e!.message).toMatch(message)
  if (status) expect(e!.status).toBe(status)
}

beforeAll(async () => { actor = (await createUser('finance-admin@example.invalid', 'admin')).id })
// Every test starts from an empty business ledger (the admin account stays).
beforeEach(async () => {
  setSender(null)
  await sql`truncate customers, bank_accounts, quotations, invoices, payments, receipts, document_verification_tokens, email_jobs, leads, mail_config restart identity cascade`
  await sql`update email_rules set enabled = false`
})

describe('customers', () => {
  it('get a permanent random owner code and validated details', async () => {
    const id = await customer({ name: '  Maju Jaya  ' })
    const [c] = await sql`select * from customers where id = ${id}`
    expect(c.name).toBe('Maju Jaya'); expect(c.publicCode).toMatch(/^C[A-F0-9]{10}$/)
    const code = c.publicCode
    await saveCustomer(actor, id, { name: 'Maju Jaya Tbk', email: '', address: '', taxId: '', currency: 'IDR', termsDays: '30' })
    const [again] = await sql`select * from customers where id = ${id}`
    expect(again.publicCode).toBe(code); expect(again.termsDays).toBe(30); expect(again.email).toBe('')
    await rejects(customer({ name: '   ' }), 'Customer name required')
    await rejects(customer({ email: 'not-an-email' }), 'not a valid address')
    await rejects(customer({ termsDays: '999' }), 'Invalid payment terms')
    await rejects(saveCustomer(actor, 987654, { name: 'x', email: '', address: '', taxId: '', currency: 'IDR', termsDays: '1' }), 'Customer not found', 404)
  })
  it('keep their currency once documents exist', async () => {
    const id = await customer({ currency: 'USD' })
    await quoteFor(id)
    await rejects(saveCustomer(actor, id, { name: 'x', email: '', address: '', taxId: '', currency: 'IDR', termsDays: '14' }), 'Currency cannot change', 409)
    const free = await customer({ currency: 'USD' })
    await saveCustomer(actor, free, { name: 'x', email: '', address: '', taxId: '', currency: 'EUR', termsDays: '14' })
    expect((await sql`select currency from customers where id = ${free}`)[0].currency).toBe('EUR')
  })
})

async function quoteFor(customerId: number, o: Partial<Parameters<typeof createQuotation>[1]> = {}) {
  return createQuotation(actor, { recipient: `customer:${customerId}`, issuedAt: '2026-10-05', validUntil: '2026-11-05', taxPercent: '11', notes: 'Valid 30 days', items: 'Air freight | 100 | 25.50 | kg', ...o })
}

describe('bank accounts', () => {
  it('make the first account of a currency preferred and keep exactly one preferred per currency', async () => {
    const a = await bank({ accountNumber: 'AAAAA11111' })
    const b = await bank({ accountNumber: 'BBBBB22222' })
    const d = async (id: number) => (await sql`select is_default, active from bank_accounts where id = ${id}`)[0]
    expect(await d(a)).toMatchObject({ isDefault: true }); expect(await d(b)).toMatchObject({ isDefault: false })
    await updateBank(actor, b, 'default')
    expect(await d(a)).toMatchObject({ isDefault: false }); expect(await d(b)).toMatchObject({ isDefault: true })
    const c = await bank({ accountNumber: 'CCCCC33333', makeDefault: true })
    expect(await d(b)).toMatchObject({ isDefault: false }); expect(await d(c)).toMatchObject({ isDefault: true })
    await updateBank(actor, c, 'disable')
    expect(await d(c)).toMatchObject({ isDefault: false, active: false })
    await rejects(updateBank(actor, c, 'default'), 'inactive', 409)
    await updateBank(actor, c, 'enable')                                    // no preferred account is left, so c takes over
    expect(await d(c)).toMatchObject({ active: true, isDefault: true })
    await updateBank(actor, a, 'disable'); await updateBank(actor, a, 'enable')
    expect(await d(a)).toMatchObject({ active: true, isDefault: false })    // c is preferred: a does not take over
    const usd = await bank({ currency: 'usd', accountNumber: 'USD0000001', swiftCode: 'bcaidjak' })
    expect((await sql`select currency, swift_code, is_default from bank_accounts where id = ${usd}`)[0]).toMatchObject({ currency: 'USD', swiftCode: 'BCAIDJAK', isDefault: true })
    expect((await sql`select count(*)::int as n from bank_accounts where currency = 'IDR' and is_default and active`)[0].n).toBe(1)
  })
  it('validate details and refuse duplicates', async () => {
    await rejects(bank({ accountNumber: '12' }), 'invalid')
    await rejects(bank({ swiftCode: 'BAD' }), 'invalid')
    await rejects(bank({ bankName: ' ' }), 'invalid')
    await rejects(bank({ currency: 'RUPIAH' }), '3-letter')
    await bank({ accountNumber: 'DUP1234567' })
    await rejects(bank({ accountNumber: 'DUP 123 4567' }), 'already exists', 409)
    const id = await bank({ accountNumber: 'EDIT123456', bankName: 'Editable' })
    await updateBank(actor, id, 'save', { bankName: 'Renamed', accountNumber: '9999999999', accountHolder: 'PT X', currency: 'IDR', branch: '', swiftCode: '', notes: 'internal' })
    expect((await sql`select bank_name, account_number from bank_accounts where id = ${id}`)[0]).toMatchObject({ bankName: 'Renamed', accountNumber: '9999999999' })
    await rejects(updateBank(actor, 424242, 'save'), 'not found', 404)
  })
})

describe('quotations', () => {
  it('are numbered QUO-VORA-<owner>-<YYYYMM>-<random5>, calculated on the server and start as drafts with a QR token', async () => {
    const c = await customer({ currency: 'USD' })
    const id = await quoteFor(c)
    const [q] = await sql`select * from quotations where id = ${id}`
    const [owner] = await sql`select public_code from customers where id = ${c}`
    expect(q.number).toMatch(new RegExp(`^QUO-VORA-${owner.publicCode}-202610-\\d{5}$`))
    expect(q).toMatchObject({ status: 'draft', currency: 'USD', subtotalMinor: 255000, taxMinor: 28050, totalMinor: 283050 })
    expect((await sql`select * from quotation_items where quotation_id = ${id}`)[0]).toMatchObject({ description: 'Air freight', quantity: '100', unit: 'kg', priceMinor: 2550, amountMinor: 255000 })
    expect((await sql`select revoked from document_verification_tokens where kind = 'quotation' and document_id = ${id}`)[0].revoked).toBe(false)
  })
  it('can be addressed to a lead (always IDR) and reject bad input', async () => {
    const [lead] = await sql`insert into leads (type, name, email, message, company) values ('RFQ', 'Budi', 'budi@example.invalid', 'quote please', 'CV Budi') returning id`
    const id = await createQuotation(actor, { recipient: `lead:${lead.id}`, issuedAt: '', validUntil: '', taxPercent: '', notes: '', items: 'Handling | 1 | 1000 | lot' })
    const [q] = await sql`select * from quotations where id = ${id}`
    expect(q).toMatchObject({ currency: 'IDR', leadId: lead.id, customerId: null, issuedAt: today(), validUntil: today() })
    const c = await customer()
    for (const [o, msg] of [
      [{ recipient: 'nobody' }, 'Select a customer or lead'], [{ recipient: 'customer:99999' }, 'Recipient unavailable'], [{ items: '' }, '1–100'], [{ items: 'only | two' }, 'description | quantity'],
      [{ items: ' | 1 | 5 | x' }, 'needs a description'], [{ items: 'A | 0 | 5 | x' }, 'Invalid quantity or price'], [{ items: 'A | 1 | -5 | x' }, 'Invalid quantity or price'], [{ items: 'A | 1 | abc | x' }, 'Invalid monetary value'],
      [{ taxPercent: '101' }, 'Tax percentage out of range'], [{ issuedAt: '2026-02-30' }, 'valid date'], [{ validUntil: '2026-10-01' }, 'must not precede'],
    ] as Array<[Partial<Parameters<typeof createQuotation>[1]>, string]>) await rejects(quoteFor(c, o), msg)
    await rejects(quoteFor(c, { items: Array.from({ length: 101 }, (_, i) => `Item ${i} | 1 | 1 | x`).join('\n') }), '1–100')
  })
  it('follow the issue/void rules, and voiding revokes the QR link and any open approval link', async () => {
    const id = await quoteFor(await customer())
    await rejects(setQuotationStatus(actor, id, 'bogus'), 'cannot make that status transition', 409)
    await setQuotationStatus(actor, id, 'issue')
    await rejects(setQuotationStatus(actor, id, 'issue'), 'cannot make that status transition', 409)
    await sql`insert into quotation_approvals (quotation_id, token_hash, expires_at, status) values (${id}, ${'h'.repeat(64)}, now() + interval '1 day', 'pending')`
    await setQuotationStatus(actor, id, 'void')
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('void')
    expect((await sql`select revoked from document_verification_tokens where kind = 'quotation' and document_id = ${id}`)[0].revoked).toBe(true)
    expect((await sql`select status from quotation_approvals where quotation_id = ${id}`)[0].status).toBe('revoked')
    await rejects(setQuotationStatus(actor, id, 'void'), 'cannot make that status transition', 409)
    await rejects(setQuotationStatus(actor, 99999, 'issue'), 'not found', 404)
  })
})

describe('invoices', () => {
  it('compute tax, withholding and discount exactly, number themselves and snapshot the chosen banks', async () => {
    const c = await customer()
    const b1 = await bank({ accountNumber: 'INVBANK001' }); const b2 = await bank({ accountNumber: 'INVBANK002', bankName: 'Second Bank' })
    const id = await createInvoice(actor, invoiceInput(c, { discount: '500000', bankAccountIds: [b2, b1] }))
    const row = await inv(id)
    const [owner] = await sql`select public_code from customers where id = ${c}`
    expect(row.number).toMatch(new RegExp(`^INV-VORA-${owner.publicCode}-202610-\\d{5}$`))
    // subtotal 10,000,000 + 1,000,000 = 11,000,000; discount 500,000 -> net 10,500,000; tax 11% = 1,155,000; withholding 2% = 210,000
    expect(row).toMatchObject({ status: 'draft', subtotalMinor: 11_000_000, discountMinor: 500_000, taxMinor: 1_155_000, withholdingMinor: 210_000, totalMinor: 11_445_000, outstandingMinor: 11_445_000 })
    expect(row).toMatchObject({ poNumber: 'PO-77', shipmentReference: 'JOB-9', serviceMode: 'Sea Import FCL', origin: 'Shanghai', destination: 'Jakarta', transportDocumentRef: 'BL-1' })
    const banks = await sql`select bank_name, account_number, position from invoice_bank_instructions where invoice_id = ${id} order by position`
    expect(banks.map((x) => x.accountNumber)).toEqual(['INVBANK002', 'INVBANK001'])
    // later edits never change what was snapshotted
    await updateBank(actor, b2, 'save', { bankName: 'Changed', accountNumber: 'CHANGED0001', accountHolder: 'Other', currency: 'IDR', branch: '', swiftCode: '', notes: '' })
    expect((await sql`select account_number from invoice_bank_instructions where invoice_id = ${id} and position = 0`)[0].accountNumber).toBe('INVBANK002')
  })
  it('use the preferred bank when none is chosen and the customer terms when no due date is typed', async () => {
    const c = await customer({ termsDays: '30' })
    await bank({ accountNumber: 'PREFER0001', currency: 'IDR' })
    const id = await createInvoice(actor, invoiceInput(c, { dueAt: '', issuedAt: '2026-10-05' }))
    expect((await inv(id)).dueAt).toBe('2026-11-04')
    expect((await sql`select count(*)::int as n from invoice_bank_instructions where invoice_id = ${id}`)[0].n).toBe(1)
  })
  it('refuse unusable input', async () => {
    const c = await customer(); const usd = await bank({ currency: 'USD', accountNumber: 'USDBANK001' }); const idr = await bank({ accountNumber: 'IDRBANK0099' })
    await rejects(createInvoice(actor, invoiceInput(99999)), 'existing customer')
    await rejects(createInvoice(actor, invoiceInput(c, { bankAccountIds: [usd] })), 'invoice currency')
    await rejects(createInvoice(actor, invoiceInput(c, { bankAccountIds: [idr, idr] })), 'at most 8 distinct')
    await rejects(createInvoice(actor, invoiceInput(c, { bankAccountIds: [424242] })), 'invoice currency')
    await rejects(createInvoice(actor, invoiceInput(c, { dueAt: '2026-10-01' })), 'before the issue date')
    await rejects(createInvoice(actor, invoiceInput(c, { discount: '99999999999' })), 'Discount exceeds subtotal')
    await rejects(createInvoice(actor, invoiceInput(c, { discount: '-100' })), 'cannot be negative')
    await rejects(createInvoice(actor, invoiceInput(c, { withholdingPercent: '-1' })), 'out of range')
    await rejects(createInvoice(actor, invoiceInput(c, { items: 'x | 1e9 | 1 | u' })), 'Invalid')
    expect((await sql`select count(*)::int as n from invoices`)[0].n).toBe(0)       // nothing half-created
  })
  it('follow issue and void rules; voiding cancels open payment claims but never touches confirmed money', async () => {
    const c = await customer()
    const draft = await createInvoice(actor, invoiceInput(c))
    await rejects(pay(draft, '1000'), 'must be issued', 409)
    await setInvoiceStatus(actor, draft, 'issue')
    const p = await pay(draft, '1000000')
    await setInvoiceStatus(actor, draft, 'void')
    expect((await sql`select status from payments where id = ${p}`)[0].status).toBe('cancelled')
    expect((await sql`select revoked from document_verification_tokens where kind = 'invoice' and document_id = ${draft}`)[0].revoked).toBe(true)
    await rejects(setInvoiceStatus(actor, draft, 'void'), 'Invalid state change', 409)

    const paid = await issued(c)
    await confirm(await pay(paid, '1000000', { method: 'cash' }))
    await rejects(setInvoiceStatus(actor, paid, 'void'), 'Reverse confirmed payments', 409)
  })
})

describe('payment control', () => {
  it('a recorded payment is only a claim: nothing is credited, no receipt exists, nothing is emailed', async () => {
    await smtp(); await rule('payment_confirmed'); await rule('receipt_customer')
    const c = await customer(); const id = await issued(c)
    const before = await inv(id)
    const p = await pay(id, '4000000')
    expect(await inv(id)).toMatchObject({ outstandingMinor: before.outstandingMinor, status: 'issued' })
    expect(await sql`select id from receipts`).toHaveLength(0)
    expect(await sql`select id from email_jobs where event in ('payment_confirmed','receipt_customer')`).toHaveLength(0)
    expect((await sql`select status, confirmed_at from payments where id = ${p}`)[0]).toMatchObject({ status: 'pending_confirmation', confirmedAt: null })
  })
  it('open claims reserve the balance, so the same money cannot be claimed twice', async () => {
    const c = await customer(); const id = await issued(c)                  // total 11,445,000 - 2% => see below
    const total = (await inv(id)).totalMinor as number
    await pay(id, String(total - 1000))
    await pay(id, '1000')
    await rejects(pay(id, '1'), 'exceeds the unreserved')
    await rejects(pay(id, '0'), 'exceeds the unreserved')
    await rejects(pay(id, '-5'), 'exceeds the unreserved')
    await rejects(pay(id, 'abc'), 'Invalid monetary value')
    const fresh = await issued(c)
    await rejects(pay(fresh, '10', { date: '2999-01-01' }), 'future')
    await rejects(pay(fresh, '10', { date: '31/12/2026' }), 'valid date')
    await rejects(pay(fresh, '10', { receivingBankId: 12345 }), 'receiving bank')
    await pay(fresh, '10', { date: today() })
    await rejects(recordPayment(actor, 99999, { amount: '1', date: '', method: '', reference: '', receivingBankId: null }), 'not found', 404)
  })
  it('a pending claim can be cancelled once and frees the reserved amount', async () => {
    const c = await customer(); const id = await issued(c)
    const total = (await inv(id)).totalMinor as number
    const p = await pay(id, String(total))
    await rejects(pay(id, '1'), 'exceeds the unreserved')
    expect(await cancelPayment(actor, p)).toBe(id)
    await rejects(cancelPayment(actor, p), 'Only unconfirmed', 409)
    await pay(id, '1')
    await rejects(cancelPayment(actor, 99999), 'not found', 404)
  })
  it('confirming needs the funds checkbox, then updates the invoice, issues a receipt and queues both emails', async () => {
    await smtp(); await rule('payment_confirmed'); await rule('receipt_customer')
    const c = await customer(); const b = await bank({ accountNumber: 'RECV000001' }); const id = await issued(c)
    const total = (await inv(id)).totalMinor as number
    const p1 = await pay(id, '4000000', { receivingBankId: b })
    await rejects(confirmPayment(actor, p1, { fundsCleared: false, receivingBankId: null }, BASE), 'funds are credited')
    const r = await confirm(p1)
    expect(r.stampRequired).toBe(false)
    expect(await inv(id)).toMatchObject({ status: 'partially_paid', outstandingMinor: total - 4_000_000 })
    const [rc] = await sql`select * from receipts where id = ${r.receiptId}`
    const [owner] = await sql`select public_code from customers where id = ${c}`
    expect(rc.number).toMatch(new RegExp(`^RCP-VORA-${owner.publicCode}-\\d{6}-\\d{5}$`))
    expect(rc).toMatchObject({ status: 'issued', stampRequired: false, invoiceId: id, paymentId: p1 })
    expect((await sql`select status, confirmed_by from payments where id = ${p1}`)[0]).toMatchObject({ status: 'recorded', confirmedBy: actor })
    const jobs = await sql`select event, recipient, attachment_kind, attachment_id, html from email_jobs order by id`
    expect(jobs.map((j) => j.event)).toEqual(['payment_confirmed', 'receipt_customer'])
    expect(jobs[0].html).toContain('PARTIALLY PAID'); expect(jobs[0].html).toContain('IDR 4,000,000')
    expect(jobs[1]).toMatchObject({ attachmentKind: 'receipt', attachmentId: r.receiptId, recipient: 'billing@pelanggan.example' })
    expect(jobs[1].html).toContain(`${BASE}/verify/`)
    const p2 = await pay(id, String(total - 4_000_000), { receivingBankId: b })
    await confirm(p2)
    expect(await inv(id)).toMatchObject({ status: 'paid', outstandingMinor: 0 })
    await rejects(pay(id, '1'), 'must be issued', 409)
  })
  it('refuses a second confirmation, a bank transfer without a receiving account, and a mismatched account', async () => {
    const c = await customer(); const b = await bank({ accountNumber: 'RECV000002' }); const usd = await bank({ currency: 'USD', accountNumber: 'USDRECV001' })
    const id = await issued(c)
    const p = await pay(id, '1000000')
    await rejects(confirm(p), 'Select the VORA bank account', 422)
    await rejects(confirm(p, usd), 'does not match the invoice currency')
    await confirm(p, b)                                             // the receiving account may be chosen at confirmation
    await rejects(confirm(p, b), 'already confirmed', 409)
    expect((await sql`select receiving_bank_snapshot from payments where id = ${p}`)[0].receivingBankSnapshot).toMatchObject({ account_number: 'RECV000002' })
    const other = await pay(id, '500000', { method: 'cash' })
    await confirm(other)                                            // other methods need no receiving bank
    await rejects(confirm(99999), 'not found', 404)
  })
  it('exactly one of six simultaneous confirmations of the same payment succeeds', async () => {
    const c = await customer(); const b = await bank({ accountNumber: 'RACE0000001' }); const id = await issued(c)
    const p = await pay(id, '2000000', { receivingBankId: b })
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => confirm(p)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected').every((r) => /already confirmed/.test((r as PromiseRejectedResult).reason.message))).toBe(true)
    expect(await sql`select id from receipts where payment_id = ${p}`).toHaveLength(1)
    expect((await inv(id)).outstandingMinor).toBe((await inv(id)).totalMinor as number - 2_000_000)
  })
  it('a payment cannot be confirmed above what is still owed', async () => {
    const c = await customer(); const b = await bank({ accountNumber: 'OVER0000001' }); const id = await issued(c)
    const total = (await inv(id)).totalMinor as number
    const p = await pay(id, String(total), { receivingBankId: b })
    // Sneak in a second claim by editing the data directly, as a bug or manual SQL might.
    const [{ id: p2 }] = await sql`insert into payments (invoice_id, amount_minor, date, method, reference, status) values (${id}, 5000, '2026-10-05', 'cash', 'x', 'pending_confirmation') returning id`
    await confirm(p)
    await rejects(confirm(p2 as number), 'exceeds the invoice balance', 409)
  })
})

describe('e-meterai rules', () => {
  it('apply to foreign currency and to amounts above IDR 5,000,000 only', () => {
    expect(requiresStamp('IDR', 5_000_000)).toBe(false); expect(requiresStamp('IDR', 5_000_001)).toBe(true)
    expect(requiresStamp('USD', 1)).toBe(true); expect(requiresStamp('EUR', 100)).toBe(true)
  })
  it('withhold the receipt and its email until a validated stamped PDF is uploaded', async () => {
    await smtp(); await rule('payment_confirmed'); await rule('receipt_customer')
    const c = await customer(); const b = await bank({ accountNumber: 'STAMP000001' }); const id = await issued(c)
    const r = await confirm(await pay(id, '6000000', { receivingBankId: b }))
    expect(r.stampRequired).toBe(true)
    const [rc] = await sql`select * from receipts where id = ${r.receiptId}`
    expect(rc).toMatchObject({ status: 'pending_stamp', stampRequired: true, stampStorageKey: null })
    expect((await sql`select event from email_jobs order by id`).map((j) => j.event)).toEqual(['payment_confirmed'])   // no receipt email yet
    await rejects(readStampedReceipt(rc as never), 'not been released', 409)

    const good = await makePdf([`RECEIPT ${rc.number}`, 'Invoice ' + (await inv(id)).number, 'e-Meterai 10000'])
    const stamp = (o: Partial<Parameters<typeof uploadReceiptStamp>[2]> = {}) => uploadReceiptStamp(actor, r.receiptId, { providerReference: 'PERURI-20261005-0001', reviewed: true, file: good, ...o }, BASE)
    await rejects(stamp({ reviewed: false }), 'all required')
    await rejects(stamp({ providerReference: 'x' }), 'all required')
    await rejects(stamp({ file: null }), 'all required')
    await rejects(stamp({ file: new TextEncoder().encode('<html>not a pdf</html>'.padEnd(400)) }), 'Only PDF documents')
    await rejects(stamp({ file: await makePdf(['unrelated text']) }), 'must retain VORA receipt and related invoice numbers')
    await rejects(stamp({ file: await makePdf([`RECEIPT ${rc.number}`]) }), 'must retain VORA receipt and related invoice numbers')
    await rejects(stamp({ file: await makePdf([rc.number as string, (await inv(id)).number as string], { openActionScript: true }) }), 'Active or executable')
    await rejects(stamp({ file: await makePdf([rc.number as string, (await inv(id)).number as string], { namedScript: true }) }), 'Active or executable')
    await rejects(stamp({ file: await makePdf([rc.number as string, (await inv(id)).number as string], { pages: 13 }) }), '1-12 pages')
    await rejects(stamp({ file: await makePdf([rc.number as string, (await inv(id)).number as string], { encrypted: true }) }), /unencrypted|damaged/)
    const broken = good.slice(0, Math.floor(good.length / 2))
    await rejects(stamp({ file: broken }), /damaged|PDF/)
    expect((await sql`select status from receipts where id = ${r.receiptId}`)[0].status).toBe('pending_stamp')   // every refusal left it untouched

    await stamp()
    const [done] = await sql`select * from receipts where id = ${r.receiptId}`
    expect(done).toMatchObject({ status: 'issued', stampProviderReference: 'PERURI-20261005-0001', stampUploadedBy: actor })
    expect(done.stampSha256).toBe(await sha256Hex(good))
    expect(done.stampStorageKey).toMatch(/^receipt-stamps\/\d+\/[A-Za-z0-9_-]+\.pdf$/)
    expect(Buffer.from(await readStampedReceipt(done as never)).equals(Buffer.from(good))).toBe(true)
    const files = readdirSync(join(process.env.VORA_LOCAL_STORAGE_DIR!, 'documents', 'receipt-stamps', String(r.receiptId)))
    expect(files).toHaveLength(1)
    expect((await sql`select event, attachment_kind from email_jobs order by id`).map((j) => j.event)).toEqual(['payment_confirmed', 'receipt_customer'])
    await rejects(stamp(), 'not waiting for a manual e-meterai', 409)                       // one shot

    // Tampering with the stored file is detected on every read.
    const path = join(process.env.VORA_LOCAL_STORAGE_DIR!, 'documents', done.stampStorageKey as string)
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('tampered')]))
    await rejects(readStampedReceipt(done as never), 'integrity check', 409)
  })
  it('apply to every foreign-currency receipt', async () => {
    const c = await customer({ currency: 'USD' }); const b = await bank({ currency: 'USD', accountNumber: 'USDSTAMP001' })
    const id = await issued(c, { items: 'Freight | 1 | 100 | job', taxPercent: '0', withholdingPercent: '0', bankAccountIds: [b] })
    const r = await confirm(await pay(id, '10', { receivingBankId: b }))
    expect(r.stampRequired).toBe(true)
  })
})

describe('voiding a receipt', () => {
  it('reverses the payment, restores the balance and revokes the QR link; once only', async () => {
    const c = await customer(); const b = await bank({ accountNumber: 'VOID0000001' }); const id = await issued(c)
    const total = (await inv(id)).totalMinor as number
    const r = await confirm(await pay(id, String(total), { receivingBankId: b }))
    expect(await inv(id)).toMatchObject({ status: 'paid', outstandingMinor: 0 })
    await voidReceipt(actor, r.receiptId)
    expect(await inv(id)).toMatchObject({ status: 'issued', outstandingMinor: total })
    expect((await sql`select status from receipts where id = ${r.receiptId}`)[0].status).toBe('void')
    expect((await sql`select status from payments where invoice_id = ${id}`)[0].status).toBe('void')
    expect((await sql`select revoked from document_verification_tokens where kind = 'receipt' and document_id = ${r.receiptId}`)[0].revoked).toBe(true)
    await rejects(voidReceipt(actor, r.receiptId), 'already void', 409)
    await rejects(voidReceipt(actor, 99999), 'not found', 404)
    await pay(id, '1')                                               // the invoice is open again
  })
  it('keeps the invoice partially paid when another payment stays confirmed', async () => {
    const c = await customer(); const b = await bank({ accountNumber: 'VOID0000002' }); const id = await issued(c)
    const r1 = await confirm(await pay(id, '1000000', { receivingBankId: b }))
    const r2 = await confirm(await pay(id, '2000000', { receivingBankId: b }))
    await voidReceipt(actor, r1.receiptId)
    const total = (await inv(id)).totalMinor as number
    expect(await inv(id)).toMatchObject({ status: 'partially_paid', outstandingMinor: total - 2_000_000 })
    expect((await sql`select status from receipts where id = ${r2.receiptId}`)[0].status).toBe('issued')
  })
})

async function smtp(enabled = true) {
  await saveMailConfig(sql, { host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled })
}
async function rule(key: string, enabled = true) { await sql`update email_rules set enabled = ${enabled} where key = ${key}` }

describe('emailing an invoice', () => {
  beforeEach(async () => { setSender(null); await sql`delete from email_jobs`; await sql`delete from mail_config`; await sql`update email_rules set enabled = false` })
  it('needs SMTP, the rule, an issued invoice and a billing email; sends once per minute and attaches nothing until rendered', async () => {
    const c = await customer(); const noMail = await customer({ email: '' })
    const id = await createInvoice(actor, invoiceInput(c))
    await rejects(sendInvoice(actor, id, BASE), 'Issue the invoice', 409)
    await setInvoiceStatus(actor, id, 'issue')
    await rejects(sendInvoice(actor, id, BASE), 'Enable SMTP', 409)
    await smtp(); await rule('invoice_customer')
    await sendInvoice(actor, id, BASE); await sendInvoice(actor, id, BASE)
    const jobs = await sql`select event, recipient, attachment_kind, subject, html from email_jobs`
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ event: 'invoice_customer', recipient: 'billing@pelanggan.example', attachmentKind: 'invoice' })
    expect(jobs[0].subject).toContain((await inv(id)).number as string); expect(jobs[0].html).toContain('/verify/')
    const none = await issued(noMail)
    await rejects(sendInvoice(actor, none, BASE), 'no billing email')
    await rejects(sendInvoice(actor, 99999, BASE), 'not found', 404)
  })
})

describe('customer quotation approval', () => {
  beforeEach(async () => { setSender(null); await sql`delete from email_jobs`; await sql`delete from mail_config`; await sql`update email_rules set enabled = false` })
  async function ready() {
    const c = await customer(); const id = await quoteFor(c, { validUntil: '2999-01-01' })
    await setQuotationStatus(actor, id, 'issue')
    return { c, id, number: (await sql`select number from quotations where id = ${id}`)[0].number as string }
  }
  const tokenFrom = async () => {
    const [job] = await sql`select html from email_jobs where event = 'quotation_approval_request' order by id desc limit 1`
    return /quotation-approval\/([A-Za-z0-9_-]+)/.exec(job.html as string)![1]
  }

  it('is refused until SMTP and the rule are on, the quotation is issued and still valid, and the recipient has an email', async () => {
    const c = await customer(); const draft = await quoteFor(c, { validUntil: '2999-01-01' })
    await rejects(requestApproval(actor, draft, BASE), 'Issue the quotation', 409)
    await setQuotationStatus(actor, draft, 'issue')
    await rejects(requestApproval(actor, draft, BASE), 'Configure SMTP', 409)
    await smtp(); await rule('quotation_approval_request')
    const old = await quoteFor(c, { issuedAt: '2020-01-01', validUntil: '2020-02-01' }); await setQuotationStatus(actor, old, 'issue')
    await rejects(requestApproval(actor, old, BASE), 'validity has expired', 409)
    const noMail = await quoteFor(await customer({ email: '' }), { validUntil: '2999-01-01' }); await setQuotationStatus(actor, noMail, 'issue')
    await rejects(requestApproval(actor, noMail, BASE), 'needs an email address')
    await rejects(requestApproval(actor, 99999, BASE), 'not found', 404)
    expect(await sql`select id from quotation_approvals`).toHaveLength(0)         // refusals leave nothing behind
  })

  it('sends a private expiring link; the upload only submits; Finance approves after a manual review; the file is integrity-checked', async () => {
    await smtp(); await rule('quotation_approval_request'); await rule('quotation_approved_admin')
    const { id, number } = await ready()
    await requestApproval(actor, id, BASE)
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('awaiting_approval')
    const [job] = await sql`select attachment_kind, attachment_id, recipient from email_jobs`
    expect(job).toMatchObject({ attachmentKind: 'quotation', attachmentId: id, recipient: 'billing@pelanggan.example' })
    const token = await tokenFrom()
    expect(token.length).toBeGreaterThanOrEqual(56)
    const stored = (await sql`select token_hash, expires_at from quotation_approvals`)[0]
    expect(stored.tokenHash).toBe(await sha256Hex(token)); expect(JSON.stringify(stored)).not.toContain(token)
    const view = await approvalByToken(token)
    expect(view && approvalIsOpen(view)).toBe(true)
    expect(await approvalByToken('short')).toBeNull(); expect(await approvalByToken('x'.repeat(60))).toBeNull()

    const signed = await makePdf([`QUOTATION ${number}`, 'Signed', 'Stamped'])
    const submit = (o: Partial<Parameters<typeof submitApproval>[0]> = {}) => submitApproval({ token, signerName: 'Siti Rahma', signerTitle: 'Finance Director', acknowledged: true, file: signed, ...o })
    await rejects(submit({ acknowledged: false }), 'confirmation required')
    await rejects(submit({ signerName: 'Al' }), 'are required')
    await rejects(submit({ signerTitle: '' }), 'are required')
    await rejects(submit({ file: null }), 'are required')
    await rejects(submit({ file: await makePdf(['some other document']) }), 'exact VORA quotation number')
    await rejects(submit({ file: await makePdf([number], { openActionScript: true }) }), 'Active or executable')
    await rejects(submit({ token: 'z'.repeat(60) }), 'not valid', 404)
    expect((await sql`select status from quotation_approvals`)[0].status).toBe('pending')

    await submit()
    const [sub] = await sql`select * from quotation_approvals`
    expect(sub).toMatchObject({ status: 'submitted', signerName: 'Siti Rahma', signerTitle: 'Finance Director' })
    expect(sub.signedPdfSha256).toBe(await sha256Hex(signed))
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('awaiting_approval')      // an upload alone approves nothing
    await rejects(submit(), 'expired or was already used', 410)                                                  // the link is single use
    expect((await readApprovalFile(sub.id as number)).quotationNumber).toBe(number)

    await rejects(reviewApproval(actor, sub.id as number, 'approve', false, ''), 'reviewed manually')
    await rejects(reviewApproval(actor, sub.id as number, 'maybe', true, ''), 'Invalid review outcome')
    await reviewApproval(actor, sub.id as number, 'approve', true, 'Looks right')
    expect((await sql`select status, review_note, reviewed_by from quotation_approvals`)[0]).toMatchObject({ status: 'approved', reviewNote: 'Looks right', reviewedBy: actor })
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('approved')
    expect((await sql`select event from email_jobs order by id`).map((j) => j.event)).toEqual(['quotation_approval_request', 'quotation_approved_admin'])
    await rejects(reviewApproval(actor, sub.id as number, 'approve', true, ''), 'Only submitted', 409)

    const path = join(process.env.VORA_LOCAL_STORAGE_DIR!, 'documents', sub.signedPdfKey as string)
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('x')]))
    await rejects(readApprovalFile(sub.id as number), 'does not match its recorded fingerprint', 409)
    await rejects(readApprovalFile(99999), 'No signed PDF', 404)
  })

  it('a rejection returns the quotation to issued so a new request can be sent; a newer link revokes older ones', async () => {
    await smtp(); await rule('quotation_approval_request')
    const { id, number } = await ready()
    await requestApproval(actor, id, BASE); const first = await tokenFrom()
    await requestApproval(actor, id, BASE); const second = await tokenFrom()
    expect(first).not.toBe(second)
    expect((await sql`select status from quotation_approvals order by id`).map((r) => r.status)).toEqual(['revoked', 'pending'])
    const pdf = await makePdf([number])
    await rejects(submitApproval({ token: first, signerName: 'Siti Rahma', signerTitle: 'CFO', acknowledged: true, file: pdf }), 'expired or was already used', 410)
    await submitApproval({ token: second, signerName: 'Siti Rahma', signerTitle: 'CFO', acknowledged: true, file: pdf })
    const [sub] = await sql`select id from quotation_approvals where status = 'submitted'`
    await reviewApproval(actor, sub.id as number, 'reject', false, 'Stamp missing')
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('issued')
    expect((await sql`select status, review_note from quotation_approvals where id = ${sub.id as number}`)[0]).toMatchObject({ status: 'rejected', reviewNote: 'Stamp missing' })
    await requestApproval(actor, id, BASE)                          // allowed again
  })

  it('links stop working when expired or when the quotation is voided', async () => {
    await smtp(); await rule('quotation_approval_request')
    const { id, number } = await ready()
    await requestApproval(actor, id, BASE); const token = await tokenFrom()
    await sql`update quotation_approvals set expires_at = now() - interval '1 minute'`
    expect(approvalIsOpen((await approvalByToken(token))!)).toBe(false)
    await rejects(submitApproval({ token, signerName: 'Siti Rahma', signerTitle: 'CFO', acknowledged: true, file: await makePdf([number]) }), 'expired or was already used', 410)
    await sql`update quotation_approvals set expires_at = now() + interval '1 day'`
    await setQuotationStatus(actor, id, 'void')
    expect(approvalIsOpen((await approvalByToken(token))!)).toBe(false)
  })

  it('the link never outlives the quotation validity by more than a day', async () => {
    await smtp(); await rule('quotation_approval_request')
    const c = await customer(); const id = await quoteFor(c, { issuedAt: today(), validUntil: today() })
    await setQuotationStatus(actor, id, 'issue')
    await requestApproval(actor, id, BASE)
    const [a] = await sql`select expires_at from quotation_approvals`
    expect((a.expiresAt as Date).getTime()).toBeLessThanOrEqual(Date.now() + 2 * 86_400_000)
  })
})

describe('outstanding recomputation', () => {
  it('refuses a ledger where confirmed payments exceed the invoice', async () => {
    const c = await customer(); const id = await issued(c)
    await sql`insert into payments (invoice_id, amount_minor, date, method, reference, status) values (${id}, 999999999, '2026-10-05', 'cash', 'x', 'recorded')`
    await rejects(recomputeOutstanding(sql, id), 'exceed the invoice total', 409)
  })
})

describe('sent emails carry real attachments only after the PDF renderers exist', () => {
  it('dispatch skips documents that must not be released', async () => {
    setSender(null); await sql`delete from email_jobs`
    await smtp(); await rule('receipt_customer')
    const c = await customer(); const b = await bank({ accountNumber: 'ATTACH00001' }); const id = await issued(c)
    const r = await confirm(await pay(id, '6000000', { receivingBankId: b }))        // pending e-meterai
    await sql`insert into email_jobs (event, recipient, subject, html, attachment_kind, attachment_id, status, attempts) values ('receipt_customer', 'x@example.invalid', 's', 'h', 'receipt', ${r.receiptId}, 'queued', 0)`
    let sent = 0
    setSender(async () => { sent++ })
    const out = await dispatch(BASE, 10)
    expect(out).toMatchObject({ sent: 0, failed: 1 }); expect(sent).toBe(0)
    expect((await sql`select error from email_jobs`)[0].error).toMatch(/not eligible/)
  })
})
