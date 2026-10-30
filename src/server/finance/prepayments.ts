import { randomBytes } from 'node:crypto'
import { tx, type Db } from '../db'
import { recordAudit } from '../audit'
import { maxUploadBytes } from '../env'
import { ActionError } from '../errors'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { putObject } from '../storage'
import { ensurePublicCode, nextNumber } from '../numbering'
import { createVerification, getVerification } from '../verification'
import { bestEffort } from './notify'
import { inspectStampedReceipt, requiresStamp } from './pdf-inspect'
import type { StampInput } from './receipts'

/**
 * The pre-payment receipt: made together with every invoice, for customers whose finance team needs a receipt (stamped with an
 * e-meterai above IDR 5,000,000) before it releases the payment. It is issued BEFORE any money arrives and says so; the official
 * payment receipt (receipts.ts) is still issued only after Finance confirmed cleared funds.
 *
 * draft (invoice not issued) -> pending_stamp (e-meterai still to be applied by hand) or issued -> void
 */
export interface InvoiceForPrepayment { id: number; customerId: number; currency: string; totalMinor: number; issuedAt: string }

/** Creates the draft pre-payment receipt for an invoice, inside the transaction that creates (or later completes) the invoice. Nothing is owed on a zero invoice. */
export async function createPrepayment(t: Db, inv: InvoiceForPrepayment): Promise<number | null> {
  if (inv.totalMinor <= 0) return null
  const code = await ensurePublicCode(t, 'customers', inv.customerId)
  const number = await nextNumber(t, 'PPR', code, inv.issuedAt)
  const [row] = await t`insert into prepayment_receipts (number, invoice_id, status, currency, amount_minor, stamp_required)
    values (${number}, ${inv.id}, 'draft', ${inv.currency}, ${inv.totalMinor}, ${requiresStamp(inv.currency, inv.totalMinor)}) returning id`
  await createVerification(t, 'prepayment', row.id as number)
  return row.id as number
}

/** The invoice is issued: a receipt that needs no stamp is released now, the others wait for their e-meterai. */
export async function releasePrepayment(t: Db, invoiceId: number): Promise<void> {
  await t`update prepayment_receipts set status = case when stamp_required then 'pending_stamp' else 'issued' end where invoice_id = ${invoiceId} and status = 'draft'`
}

/** The invoice is void: its pre-payment receipt and its QR link go with it. */
export async function voidPrepaymentsOf(t: Db, invoiceId: number): Promise<void> {
  await t`update document_verification_tokens set revoked = true where kind = 'prepayment' and document_id in (select id from prepayment_receipts where invoice_id = ${invoiceId})`
  await t`update prepayment_receipts set status = 'void' where invoice_id = ${invoiceId} and status <> 'void'`
}

/** For an invoice that has none: made before pre-payment receipts existed, or whose receipt was voided. Only while nothing has been paid. */
export async function ensurePrepayment(actorId: number, invoiceId: number): Promise<number> {
  return tx(async (t) => {
    const [inv] = await t`select * from invoices where id = ${invoiceId} for update`
    if (!inv) throw new ActionError('Invoice not found', 404)
    if (!['draft', 'issued'].includes(inv.status as string)) throw new ActionError('A pre-payment receipt can only be made for an invoice that is unpaid and not void', 409)
    const [live] = await t`select id from prepayment_receipts where invoice_id = ${invoiceId} and status <> 'void'`
    if (live) throw new ActionError('This invoice already has a pre-payment receipt', 409)
    const id = await createPrepayment(t, { id: invoiceId, customerId: inv.customerId as number, currency: inv.currency as string, totalMinor: inv.totalMinor as number, issuedAt: String(inv.issuedAt) })
    if (!id) throw new ActionError('The invoice total is zero: there is nothing to receive', 409)
    if (inv.status === 'issued') await releasePrepayment(t, invoiceId)
    await recordAudit(t, actorId, 'create', 'prepayment-receipt', id, `Invoice ${inv.number}`)
    return id
  })
}

/**
 * Manual e-meterai, exactly as for the payment receipt: Finance stamps the PDF through an authorised provider and uploads it;
 * VORA keeps it privately with its SHA-256 and never judges the stamp itself.
 */
