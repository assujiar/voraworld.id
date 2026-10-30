import { randomBytes } from 'node:crypto'
import { one, rpc } from '../data'
import { sha256Hex } from '../crypto'
import { maxUploadBytes } from '../env'
import { ActionError } from '../errors'
import { enqueue } from '../mail/outbox'
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
  let done: { receipt_number: string; token: string; invoice_number: string; customer: { name: string; email: string } }
  try {
    done = await rpc('receipt_stamp_commit', { p_actor: actorId, p_id: receiptId, p_key: key, p_sha256: digest, p_reference: reference })
  } catch (e) {
    await removeObject('documents', key)         // the receipt changed while the file was being checked: do not leave the file behind
    throw e
  }
  if (done.customer.email) {
    await bestEffort('receipt_customer', () => enqueue('receipt_customer', done.customer.email, {
      customer_name: done.customer.name, document_number: done.receipt_number, verify_url: `${baseUrl}/verify/${done.token}`,
    }, { attachmentKind: 'receipt', attachmentId: receiptId, dedupeKey: `receipt-send-${receiptId}` }))
  }
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
}
