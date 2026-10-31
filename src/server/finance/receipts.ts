import { randomBytes } from 'node:crypto'
import { one, rpc } from '../data'
import { sha256Hex } from '../crypto'
import { maxUploadBytes } from '../env'
import { ActionError } from '../errors'
import { recordAudit } from '../audit'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { money } from '../money'
import { getVerification } from '../verification'
import { getObject, putObject, removeObject } from '../storage'
import { bestEffort } from './notify'
import { inspectStampedReceipt } from './pdf-inspect'

export interface StampInput { providerReference: string; reviewed: boolean; file: Uint8Array | null }

/**
 * Manual e-meterai: VORA never creates or validates a stamp. Finance stamps the receipt through an authorised
 * provider, uploads the final PDF, and only then is the receipt released. The file is kept in the private bucket
 * and its SHA-256 is recorded so any later change is detected.
 */
export async function uploadReceiptStamp(actorId: number, receiptId: number, input: StampInput, baseUrl: string): Promise<void> {
  const reference = input.providerReference.trim().slice(0, 160)
  if (!input.reviewed || reference.length < 6 || !input.file || !input.file.length) {
    throw new ActionError('The official e-meterai reference, your confirmation and the stamped PDF are all required')
  }
  if (input.file.length > maxUploadBytes()) throw new ActionError(`Upload a PDF not exceeding ${Math.floor(maxUploadBytes() / 1048576)} MB`)
  const receipt = await one('receipts', (q) => q.eq('id', receiptId))
  if (!receipt || receipt.status !== 'pending_stamp' || !receipt.stampRequired) throw new ActionError('This receipt is not waiting for a manual e-meterai', 409)
  const inv = await one('invoices', (q) => q.eq('id', receipt.invoiceId as number), 'number')
  const digest = await inspectStampedReceipt(input.file, receipt.number as string, inv!.number as string)
  const key = `receipt-stamps/${receiptId}/${randomBytes(22).toString('base64url')}.pdf`
  await putObject('documents', key, input.file, 'application/pdf')
  let done: { receipt_number: string; token: string; invoice_number: string; currency: string; payment: { amount_minor: number; date: string }; customer: { name: string; email: string } }
  try {
    done = await rpc('receipt_stamp_commit', { p_actor: actorId, p_id: receiptId, p_key: key, p_sha256: digest, p_reference: reference })
  } catch (e) {
    await removeObject('documents', key)         // the receipt changed while the file was being checked: do not leave the file behind
    throw e
  }
  if (done.customer.email) {
    await bestEffort('receipt_customer', () => enqueue('receipt_customer', done.customer.email, {
      customer_name: done.customer.name, document_number: done.receipt_number, invoice_number: done.invoice_number, payment_amount: money(done.payment.amount_minor, done.currency),
      payment_date: done.payment.date, verify_url: `${baseUrl}/verify/${done.token}`,
    }, { attachmentKind: 'receipt', attachmentId: receiptId, dedupeKey: `receipt-send-${receiptId}` }))
  }
}

/**
 * Sends a released official receipt to the customer again, on purpose (the first email failed, or the address was corrected). It never makes another
 * receipt and never touches the payment: a mail problem is only a mail problem. Pressing twice within a minute queues once.
 */
export async function resendReceipt(actorId: number, receiptId: number, baseUrl: string): Promise<void> {
  const receipt = await one('receipts', (q) => q.eq('id', receiptId))
  if (!receipt) throw new ActionError('Receipt not found', 404)
  if (receipt.status !== 'issued') throw new ActionError(receipt.status === 'pending_stamp' ? 'The receipt is waiting for its e-meterai: upload the stamped PDF first' : 'Only a released receipt can be emailed', 409)
  const [inv, pay] = await Promise.all([one('invoices', (q) => q.eq('id', receipt.invoiceId as number), 'number,customer_id,currency'), one('payments', (q) => q.eq('id', receipt.paymentId as number), 'amount_minor,date,reference,status')])
  if (!inv || pay?.status !== 'recorded') throw new ActionError('The payment of this receipt is not confirmed', 409)
  const customer = await one('customers', (q) => q.eq('id', inv.customerId as number), 'name,email')
  if (!customer?.email) throw new ActionError('The customer has no billing email')
  const ver = await getVerification('receipt', receiptId)
  if (!ver || ver.revoked) throw new ActionError('The receipt has no active verification link', 409)
  const conf = await getMailConfig()
  const rule = await one('email_rules', (q) => q.eq('key', 'receipt_customer'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the receipt_customer email rule first', 409)
  const queued = await enqueue('receipt_customer', customer.email as string, {
    customer_name: customer.name, document_number: receipt.number, invoice_number: inv.number, payment_amount: money(pay.amountMinor as number, inv.currency as string),
    payment_date: pay.date, verify_url: `${baseUrl}/verify/${ver.token}`,
  }, { attachmentKind: 'receipt', attachmentId: receiptId, dedupeKey: `receipt-resend-${receiptId}-${Math.floor(Date.now() / 60_000)}` })
  if (!queued) throw new ActionError('Email delivery is disabled', 409)
  await recordAudit(actorId, 'resend-receipt', 'receipt', receiptId, 'Official receipt queued again through the configured SMTP')
}

/** The released, stamped file, re-hashed on every read. A swapped or damaged file is refused (409), never served. */
export async function readStampedReceipt(receipt: { status: string; stampStorageKey: string | null; stampSha256: string | null }): Promise<Uint8Array> {
  if (receipt.status !== 'issued' || !receipt.stampStorageKey || !receipt.stampSha256) throw new ActionError('The stamped receipt has not been released yet', 409)
  const bytes = await getObject('documents', receipt.stampStorageKey, maxUploadBytes() + 1)
  if ((await sha256Hex(bytes)) !== receipt.stampSha256) throw new ActionError('The stored stamped PDF failed its integrity check', 409)
  return bytes
}

/** Voids a receipt AND reverses its payment: the invoice balance and status are recalculated and the QR link is revoked. */
export async function voidReceipt(actorId: number, receiptId: number): Promise<void> {
  await rpc('receipt_void', { p_actor: actorId, p_id: receiptId })
  await (await import('../trust/revocation')).recordVoided(actorId, 'receipt', receiptId)
}
