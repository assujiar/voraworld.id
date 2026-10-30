import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBank } from '@/server/finance/banks'
import { createDelivery, setDeliveryStatus, submitProof, type DeliveryInput, type ProofInput } from '@/server/delivery/deliveries'
import { saveCustomer, type CustomerFields } from '@/server/finance/customers'
import { createInvoice, sendInvoice, setInvoiceStatus, type InvoiceInput } from '@/server/finance/invoices'
import { confirmPayment, recordPayment } from '@/server/finance/payments'
import { uploadPrepaymentStamp } from '@/server/finance/prepayments'
import { createQuotation, requestApproval, reviewApproval, setQuotationStatus, submitApproval } from '@/server/finance/quotations'
import { resendReceipt, uploadReceiptStamp } from '@/server/finance/receipts'
import { convertLead, createLead } from '@/server/leads'
import { saveMailConfig } from '@/server/mail/config'
import { dispatch } from '@/server/mail/outbox'
import { setSender } from '@/server/mail/transport'
import { createUser } from './helpers/actions'
import { sql } from './helpers/db'
import { makePdf } from './helpers/pdf'

/**
 * Phase 3A: ONE commercial workflow with TWO entry points. A lead is an optional source of business; the customer is the commercial entity.
 *   Path A: public inquiry -> lead -> customer -> quotation -> ...      Path B: customer entered by hand -> quotation -> ...      Path C: an existing customer again.
 * From the quotation onward the three paths run the very same code: customer approval, VORA validation, delivery notes with a proof of delivery,
 * an invoice that bills them with its pre-payment receipt, ONE email with the two PDFs, payments confirmed apart from being recorded, official receipts, e-meterai.
 * Storage is a map and the SMTP socket is a recorder; everything else (database functions, PostgREST, PDFs, the outbox) runs for real.
 */
process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
const files = vi.hoisted(() => new Map<string, Uint8Array>())
vi.mock('@/server/storage', async (original) => (await import('./helpers/memory-storage')).memoryStorage(await original(), files))

const BASE = 'https://voraworld.id'
let actor: number
type Sent = { to: string; subject: string; html: string; pdfs: string[] }
const sent: Sent[] = []

const noise = (w: number, h: number) => { const raw = Buffer.alloc(w * h * 3); for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24; return sharp(raw, { raw: { width: w, height: h, channels: 3 } }) }
let png: string, jpeg: string

