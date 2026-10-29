import { randomBytes } from 'node:crypto'
import { tx } from '../db'
import { recordAudit } from '../audit'
import { sha256Hex } from '../crypto'
import { maxUploadBytes } from '../env'
import { ActionError } from '../errors'
import { enqueue } from '../mail/outbox'
import { getObject, putObject } from '../storage'
import { getVerification } from '../verification'
import { recomputeOutstanding } from './invoices'
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
  await tx(async (t) => {
    const [receipt] = await t`select * from receipts where id = ${receiptId} for update`
    if (!receipt || receipt.status !== 'pending_stamp' || !receipt.stampRequired) throw new ActionError('This receipt is not waiting for a manual e-meterai', 409)
    const [inv] = await t`select i.number, c.name as customer_name, c.email as customer_email from invoices i join customers c on c.id = i.customer_id where i.id = ${receipt.invoiceId as number}`
    const digest = await inspectStampedReceipt(input.file!, receipt.number as string, inv.number as string)
    const key = `receipt-stamps/${receiptId}/${randomBytes(22).toString('base64url')}.pdf`
    await putObject('documents', key, input.file!, 'application/pdf')
    await t`update receipts set stamp_storage_key = ${key}, stamp_sha256 = ${digest}, stamp_uploaded_at = now(), stamp_uploaded_by = ${actorId},
            stamp_provider_reference = ${reference}, status = 'issued' where id = ${receiptId}`
    if (inv.customerEmail) {
      const ver = await getVerification(t, 'receipt', receiptId)
      await bestEffort(t, 'receipt_customer', (s) => enqueue(s, 'receipt_customer', inv.customerEmail as string, {
        customer_name: inv.customerName, document_number: receipt.number, verify_url: `${baseUrl}/verify/${ver?.token ?? ''}`,
      }, { attachmentKind: 'receipt', attachmentId: receiptId, dedupeKey: `receipt-send-${receiptId}` }))
    }
    await recordAudit(t, actorId, 'stamp-upload', 'receipt', receiptId, `Official e-meterai reference: ${reference}; sha256: ${digest}`)
  })
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
  await tx(async (t) => {
    const [ref] = await t`select invoice_id, payment_id from receipts where id = ${receiptId}`
    if (!ref) throw new ActionError('Receipt not found', 404)
    await t`select id from invoices where id = ${ref.invoiceId as number} for update`
    const [r] = await t`select * from receipts where id = ${receiptId} for update`
    if (r.status === 'void') throw new ActionError('The receipt is already void', 409)
    const [p] = await t`select * from payments where id = ${ref.paymentId as number} for update`
    if (!p || p.status !== 'recorded') throw new ActionError('The payment is not in a recorded state', 409)
    await t`update receipts set status = 'void' where id = ${receiptId}`
    await t`update payments set status = 'void' where id = ${p.id as number}`
    await t`update document_verification_tokens set revoked = true where kind = 'receipt' and document_id = ${receiptId}`
    await recomputeOutstanding(t, ref.invoiceId as number)
    await recordAudit(t, actorId, 'void-payment-and-receipt', 'receipt', receiptId, r.number as string)
  })
}

