import { randomBytes } from 'node:crypto'
import { sql, tx } from '../db'
import { recordAudit } from '../audit'
import { sha256Hex } from '../crypto'
import { isoDay, today } from '../dates'
import { maxUploadBytes } from '../env'
import { ActionError, isUnique } from '../errors'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { calcLines } from '../money'
import { ensurePublicCode, nextNumber } from '../numbering'
import type { QuotationApprovalsRow } from '../schema'
import { getObject, putObject } from '../storage'
import { createVerification, getVerification } from '../verification'
import { moneyErrors, parseLines } from './parse'
import { inspectSignedQuotation } from './pdf-inspect'

export interface QuotationInput { recipient: string; issuedAt: string; validUntil: string; taxPercent: string; notes: string; items: string }

export async function createQuotation(actorId: number, input: QuotationInput): Promise<number> {
  const m = /^(customer|lead):(\d{1,9})$/.exec(input.recipient.trim())
  if (!m) throw new ActionError('Select a customer or lead')
  const which = m[1] as 'customer' | 'lead'
  const ownerId = Number(m[2])
  const lines = parseLines(input.items)
  const issued = isoDay(input.issuedAt, today(), 'Issue date')
  const expiry = isoDay(input.validUntil, issued, 'Valid until')
  if (expiry < issued) throw new ActionError('Validity must not precede the issue date')
  const taxPercent = input.taxPercent.trim().slice(0, 20) || '0'
  try {
    return await tx(async (t) => {
      const [owner] = which === 'customer' ? await t`select id, currency from customers where id = ${ownerId}` : await t`select id from leads where id = ${ownerId}`
      if (!owner) throw new ActionError('Recipient unavailable')
      const currency = which === 'customer' ? (owner.currency as string) : 'IDR'
      const amounts = moneyErrors(() => calcLines(lines, currency, taxPercent))
      const code = await ensurePublicCode(t, which === 'customer' ? 'customers' : 'leads', ownerId)
      const number = await nextNumber(t, 'QUO', code, issued)
      const [q] = await t`insert into quotations (number, customer_id, lead_id, status, currency, issued_at, valid_until, notes, tax_percent, subtotal_minor, tax_minor, total_minor)
        values (${number}, ${which === 'customer' ? ownerId : null}, ${which === 'lead' ? ownerId : null}, 'draft', ${currency}, ${issued}, ${expiry}, ${input.notes.slice(0, 2500)},
                ${taxPercent}, ${amounts.subtotalMinor}, ${amounts.taxMinor}, ${amounts.totalMinor}) returning id`
      for (const item of amounts.items) {
        await t`insert into quotation_items (quotation_id, description, unit, quantity, price_minor, amount_minor)
                values (${q.id as number}, ${item.description}, ${item.unit}, ${item.quantity}, ${item.priceMinor}, ${item.amountMinor})`
      }
      await createVerification(t, 'quotation', q.id as number)
      await recordAudit(t, actorId, 'create', 'quotation', q.id as number, number)
      return q.id as number
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Quotation numbering collision, please retry', 409)
    throw e
  }
}

/** issue: draft -> issued. void: draft/issued/awaiting/approved -> void, revoking the QR link and any open approval link. */
export async function setQuotationStatus(actorId: number, id: number, action: string): Promise<void> {
  await tx(async (t) => {
    const [q] = await t`select * from quotations where id = ${id} for update`
    if (!q) throw new ActionError('Quotation not found', 404)
    if (action === 'issue' && q.status === 'draft') {
      await t`update quotations set status = 'issued' where id = ${id}`
    } else if (action === 'void' && ['draft', 'issued', 'awaiting_approval', 'approved'].includes(q.status as string)) {
      await t`update quotations set status = 'void' where id = ${id}`
      await t`update quotation_approvals set status = 'revoked' where quotation_id = ${id} and status = 'pending'`
      await t`update document_verification_tokens set revoked = true where kind = 'quotation' and document_id = ${id}`
    } else {
      throw new ActionError('Quotation cannot make that status transition', 409)
    }
    await recordAudit(t, actorId, action, 'quotation', id, q.number as string)
  })
}

const APPROVAL_LINK_DAYS = 14

/** Sends the quotation PDF with a private, expiring upload link. Earlier pending links are revoked. */
export async function requestApproval(actorId: number, id: number, baseUrl: string): Promise<void> {
  await tx(async (t) => {
    const [q] = await t`select * from quotations where id = ${id} for update`
    if (!q) throw new ActionError('Quotation not found', 404)
    if (!['issued', 'awaiting_approval'].includes(q.status as string)) throw new ActionError('Issue the quotation before requesting customer approval', 409)
    if ((q.validUntil as string) < today()) throw new ActionError('Quotation validity has expired', 409)
    const [recipient] = q.customerId
      ? await t`select name, email from customers where id = ${q.customerId as number}`
      : await t`select coalesce(nullif(company, ''), name) as name, email from leads where id = ${q.leadId as number}`
    if (!recipient?.email) throw new ActionError('The customer or lead needs an email address first')
    const conf = await getMailConfig(t)
    const [rule] = await t`select enabled from email_rules where key = 'quotation_approval_request'`
    if (!conf?.enabled || !rule?.enabled) throw new ActionError('Configure SMTP and enable the quotation approval email rule first', 409)

    await t`update quotation_approvals set status = 'revoked' where quotation_id = ${id} and status = 'pending'`
    const raw = randomBytes(42).toString('base64url')
    const endOfValidity = Date.parse((q.validUntil as string) + 'T00:00:00Z') + 86_400_000
    const expiresAt = new Date(Math.min(Date.now() + APPROVAL_LINK_DAYS * 86_400_000, endOfValidity))
    const [req] = await t`insert into quotation_approvals (quotation_id, token_hash, expires_at, status) values (${id}, ${await sha256Hex(raw)}, ${expiresAt}, 'pending') returning id`
    const ver = await getVerification(t, 'quotation', id)
    const queued = await enqueue(t, 'quotation_approval_request', recipient.email as string, {
      customer_name: recipient.name, document_number: q.number, valid_until: q.validUntil,
      approval_url: `${baseUrl}/quotation-approval/${raw}`, approval_expiry: expiresAt.toISOString().slice(0, 10),
      verify_url: ver ? `${baseUrl}/verify/${ver.token}` : '',
    }, { attachmentKind: 'quotation', attachmentId: id, dedupeKey: `quotation-approval-${req.id}` })
    if (!queued) throw new ActionError('The email provider is not ready', 409)
    await t`update quotations set status = 'awaiting_approval' where id = ${id}`
    await recordAudit(t, actorId, 'send-approval-request', 'quotation', id, `Customer approval link #${req.id} expires ${expiresAt.toISOString()}`)
  })
}

export type ApprovalView = QuotationApprovalsRow & { quotationNumber: string; quotationStatus: string }

/** Finds an approval request by its bearer token. Only the SHA-256 of the token is stored. */
export async function approvalByToken(token: string): Promise<ApprovalView | null> {
  if (typeof token !== 'string' || token.length < 36 || token.length > 150) return null
  const [row] = await sql`select a.*, q.number as quotation_number, q.status as quotation_status from quotation_approvals a
                          join quotations q on q.id = a.quotation_id where a.token_hash = ${await sha256Hex(token)}`
  return (row as ApprovalView | undefined) ?? null
}

export const approvalIsOpen = (a: Pick<ApprovalView, 'status' | 'expiresAt' | 'quotationStatus'>) =>
  a.status === 'pending' && a.expiresAt.getTime() > Date.now() && a.quotationStatus === 'awaiting_approval'

export interface SubmissionInput { token: string; signerName: string; signerTitle: string; acknowledged: boolean; file: Uint8Array | null }

/** The customer's upload. It never approves anything by itself: it waits for Finance's manual review. */
export async function submitApproval(input: SubmissionInput): Promise<void> {
  if (!input.acknowledged) throw new ActionError('Authorization confirmation required')
  const signer = input.signerName.trim().slice(0, 180)
  const title = input.signerTitle.trim().slice(0, 180)
  if (signer.length < 3 || !title || !input.file || !input.file.length) throw new ActionError('Signatory, title and the signed PDF are required')
  if (input.file.length > maxUploadBytes()) throw new ActionError(`Upload a PDF not exceeding ${Math.floor(maxUploadBytes() / 1048576)} MB`)
  const hash = await sha256Hex(input.token)
  await tx(async (t) => {
    const [item] = await t`select * from quotation_approvals where token_hash = ${hash} for update`
    if (!item) throw new ActionError('This approval link is not valid', 404)
    const [q] = await t`select number, status from quotations where id = ${item.quotationId as number} for update`
    if (item.status !== 'pending' || (item.expiresAt as Date).getTime() < Date.now() || !q || q.status !== 'awaiting_approval') {
      throw new ActionError('This approval request has expired or was already used', 410)
    }
    const digest = await inspectSignedQuotation(input.file!, q.number as string)
    const key = `quotation-approvals/${item.id}/${randomBytes(22).toString('base64url')}.pdf`
    await putObject('documents', key, input.file!, 'application/pdf')
    await t`update quotation_approvals set signed_pdf_key = ${key}, signed_pdf_sha256 = ${digest}, signer_name = ${signer}, signer_title = ${title}, uploaded_at = now(), status = 'submitted' where id = ${item.id as number}`
    await recordAudit(t, null, 'customer-approval-upload', 'quotation', item.quotationId as number, `Customer submission #${item.id}, SHA256 ${digest}`)
  })
}

/** Finance's decision on a submitted file. Approval requires a manual look at the signature and company stamp. */
export async function reviewApproval(actorId: number, id: number, outcome: string, verified: boolean, note: string): Promise<number> {
  if (outcome !== 'approve' && outcome !== 'reject') throw new ActionError('Invalid review outcome')
  return tx(async (t) => {
    const [item] = await t`select * from quotation_approvals where id = ${id} for update`
    if (!item || item.status !== 'submitted') throw new ActionError('Only submitted approvals can be reviewed', 409)
    const [q] = await t`select * from quotations where id = ${item.quotationId as number} for update`
    if (!q || q.status !== 'awaiting_approval') throw new ActionError('The quotation is no longer awaiting approval', 409)
    if (outcome === 'approve' && !verified) throw new ActionError('Confirm that the signature and company stamp were reviewed manually')
    await t`update quotation_approvals set status = ${outcome === 'approve' ? 'approved' : 'rejected'}, reviewed_by = ${actorId}, reviewed_at = now(), review_note = ${note.slice(0, 2000)} where id = ${id}`
    await t`update quotations set status = ${outcome === 'approve' ? 'approved' : 'issued'} where id = ${q.id as number}`
    await recordAudit(t, actorId, `customer-quotation-${outcome}`, 'quotation', q.id as number, `Approval #${id}; PDF checksum ${item.signedPdfSha256}`)
    if (outcome === 'approve') {
      const conf = await getMailConfig(t)
      if (conf?.enabled) await enqueue(t, 'quotation_approved_admin', conf.adminEmail ?? 'info@voraworld.id', { document_number: q.number }, { dedupeKey: `quotation-approved-${id}` })
    }
    return q.id as number
  })
}

/** The customer's signed PDF, re-hashed on every read: a tampered or swapped file is refused. */
export async function readApprovalFile(id: number): Promise<{ bytes: Uint8Array; quotationNumber: string }> {
  const [item] = await sql`select a.signed_pdf_key, a.signed_pdf_sha256, q.number from quotation_approvals a join quotations q on q.id = a.quotation_id where a.id = ${id}`
  if (!item?.signedPdfKey) throw new ActionError('No signed PDF has been uploaded', 404)
  const bytes = await getObject('documents', item.signedPdfKey as string, maxUploadBytes() + 1)
  if ((await sha256Hex(bytes)) !== item.signedPdfSha256) throw new ActionError('The stored PDF does not match its recorded fingerprint', 409)
  return { bytes, quotationNumber: item.number as string }
}