beforeAll(async () => {
  actor = (await createUser('commercial@example.invalid', 'admin')).id
  png = 'data:image/png;base64,' + (await noise(120, 60).png().toBuffer()).toString('base64')
  jpeg = 'data:image/jpeg;base64,' + (await noise(300, 200).jpeg({ quality: 60 }).toBuffer()).toString('base64')
})
beforeEach(async () => {
  sent.length = 0
  setSender(async (_conf, to, subject, html, attachment) => { sent.push({ to, subject, html, pdfs: (Array.isArray(attachment) ? attachment : attachment ? [attachment] : []).map((a) => a.filename) }) })
  await sql`truncate customers, leads, bank_accounts, quotations, deliveries, invoices, payments, receipts, document_verification_tokens, email_jobs, mail_config restart identity cascade`
  files.clear()
  await saveMailConfig({ host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@voraworld.id', enabled: true })
  await sql`update email_rules set enabled = key in ('quotation_approval_request', 'quotation_customer_approved_admin', 'quotation_validated_customer', 'invoice_customer', 'receipt_customer', 'payment_confirmed', 'lead_admin', 'lead_customer')`
  await createBank(actor, { bankName: 'Bank Commercial', accountNumber: '5550001111', accountHolder: 'PT Satu Arah International', currency: 'IDR', branch: '', swiftCode: '', notes: '' })
})

const rejects = async (p: Promise<unknown>, message: RegExp | string, status?: number) => {
  const e = await p.then(() => null, (x: Error & { status?: number }) => x)
  expect(e, 'expected a refusal').not.toBeNull()
  expect(e!.message).toMatch(message)
  if (status) expect(e!.status).toBe(status)
}

/** Digits that differ per company, so that two test companies never look like the same one. */
const seed = (text: string, n: number) => String([...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)).padStart(n, '0').slice(0, n)
const company = (name: string, o: Partial<CustomerFields> = {}): CustomerFields => ({
  name, email: `billing@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, address: 'Jl. Contoh 1, Jakarta', taxId: `01.234.${seed(name, 3)}.8-901.000`, currency: 'IDR', termsDays: '14', phone: `+62 21 ${seed(name, 7)}`,
  picName: 'Rina Wijaya', picPosition: 'Finance Manager', picEmail: `rina@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, picPhone: `+62 812 ${seed(name + 'p', 8)}`, ...o,
})

const quotation = (customerId: number, rows: Array<{ description: string; quantity: string; unit: string; price: string }>, leadId: number | null = null) => createQuotation(actor, {
  customerId, leadId, issuedAt: '2026-10-05', validUntil: '2999-01-01', taxPercent: '0', paymentTerms: 'Within 14 days of the invoice date', termsConditions: 'Rates are valid for the period stated.', notes: '',
  rows, picName: 'Rina Wijaya', picEmail: 'rina@pt.example', picPhone: '+62 812 1111 2222', serviceMode: 'Sea import FCL', origin: 'Shanghai', destination: 'Jakarta', cargoInfo: '2 x 40HC machinery',
})

/** Issues the quotation, has the customer sign it through its private link, and has VORA validate it. Nothing becomes validated by the upload alone. */
async function validate(id: number, opts: { reject?: boolean } = {}) {
  const [{ number }] = await sql`select number from quotations where id = ${id}`
  await setQuotationStatus(actor, id, 'issue')
  await requestApproval(actor, id, BASE)
  const [job] = await sql`select html, recipient from email_jobs where event = 'quotation_approval_request' order by id desc limit 1`
  expect(job.recipient).toBe('rina@pt.example')                                               // the contact person it is addressed to
  const token = /quotation-approval\/([A-Za-z0-9_-]+)/.exec(job.html as string)![1]
  await submitApproval({ token, signerName: 'Siti Rahma', signerTitle: 'Finance Director', acknowledged: true, file: await makePdf([`QUOTATION ${number}`, 'Signed', 'Stamped']) })
  expect((await sql`select status, validated_at, validated_by from quotations where id = ${id}`)[0]).toMatchObject({ status: 'customer_approved', validatedAt: null, validatedBy: null })
  expect((await sql`select event from email_jobs order by id`).map((j) => j.event)).toContain('quotation_customer_approved_admin')
  const [approval] = await sql`select id from quotation_approvals where quotation_id = ${id} and status = 'submitted'`
  if (opts.reject) {
    await reviewApproval(actor, approval.id as number, 'reject', false, 'The company stamp is missing')
    expect((await sql`select status from quotations where id = ${id}`)[0].status).toBe('rejected')
    return
  }
  await reviewApproval(actor, approval.id as number, 'approve', true, 'Signature and stamp checked')
  expect((await sql`select status, validated_by from quotations where id = ${id}`)[0]).toMatchObject({ status: 'validated', validatedBy: actor })
  expect((await sql`select event, recipient from email_jobs where dedupe_key = ${'quotation-validated-' + approval.id}`)).toEqual([{ event: 'quotation_validated_customer', recipient: 'rina@pt.example' }])
}

const note = (customerId: number, quotationId: number, o: Partial<DeliveryInput> = {}): DeliveryInput => ({
  customerId, quotationId, shipperName: 'PT Pengirim Utama', shipperAddress: 'Jl. Pabrik 9, Kawasan Industri, Cikarang, Jawa Barat 17530', shipperContact: 'Rina', shipperPhone: '+62 21 888', shipperEmail: 'gudang@pengirim.example', consigneeName: 'PT Penerima', consigneeAddress: 'Jl. Gudang 5', consigneeContact: 'Budi', consigneePhone: '+62 21 555', consigneeEmail: 'gudang@penerima.example', origin: 'Jakarta',
  destination: 'Bekasi', shipmentReference: 'JOB-1', poNumber: 'PO-9', carrier: 'VORA Trucking', vehicle: 'Wingbox', vehiclePlate: 'B 1234 XYZ', driverName: 'Asep', driverPhone: '0812 1111 2222',
  deliveryDate: '2026-10-10', notes: '', items: [{ description: 'Cartons of parts', quantity: '24', unit: 'ctn', remarks: 'fragile' }], ...o,
})
const proof = (token: string): ProofInput => ({
  token, courierName: 'Asep Kurniawan', courierPhone: '0812 1111 2222', receiverName: 'Siti Aminah', receiverPosition: 'Warehouse head', receiverPhone: '+62 812 3456', receiverEmail: '', receiverIdNumber: '',
  condition: 'good', conditionNote: '', signature: png, photos: [jpeg], latitude: '-6.2', longitude: '106.8', accuracy: '12', locationStatus: 'captured', locationNote: '', deviceTime: new Date().toISOString(), ip: '203.0.113.9', userAgent: 'test',
})
/** A delivery note, issued and signed for by the driver's phone. */
async function delivered(customerId: number, quotationId: number): Promise<number> {
  const id = await createDelivery(actor, note(customerId, quotationId))
  await setDeliveryStatus(actor, id, 'issue')
  const [d] = await sql`select capture_token from deliveries where id = ${id}`
  await submitProof(proof(d.captureToken as string), BASE)
  expect((await sql`select status from deliveries where id = ${id}`)[0].status).toBe('delivered')
  return id
}

const invoiceOf = (customerId: number, quotationId: number, deliveryIds: number[], rows: Array<{ description: string; quantity: string; unit: string; price: string }>, o: Partial<InvoiceInput> = {}): InvoiceInput => ({
  customerId, quotationId, deliveryIds, issuedAt: '2026-10-20', dueAt: '', taxPercent: '0', withholdingPercent: '0', discount: '0', poNumber: 'PO-9', shipmentReference: 'JOB-1', serviceMode: 'Sea import FCL',
  origin: 'Shanghai', destination: 'Jakarta', transportDocumentRef: '', notes: '', rows, bankAccountIds: [], ...o,
})

/** Records a payment, confirms the funds, and (when a stamp is required) uploads the stamped receipt. Returns the receipt. */
async function payAndReceive(invoiceId: number, amount: string) {
  const [bank] = await sql`select id from bank_accounts order by id limit 1`
  const [before] = await sql`select outstanding_minor, status from invoices where id = ${invoiceId}`
  const paymentId = await recordPayment(actor, invoiceId, { amount, date: '', method: 'bank transfer', reference: 'TRX-' + amount, receivingBankId: bank.id as number })
  expect((await sql`select status from payments where id = ${paymentId}`)[0].status).toBe('pending_confirmation')           // recorded, not confirmed
  expect((await sql`select outstanding_minor, status from invoices where id = ${invoiceId}`)[0]).toMatchObject({ outstandingMinor: before.outstandingMinor, status: before.status })
  expect(await sql`select id from receipts where payment_id = ${paymentId}`).toHaveLength(0)                              // no official receipt yet
  const confirmation = await confirmPayment(actor, paymentId, { fundsCleared: true, receivingBankId: null }, BASE)
  const [receipt] = await sql`select * from receipts where id = ${confirmation.receiptId}`
  return { paymentId, receipt, stampRequired: confirmation.stampRequired }
}

/** The whole path from a validated quotation to the customer's official receipt. `big` makes the amounts need an e-meterai (above IDR 5,000,000). */
async function fromQuotationToReceipt(customerId: number, leadId: number | null, big: boolean) {
  const rows = big ? [{ description: 'Ocean freight', quantity: '1', unit: 'shipment', price: '10000000' }, { description: 'Documentation', quantity: '1', unit: 'job', price: '2000000' }]
    : [{ description: 'Ocean freight', quantity: '1', unit: 'shipment', price: '2000000' }, { description: 'Documentation', quantity: '1', unit: 'job', price: '500000' }]
  const q = await quotation(customerId, rows, leadId)
  const [stored] = await sql`select customer_id, lead_id, status from quotations where id = ${q}`
  expect(stored).toMatchObject({ customerId, leadId, status: 'draft' })                      // the customer is always set; the lead only when there was one
  await validate(q)

  // Several delivery notes under one validated quotation, each with its own number and proof.
  const d1 = await delivered(customerId, q), d2 = await delivered(customerId, q)
  const numbers = (await sql`select number from deliveries where id in (${d1}, ${d2}) order by id`).map((r) => r.number as string)
  expect(new Set(numbers).size).toBe(2)

  const total = big ? 12_000_000 : 2_500_000
  const inv = await createInvoice(actor, invoiceOf(customerId, quotationId(q), [d1, d2], rows))
  expect((await sql`select quotation_id, customer_id, status, total_minor from invoices where id = ${inv}`)[0]).toMatchObject({ quotationId: q, customerId, status: 'draft', totalMinor: total })
  expect((await sql`select delivery_id from invoice_delivery_notes where invoice_id = ${inv} order by delivery_id`).map((r) => r.deliveryId)).toEqual([d1, d2])
  const [pre] = await sql`select * from prepayment_receipts where invoice_id = ${inv}`
  expect(pre).toMatchObject({ status: 'draft', amountMinor: total, stampRequired: big })    // made with the invoice, automatically
  await setInvoiceStatus(actor, inv, 'issue')

  // One email, two PDFs. A pre-payment receipt that still needs its e-meterai holds the whole package back.
  if (big) {
    await rejects(sendInvoice(actor, inv, BASE), /waiting for its e-meterai/, 409)
    expect(await sql`select id from email_jobs where event = 'invoice_customer' and dedupe_key like ${'invoice-package-' + inv + '-%'}`).toHaveLength(0)
    const [invoiceRow] = await sql`select number from invoices where id = ${inv}`
    await uploadPrepaymentStamp(actor, pre.id as number, { providerReference: 'PERURI-PRE-0001', reviewed: true, file: await makePdf([pre.number as string, invoiceRow.number as string, 'e-meterai']) })
  }
  await sendInvoice(actor, inv, BASE)
  expect(await sql`select id from email_jobs where event = 'invoice_customer' and dedupe_key like ${'invoice-package-' + inv + '-%'}`).toHaveLength(1)
  sent.length = 0
  const result = await dispatch(BASE, 20)
  expect(result.failed).toBe(0)
  const mail = sent.filter((m) => m.subject.startsWith('VORA invoice'))
  expect(mail).toHaveLength(1)                                                           // ONE message ...
  const [inum] = await sql`select number from invoices where id = ${inv}`
  expect(mail[0].pdfs).toEqual([`${inum.number}.pdf`, `${pre.number}.pdf`])             // ... with exactly the invoice and its pre-payment receipt
  expect(sent.filter((m) => m.pdfs.length === 1 && m.pdfs[0] === `${pre.number}.pdf`)).toHaveLength(0)    // no second, automatic pre-payment email
  expect((await sql`select outstanding_minor, status from invoices where id = ${inv}`)[0]).toMatchObject({ outstandingMinor: total, status: 'issued' })   // sending is not paying

  // Payments: a partial one first, then the rest. Each confirmed payment has its own official receipt for the amount actually received.
  const first = big ? '6000000' : '1000000', rest = big ? '6000000' : '1500000'
  const r1 = await payAndReceive(inv, first)
  const receipts: Array<{ number: string; amountMinor: number; stampRequired: boolean }> = []
  for (const [r, amount] of [[r1, first], [await payAndReceive(inv, rest), rest]] as const) {
    const needsStamp = Number(amount) > 5_000_000
    expect(r.stampRequired).toBe(needsStamp)
    expect(r.receipt.status).toBe(needsStamp ? 'pending_stamp' : 'issued')
    const queuedEarly = (await sql`select id from email_jobs where event = 'receipt_customer' and dedupe_key = ${'receipt-send-' + r.receipt.id}`).length
    expect(queuedEarly).toBe(needsStamp ? 0 : 1)                                           // an unfinished (unstamped) receipt is never emailed as final
    if (needsStamp) {
      await uploadReceiptStamp(actor, r.receipt.id as number, { providerReference: 'PERURI-RCP-' + amount, reviewed: true, file: await makePdf([r.receipt.number as string, inum.number as string, 'e-meterai']) }, BASE)
      expect((await sql`select status from receipts where id = ${r.receipt.id as number}`)[0].status).toBe('issued')
    }
    receipts.push({ number: r.receipt.number as string, amountMinor: Number(amount) * 1, stampRequired: needsStamp })
  }
  expect((await sql`select status, outstanding_minor from invoices where id = ${inv}`)[0]).toMatchObject({ status: 'paid', outstandingMinor: 0 })
  expect(await sql`select id from receipts where invoice_id = ${inv}`).toHaveLength(2)
  sent.length = 0
  await dispatch(BASE, 20)
  const receiptMail = sent.filter((m) => m.subject.startsWith('VORA | Payment Receipt'))
  expect(receiptMail.map((m) => m.pdfs).flat().sort()).toEqual(receipts.map((r) => `${r.number}.pdf`).sort())
  expect(receiptMail[0].html).toContain(inum.number as string)                                // names the invoice, and the confirmed amount below
  expect(receiptMail.every((m) => m.to === 'billing@' + 'ptcustomer.example' || m.to.includes('@'))).toBe(true)
  return { quotationId: q, d1, d2, invoiceId: inv, receipts, invoiceNumber: inum.number as string }
}
const quotationId = (q: number) => q

// ======================================================================================================================================
describe('Path A: lead -> customer -> quotation -> ... -> official receipt', () => {
  it('runs from a public inquiry (with its phone number) to the customer\'s official receipt', async () => {
    const lead = await createLead({ kind: 'rfq', name: 'Rina Wijaya', email: 'rina@ptlead.example', phone: '+62 812 1111 2222', message: 'Need 2 x 40HC from Shanghai', company: 'PT Lead Maju', mode: 'sea-freight/fcl', origin: 'Shanghai', destination: 'Jakarta', cargo: '2 x 40HC machinery', pickup: '' })
    const [row] = await sql`select phone, customer_id, name, company from leads where id = ${lead.id}`
    expect(row).toMatchObject({ phone: '+62 812 1111 2222', customerId: null, name: 'Rina Wijaya' })                // the number went all the way into the database
    expect((await sql`select html from email_jobs where event = 'lead_admin'`)[0].html).toContain('+62 812 1111 2222')   // ... and into the administrator's notice
    await rejects(createLead({ kind: 'contact', name: 'X', email: 'x@y.example', phone: 'call me maybe', message: 'hi', company: '', mode: '', origin: '', destination: '', cargo: '', pickup: '' }), /valid phone/)
    await rejects(createLead({ kind: 'contact', name: 'X', email: 'x@y.example', phone: '', message: 'hi', company: '', mode: '', origin: '', destination: '', cargo: '', pickup: '' }), /required/)

    const converted = await convertLead(actor, lead.id, { existingCustomerId: null, customer: company('PT Lead Maju', { picName: 'Rina Wijaya', picPhone: '+62 812 1111 2222' }) })
    expect(converted.created).toBe(true)
    expect((await sql`select customer_id, converted_by from leads where id = ${lead.id}`)[0]).toMatchObject({ customerId: converted.customerId, convertedBy: actor })
    expect((await sql`select pic_name, pic_phone, phone from customers where id = ${converted.customerId}`)[0]).toMatchObject({ picName: 'Rina Wijaya', picPhone: '+62 812 1111 2222', phone: expect.stringMatching(/^\+62 21 /) })
    await rejects(convertLead(actor, lead.id, { existingCustomerId: converted.customerId }), /already converted/, 409)         // a lead converts once
    expect(await sql`select id from customers`).toHaveLength(1)

    const flow = await fromQuotationToReceipt(converted.customerId, lead.id, false)
    expect((await sql`select lead_id, customer_id from quotations where id = ${flow.quotationId}`)[0]).toMatchObject({ leadId: lead.id, customerId: converted.customerId })
    expect((await sql`select number from quotations where id = ${flow.quotationId}`)[0].number).toMatch(/^QUO-VORA-C[0-9A-F]{10}-/)   // numbered under the CUSTOMER's code
  })

  it('links an existing customer to a lead instead of creating one, and refuses a similar new customer until it is acknowledged', async () => {
    const existing = await saveCustomer(actor, null, company('PT Sudah Ada'))
    const lead = await createLead({ kind: 'contact', name: 'Budi', email: 'billing@ptsudahada.example', phone: '+62 811 222 333', message: 'again', company: 'PT Sudah Ada', mode: '', origin: '', destination: '', cargo: '', pickup: '' })
    await rejects(convertLead(actor, lead.id, { existingCustomerId: null, customer: company('PT Sudah Ada') }), /similar customer already exists/, 409)
    expect(await sql`select id from customers`).toHaveLength(1)
    const r = await convertLead(actor, lead.id, { existingCustomerId: existing })
    expect(r).toMatchObject({ customerId: existing, created: false })
    expect(await sql`select id from customers`).toHaveLength(1)
  })
})

describe('Path B: a customer entered by hand, with no lead at all', () => {
  it('runs from the customer to the official receipt (with e-meterai everywhere it is required) and never creates a lead', async () => {
    const before = await sql`select id from leads`
    const customerId = await saveCustomer(actor, null, company('PT Direct Customer'))
    expect((await sql`select pic_name, pic_email, pic_position, pic_phone from customers where id = ${customerId}`)[0]).toMatchObject({ picName: 'Rina Wijaya', picPosition: 'Finance Manager' })
    expect(await sql`select id from leads`).toHaveLength(before.length)                       // no lead was made for the customer

    const flow = await fromQuotationToReceipt(customerId, null, true)
    expect((await sql`select customer_id, lead_id from quotations where id = ${flow.quotationId}`)[0]).toMatchObject({ customerId, leadId: null })
    expect(await sql`select id from leads`).toHaveLength(before.length)                       // ... not by the quotation, the deliveries, the invoice or the payments either
    expect(await sql`select id from receipts where invoice_id = ${flow.invoiceId}`).toHaveLength(2)
  })
})

describe('Path C: an existing customer again, with no lead', () => {
  it('makes another quotation for the same customer and leaves the earlier documents alone', async () => {
    const customerId = await saveCustomer(actor, null, company('PT Repeat Customer'))
    const first = await fromQuotationToReceipt(customerId, null, false)
    const snapshot = await sql`select number, status from invoices order by id`
    const second = await fromQuotationToReceipt(customerId, null, false)
    expect(second.quotationId).not.toBe(first.quotationId)
    expect(await sql`select id from customers`).toHaveLength(1)                               // no duplicate customer
    expect(await sql`select id from leads`).toHaveLength(0)                                   // no lead made up
    expect(await sql`select id from quotations where customer_id = ${customerId}`).toHaveLength(2)
    expect((await sql`select number, status from invoices order by id limit 1`)[0]).toMatchObject(snapshot[0])     // the first path's invoice is untouched
    expect(await sql`select id from deliveries where customer_id = ${customerId}`).toHaveLength(4)
  })
})

// ======================================================================================================================================
describe('safeguards', () => {
  const rows = [{ description: 'Freight', quantity: '1', unit: 'shipment', price: '1000000' }]
  async function basis(name = 'PT Safe') {
    const customerId = await saveCustomer(actor, null, company(name))
    const q = await quotation(customerId, rows)
    await validate(q)
    return { customerId, q }
  }

  it('does not let a quotation exist without a customer, but keeps a historical lead-only one readable', async () => {
    await expect(createQuotation(actor, { customerId: 0, issuedAt: '2026-10-05', validUntil: '2999-01-01', taxPercent: '0', paymentTerms: 'x y z', termsConditions: 'x y z', notes: '', rows })).rejects.toThrow('Select the customer')
    await expect(sql`select quotation_create(${actor}, ${sql.json({ customer_id: null, currency: 'IDR', issued_at: '2026-10-05', valid_until: '2999-01-01', items: [] })})`).rejects.toThrow(/Select the customer/)
    const [lead] = await sql`insert into leads (type, name, email, message) values ('RFQ', 'Old', 'old@example.invalid', 'earlier') returning id`
    const [old] = await sql`insert into quotations (number, lead_id, status, currency, issued_at, valid_until, payment_terms, terms_conditions) values ('QUO-OLD-1', ${lead.id as number}, 'issued', 'IDR', '2026-01-01', '2026-02-01', 'x', 'y') returning id`
    expect((await sql`select customer_id, lead_id, status from quotations where id = ${old.id as number}`)[0]).toMatchObject({ customerId: null, status: 'issued' })    // as it was: nothing invented for it
  })

  it('maps an old approved quotation to validated only when its approval evidence exists', async () => {
    const customerId = await saveCustomer(actor, null, company('PT Old Approved'))
    const withEvidence = await quotation(customerId, rows), without = await quotation(customerId, rows)
    await sql`update quotations set status = 'approved' where id in (${withEvidence}, ${without})`
    await sql`insert into quotation_approvals (quotation_id, token_hash, expires_at, status, signed_pdf_key, signed_pdf_sha256, uploaded_at, reviewed_at, reviewed_by) values (${withEvidence}, 'h1', now(), 'approved', 'k', 'abc', now(), now(), ${actor})`
    // The backfill of migration 0026, as it ran on the data that already existed.
    await sql`update quotations q set status = 'validated', customer_approved_at = a.uploaded_at, validated_at = a.reviewed_at, validated_by = a.reviewed_by
      from (select distinct on (quotation_id) * from quotation_approvals where status = 'approved' and signed_pdf_key is not null and signed_pdf_sha256 is not null and reviewed_at is not null order by quotation_id, reviewed_at desc) a
      where a.quotation_id = q.id and q.status = 'approved'`
    expect((await sql`select id, status from quotations where id in (${withEvidence}, ${without}) order by id`).map((r) => r.status)).toEqual(['validated', 'approved'])
  })

  it('sends a rejected quotation back for correction and lets it be sent again; an unvalidated one cannot be delivered or invoiced', async () => {
    const customerId = await saveCustomer(actor, null, company('PT Reject'))
    const q = await quotation(customerId, rows)
    await rejects(createDelivery(actor, note(customerId, q)), /validated quotation/, 409)           // a draft
    await validate(q, { reject: true })
    await rejects(createDelivery(actor, note(customerId, q)), /validated quotation/, 409)           // a rejected one
    await requestApproval(actor, q, BASE)                                                           // allowed again after the correction
    expect((await sql`select status from quotations where id = ${q}`)[0].status).toBe('awaiting_approval')
    const [d] = await sql`select 1`
    void d
    await rejects(createInvoice(actor, invoiceOf(customerId, q, [1], rows)), /validated quotation/, 409)
  })

  it('refuses another customer\'s quotation and delivery notes, other quotations\' delivery notes, and the same delivery note billed twice', async () => {
    const a = await basis('PT Alpha'), b = await basis('PT Beta')
    await rejects(createDelivery(actor, note(a.customerId, b.q)), /does not belong to this customer/)
    const dA = await delivered(a.customerId, a.q), dB = await delivered(b.customerId, b.q)
    await rejects(createInvoice(actor, invoiceOf(a.customerId, b.q, [dB], rows)), /does not belong to this customer/)          // another customer's quotation
    await rejects(createInvoice(actor, invoiceOf(a.customerId, a.q, [dB], rows)), /belongs to another customer/)                // another customer's delivery note
    const a2 = await quotation(a.customerId, rows); await validate(a2)
    const dA2 = await delivered(a.customerId, a2)
    await rejects(createInvoice(actor, invoiceOf(a.customerId, a.q, [dA2], rows)), /belongs to another quotation/)               // a delivery note of the customer's OTHER quotation
    await rejects(createInvoice(actor, invoiceOf(a.customerId, a.q, [], rows)), /at least one delivery note/)
    const first = await createInvoice(actor, invoiceOf(a.customerId, a.q, [dA], rows))
    await rejects(createInvoice(actor, invoiceOf(a.customerId, a.q, [dA], rows)), /already billed/, 409)                        // duplicate billing
    await setInvoiceStatus(actor, first, 'void')                                                                                // a void invoice releases its delivery notes
    expect((await sql`select released_at from invoice_delivery_notes where invoice_id = ${first}`)[0].releasedAt).toBeInstanceOf(Date)
    await createInvoice(actor, invoiceOf(a.customerId, a.q, [dA], rows))
  })

  it('needs a proof of delivery before billing, and refuses currency and billing totals that do not fit the quotation', async () => {
    const { customerId, q } = await basis('PT Billing')
    const [only] = [await createDelivery(actor, note(customerId, q))]
    await setDeliveryStatus(actor, only, 'issue')
    await rejects(createInvoice(actor, invoiceOf(customerId, q, [only], rows)), /no recorded proof of delivery/, 409)
    const d = await delivered(customerId, q)
    // Billing more than was quoted needs the administrator's explicit acknowledgement; the quotation total is never multiplied by the delivery notes.
    const big = [{ description: 'Freight', quantity: '1', unit: 'shipment', price: '1500000' }]
    await rejects(createInvoice(actor, invoiceOf(customerId, q, [d], big)), /would total 1500000 against 1000000 quoted/, 409)
    const ok = await createInvoice(actor, invoiceOf(customerId, q, [d], big, { overQuotationAck: true }))
    expect((await sql`select subtotal_minor from invoices where id = ${ok}`)[0].subtotalMinor).toBe(1_500_000)
    const d2 = await delivered(customerId, q)
    await rejects(createInvoice(actor, invoiceOf(customerId, q, [d2], rows)), /would total/, 409)                                // the quotation is already over-billed
    await sql`update customers set currency = 'USD' where id = ${customerId}`
    await rejects(createInvoice(actor, invoiceOf(customerId, q, [d2], rows)), /same currency|changed/, 409)
  })

  it('confirms a payment once under concurrency, makes exactly one official receipt, and never lets an SMTP failure undo it', async () => {
    const { customerId, q } = await basis('PT Concurrent')
    const d = await delivered(customerId, q)
    const inv = await createInvoice(actor, invoiceOf(customerId, q, [d], rows))
    await setInvoiceStatus(actor, inv, 'issue')
    const [bank] = await sql`select id from bank_accounts limit 1`
    const paymentId = await recordPayment(actor, inv, { amount: '1000000', date: '', method: 'bank transfer', reference: 'R1', receivingBankId: bank.id as number })
    const results = await Promise.allSettled([confirmPayment(actor, paymentId, { fundsCleared: true, receivingBankId: null }, BASE), confirmPayment(actor, paymentId, { fundsCleared: true, receivingBankId: null }, BASE)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await sql`select id from receipts where payment_id = ${paymentId}`).toHaveLength(1)                                        // no duplicate official receipt
    expect((await sql`select status, outstanding_minor from invoices where id = ${inv}`)[0]).toMatchObject({ status: 'paid', outstandingMinor: 0 })
    await rejects(confirmPayment(actor, paymentId, { fundsCleared: true, receivingBankId: null }, BASE), /already confirmed/, 409)

    // The email fails: the job waits to be retried, the payment and the receipt stay as they are, and nothing new is made.
    const [receipt] = await sql`select id, number from receipts where payment_id = ${paymentId}`
    setSender(async () => { throw new Error('SMTP connection refused') })
    sent.length = 0
    await sql`update email_jobs set status = 'queued', next_attempt_at = now() where event = 'receipt_customer'`
    expect((await dispatch(BASE, 20)).failed).toBeGreaterThan(0)
    expect((await sql`select status, error from email_jobs where event = 'receipt_customer'`)[0]).toMatchObject({ status: 'retry', error: 'SMTP connection refused' })
    expect((await sql`select status from payments where id = ${paymentId}`)[0].status).toBe('recorded')
    expect(await sql`select id from receipts where invoice_id = ${inv}`).toHaveLength(1)
    setSender(async (_c, to, subject, _h, a) => { sent.push({ to, subject, html: '', pdfs: (Array.isArray(a) ? a : a ? [a] : []).map((x) => x.filename) }) })
    await sql`update email_jobs set next_attempt_at = now() where event = 'receipt_customer'`
    expect((await dispatch(BASE, 20)).sent).toBeGreaterThan(0)
    expect((await sql`select status from email_jobs where event = 'receipt_customer'`)[0].status).toBe('sent')
    // An explicit, authorised resend is another message about the SAME receipt.
    sent.length = 0
    await resendReceipt(actor, receipt.id as number, BASE)
    await dispatch(BASE, 20)
    expect(sent.map((m) => m.pdfs)).toEqual([[`${receipt.number}.pdf`]])
    expect(await sql`select id from receipts where invoice_id = ${inv}`).toHaveLength(1)
  })

  it('does not send an official receipt that is still waiting for its e-meterai', async () => {
    const customerId = await saveCustomer(actor, null, company('PT Stamp'))
    const q = await quotation(customerId, [{ description: 'Freight', quantity: '1', unit: 'shipment', price: '8000000' }]); await validate(q)
    const d = await delivered(customerId, q)
    const inv = await createInvoice(actor, invoiceOf(customerId, q, [d], [{ description: 'Freight', quantity: '1', unit: 'shipment', price: '8000000' }]))
    await setInvoiceStatus(actor, inv, 'issue')
    const { receipt } = await payAndReceive(inv, '8000000')
    expect(receipt.status).toBe('pending_stamp')
    await rejects(resendReceipt(actor, receipt.id as number, BASE), /waiting for its e-meterai/, 409)
    expect(await sql`select id from email_jobs where event = 'receipt_customer'`).toHaveLength(0)
    sent.length = 0
    // Even a queued receipt message cannot carry an unfinished receipt: the outbox refuses and retries later.
    await sql`insert into email_jobs (event, recipient, subject, html, status, attachment_kind, attachment_id) values ('receipt_customer', 'x@y.example', 's', '<p>x</p>', 'queued', 'receipt', ${receipt.id as number})`
    await dispatch(BASE, 20)
    expect(sent.filter((m) => m.subject.startsWith('VORA | Payment Receipt'))).toHaveLength(0)
    expect((await sql`select status, error from email_jobs where event = 'receipt_customer'`)[0]).toMatchObject({ status: 'retry', error: expect.stringMatching(/not eligible/) })
  })

  it('keeps the database functions closed to the public keys', async () => {
    const closed = await sql`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
      and p.proname in ('lead_convert', 'quotation_create', 'approval_review', 'invoice_create', 'mail_enqueue', 'delivery_create', 'customer_save', 'receipt_stamp_commit')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))`
    expect(closed).toEqual([])
  })
})