export async function uploadPrepaymentStamp(actorId: number, id: number, input: StampInput): Promise<void> {
  const reference = input.providerReference.trim().slice(0, 160)
  if (!input.reviewed || reference.length < 6 || !input.file || !input.file.length) {
    throw new ActionError('The official e-meterai reference, your confirmation and the stamped PDF are all required')
  }
  if (input.file.length > maxUploadBytes()) throw new ActionError(`Upload a PDF not exceeding ${Math.floor(maxUploadBytes() / 1048576)} MB`)
  await tx(async (t) => {
    const [row] = await t`select * from prepayment_receipts where id = ${id} for update`
    if (!row || row.status !== 'pending_stamp' || !row.stampRequired) throw new ActionError('This pre-payment receipt is not waiting for a manual e-meterai', 409)
    const [inv] = await t`select number from invoices where id = ${row.invoiceId as number}`
    const digest = await inspectStampedReceipt(input.file!, row.number as string, inv.number as string)
    const key = `prepayment-stamps/${id}/${randomBytes(22).toString('base64url')}.pdf`
    await putObject('documents', key, input.file!, 'application/pdf')
    await t`update prepayment_receipts set stamp_storage_key = ${key}, stamp_sha256 = ${digest}, stamp_uploaded_at = now(), stamp_uploaded_by = ${actorId},
            stamp_provider_reference = ${reference}, status = 'issued' where id = ${id}`
    await recordAudit(t, actorId, 'stamp-upload', 'prepayment-receipt', id, `Official e-meterai reference: ${reference}; sha256: ${digest}`)
  })
}

export async function voidPrepayment(actorId: number, id: number): Promise<void> {
  await tx(async (t) => {
    const [row] = await t`select * from prepayment_receipts where id = ${id} for update`
    if (!row) throw new ActionError('Pre-payment receipt not found', 404)
    if (row.status === 'void') throw new ActionError('The pre-payment receipt is already void', 409)
    await t`update prepayment_receipts set status = 'void' where id = ${id}`
    await t`update document_verification_tokens set revoked = true where kind = 'prepayment' and document_id = ${id}`
    await recordAudit(t, actorId, 'void', 'prepayment-receipt', id, row.number as string)
  })
}

/** What the email needs; shared by the stand-alone "email" button and the invoice email that carries the receipt along. */
async function queueEmail(t: Db, id: number, baseUrl: string, dedupeKey: string) {
  const [row] = await t`select p.*, i.number as invoice_number, c.name as customer_name, c.email as customer_email
    from prepayment_receipts p join invoices i on i.id = p.invoice_id join customers c on c.id = i.customer_id where p.id = ${id}`
  const ver = row ? await getVerification(t, 'prepayment', id) : undefined
  if (!row || !ver || ver.revoked || row.status !== 'issued' || !row.customerEmail) return { row, queued: null }
  const queued = await enqueue(t, 'prepayment_receipt_customer', row.customerEmail as string, {
    customer_name: row.customerName, document_number: row.number, invoice_number: row.invoiceNumber, verify_url: `${baseUrl}/verify/${ver.token}`,
  }, { attachmentKind: 'prepayment', attachmentId: id, dedupeKey })
  return { row, queued }
}

/** Queues the released pre-payment receipt for the customer. Pressing twice within a minute sends once. */
export async function sendPrepayment(actorId: number, id: number, baseUrl: string): Promise<void> {
  await tx(async (t) => {
    const [row] = await t`select p.status, c.email as customer_email from prepayment_receipts p join invoices i on i.id = p.invoice_id join customers c on c.id = i.customer_id where p.id = ${id}`
    if (!row) throw new ActionError('Pre-payment receipt not found', 404)
    if (row.status !== 'issued') throw new ActionError('Only a released pre-payment receipt can be emailed' + (row.status === 'pending_stamp' ? ': upload the stamped PDF first' : ''), 409)
    if (!row.customerEmail) throw new ActionError('The customer has no billing email')
    const conf = await getMailConfig(t)
    const [rule] = await t`select enabled from email_rules where key = 'prepayment_receipt_customer'`
    if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the prepayment_receipt_customer email rule first', 409)
    const { queued } = await queueEmail(t, id, baseUrl, `prepayment-customer-${id}-${Math.floor(Date.now() / 60_000)}`)
    if (!queued) throw new ActionError('Email delivery is disabled', 409)
    await recordAudit(t, actorId, 'send-prepayment-receipt', 'prepayment-receipt', id, 'Pre-payment receipt PDF queued through the configured SMTP')
  })
}

/** Called by sendInvoice: the receipt travels with the invoice when it is released and its email rule is on. Never blocks the invoice email. */
export async function sendWithInvoice(t: Db, invoiceId: number, baseUrl: string): Promise<void> {
  const [row] = await t`select id from prepayment_receipts where invoice_id = ${invoiceId} and status = 'issued'`
  if (!row) return
  await bestEffort(t, 'prepayment_receipt_customer', (s) => queueEmail(s, row.id as number, baseUrl, `prepayment-invoice-${row.id}-${Math.floor(Date.now() / 60_000)}`))
}
