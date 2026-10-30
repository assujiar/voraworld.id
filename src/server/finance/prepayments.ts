import { randomBytes } from 'node:crypto'
import { one, rpc } from '../data'
import { recordAudit } from '../audit'
import { maxUploadBytes } from '../env'
import { ActionError } from '../errors'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { putObject, removeObject } from '../storage'
import { getVerification } from '../verification'
import { inspectStampedReceipt, requiresStamp } from './pdf-inspect'
import type { StampInput } from './receipts'

/**
 * The pre-payment receipt: made together with every invoice (by `invoice_create`), for customers whose finance team needs a receipt (stamped
 * with an e-meterai above IDR 5,000,000) before it releases the payment. It is issued BEFORE any money arrives and says so; the official
 * payment receipt (receipts.ts) is still issued only after Finance confirmed cleared funds.
 *
 * draft (invoice not issued) -> pending_stamp (e-meterai still to be applied by hand) or issued -> void
 * Releasing it when the invoice is issued and voiding it with the invoice happen inside `invoice_set_status`.
 * It travels to the customer WITH the invoice, as the second attachment of ONE email (`sendInvoice`); the stand-alone button below is for sending it again on purpose.
 */

/** For an invoice that has none: made before pre-payment receipts existed, or whose receipt was voided. Only while nothing has been paid. */
export async function ensurePrepayment(actorId: number, invoiceId: number): Promise<number> {
  const inv = await one('invoices', (q) => q.eq('id', invoiceId), 'currency,total_minor')
  if (!inv) throw new ActionError('Invoice not found', 404)
  return rpc<number>('prepayment_ensure', { p_actor: actorId, p_invoice: invoiceId, p_stamp_required: requiresStamp(inv.currency as string, inv.totalMinor as number) })
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
  const row = await one('prepayment_receipts', (q) => q.eq('id', id))
  if (!row || row.status !== 'pending_stamp' || !row.stampRequired) throw new ActionError('This pre-payment receipt is not waiting for a manual e-meterai', 409)
  const inv = await one('invoices', (q) => q.eq('id', row.invoiceId as number), 'number')
  const digest = await inspectStampedReceipt(input.file, row.number as string, inv!.number as string)
  const key = `prepayment-stamps/${id}/${randomBytes(22).toString('base64url')}.pdf`
  await putObject('documents', key, input.file, 'application/pdf')
  try {
    await rpc('prepayment_stamp_commit', { p_actor: actorId, p_id: id, p_key: key, p_sha256: digest, p_reference: reference })
  } catch (e) {
    await removeObject('documents', key)
    throw e
  }
}

export async function voidPrepayment(actorId: number, id: number): Promise<void> {
  await rpc('prepayment_void', { p_actor: actorId, p_id: id })
}

/** What the email needs; shared by the stand-alone "email" button and the invoice email that carries the receipt along. */
async function queueEmail(id: number, baseUrl: string, dedupeKey: string) {
  const row = await one('prepayment_receipts', (q) => q.eq('id', id))
  const invoice = row ? await one('invoices', (q) => q.eq('id', row.invoiceId as number), 'number,customer_id') : undefined
  const customer = invoice ? await one('customers', (q) => q.eq('id', invoice.customerId as number), 'name,email') : undefined
  const ver = row ? await getVerification('prepayment', id) : undefined
  if (!row || !ver || ver.revoked || row.status !== 'issued' || !customer?.email) return { row, queued: null }
  const queued = await enqueue('prepayment_receipt_customer', customer.email as string, {
    customer_name: customer.name, document_number: row.number, invoice_number: invoice!.number, verify_url: `${baseUrl}/verify/${ver.token}`,
  }, { attachmentKind: 'prepayment', attachmentId: id, dedupeKey })
  return { row, queued }
}

/** Queues the released pre-payment receipt for the customer. Pressing twice within a minute sends once. */
export async function sendPrepayment(actorId: number, id: number, baseUrl: string): Promise<void> {
  const row = await one('prepayment_receipts', (q) => q.eq('id', id), 'status,invoice_id')
  if (!row) throw new ActionError('Pre-payment receipt not found', 404)
  const invoice = await one('invoices', (q) => q.eq('id', row.invoiceId as number), 'customer_id')
  const customer = invoice ? await one('customers', (q) => q.eq('id', invoice.customerId as number), 'email') : undefined
  if (row.status !== 'issued') throw new ActionError('Only a released pre-payment receipt can be emailed' + (row.status === 'pending_stamp' ? ': upload the stamped PDF first' : ''), 409)
  if (!customer?.email) throw new ActionError('The customer has no billing email')
  const conf = await getMailConfig()
  const rule = await one('email_rules', (q) => q.eq('key', 'prepayment_receipt_customer'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the prepayment_receipt_customer email rule first', 409)
  const { queued } = await queueEmail(id, baseUrl, `prepayment-customer-${id}-${Math.floor(Date.now() / 60_000)}`)
  if (!queued) throw new ActionError('Email delivery is disabled', 409)
  await recordAudit(actorId, 'send-prepayment-receipt', 'prepayment-receipt', id, 'Pre-payment receipt PDF queued through the configured SMTP')
}
