import { randomBytes } from 'node:crypto'
import { one, rpc } from '../data'
import { sha256Hex } from '../crypto'
import { isoDay, today } from '../dates'
import { maxUploadBytes, publicBaseUrl } from '../env'
import { ActionError, isUnique } from '../errors'
import { emailAddress } from '../mail/address'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { calcLines } from '../money'
import type { QuotationApprovalsRow } from '../schema'
import { getObject, putObject, removeObject } from '../storage'
import { approvalSecret, approvalToken } from './approval-token'
import { bestEffort } from './notify'
import { chargeLines, moneyErrors, type ChargeRow } from './parse'
import { inspectSignedQuotation } from './pdf-inspect'

export interface QuotationInput {
  /** The customer the quotation is for. Required: the customer is the commercial entity. */
  customerId: number
  /** The lead that brought the business, if there was one. Never required, never created here. */
  leadId?: number | null
  issuedAt: string; validUntil: string; taxPercent: string
  /** What the customer must pay and when (printed on the quotation and shown before the customer signs). */
  paymentTerms: string
  /** The terms and conditions the customer's signature accepts. */
  termsConditions: string
  /** Anything else worth printing; optional. */
  notes: string
  /** The charge table: description, quantity, unit, unit price. */
  rows: ChargeRow[]
  /** The customer's contact person this quotation is addressed to. */
  picName?: string; picEmail?: string; picPhone?: string
  /** What is being quoted. */
  serviceMode?: string; origin?: string; destination?: string; cargoInfo?: string
}

export const MAX_PAYMENT_TERMS = 1000
export const MAX_TERMS_CONDITIONS = 6000

/** Legal wording is refused when it is too long, never cut short: a truncated clause is worse than none. */
function requiredText(value: string, label: string, max: number): string {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim()
  if (text.length < 3) throw new ActionError(`Enter the ${label}`)
  if (text.length > max) throw new ActionError(`The ${label} are too long (${text.length} of ${max} characters). Shorten them`)
  return text
}

export async function createQuotation(actorId: number, input: QuotationInput): Promise<number> {
  if (!input.customerId) throw new ActionError('Select the customer this quotation is for')
  const customer = await one('customers', (q) => q.eq('id', input.customerId), 'id,currency')
  if (!customer) throw new ActionError('Select an existing customer')
  const lines = chargeLines(input.rows)
  const issued = isoDay(input.issuedAt, today(), 'Issue date')
  const expiry = isoDay(input.validUntil, issued, 'Valid until')
  if (expiry < issued) throw new ActionError('Validity must not precede the issue date')
  const taxPercent = input.taxPercent.trim().slice(0, 20) || '0'
  const paymentTerms = requiredText(input.paymentTerms, 'terms of payment', MAX_PAYMENT_TERMS)
  const termsConditions = requiredText(input.termsConditions, 'terms and conditions', MAX_TERMS_CONDITIONS)
  const leadId = input.leadId || null
  if (leadId && !(await one('leads', (q) => q.eq('id', leadId), 'id'))) throw new ActionError('The lead does not exist')
  const currency = customer.currency as string
  const amounts = moneyErrors(() => calcLines(lines, currency, taxPercent))
  const text = (v: string | undefined, max: number, label: string) => {
    const t = String(v ?? '').replace(/\u0000/g, '').trim()
    if (t.length > max) throw new ActionError(`${label} is too long (at most ${max} characters)`)
    return t
  }
  let picEmail = text(input.picEmail, 200, 'The contact person\'s email')
  if (picEmail) { try { picEmail = emailAddress(picEmail) } catch { throw new ActionError('The contact person\'s email is not a valid address') } }
  try {
    return await rpc<number>('quotation_create', {
      p_actor: actorId,
      p: {
        customer_id: customer.id, lead_id: leadId, currency, issued_at: issued, valid_until: expiry, payment_terms: paymentTerms, terms_conditions: termsConditions,
        notes: input.notes.slice(0, 2500), tax_percent: taxPercent, subtotal_minor: amounts.subtotalMinor, tax_minor: amounts.taxMinor, total_minor: amounts.totalMinor,
        pic_name: text(input.picName, 160, 'The contact person\'s name'), pic_email: picEmail, pic_phone: text(input.picPhone, 60, 'The contact person\'s phone number'),
        service_mode: text(input.serviceMode, 120, 'The service'), origin: text(input.origin, 240, 'Origin'), destination: text(input.destination, 240, 'Destination'),
        cargo_info: text(input.cargoInfo, 3000, 'The cargo information'),
        items: amounts.items.map((i) => ({ description: i.description, unit: i.unit, quantity: i.quantity, price_minor: i.priceMinor, amount_minor: i.amountMinor })),
      },
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Quotation numbering collision, please retry', 409)
    throw e
  }
}

/** issue: draft -> issued. void: any live state -> void, revoking the QR link and any open approval link (a validated one only while nothing was made from it). */
export async function setQuotationStatus(actorId: number, id: number, action: string): Promise<void> {
  await rpc('quotation_set_status', { p_actor: actorId, p_id: id, p_action: action })
}

const APPROVAL_LINK_DAYS = 14

/** Sends the quotation PDF with a private, expiring upload link. Earlier pending links are revoked. */
export async function requestApproval(actorId: number, id: number, baseUrl: string): Promise<void> {
  const q = await one('quotations', (f) => f.eq('id', id))
  if (!q) throw new ActionError('Quotation not found', 404)
  if (!['issued', 'awaiting_approval', 'rejected'].includes(q.status as string)) throw new ActionError('Issue the quotation before requesting customer approval', 409)
  if ((q.validUntil as string) < today()) throw new ActionError('Quotation validity has expired', 409)
  // A quotation is for the customer (the contact person it is addressed to first). A historical quotation made for a lead only goes to that lead.
  const recipient = q.customerId
    ? await one('customers', (f) => f.eq('id', q.customerId as number), 'name,email,pic_name,pic_email')
    : await one('leads', (f) => f.eq('id', q.leadId as number), 'company,name,email')
  const recipientEmail = q.customerId ? ((q.picEmail as string) || (recipient?.picEmail as string) || (recipient?.email as string)) : (recipient?.email as string)
  if (!recipient || !recipientEmail) throw new ActionError('The customer needs an email address first (the contact person\'s or the billing email)')
  const recipientName = q.customerId ? recipient.name : (recipient.company as string) || recipient.name
  const conf = await getMailConfig()
  const rule = await one('email_rules', (f) => f.eq('key', 'quotation_approval_request'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Configure SMTP and enable the quotation approval email rule first', 409)

  // The link is derived from the request's own number (see approval-token.ts), so the number is taken from the sequence first.
  const approvalId = await rpc<number>('quotation_approval_next_id')
  const raw = approvalToken(await approvalSecret(), approvalId)
  const endOfValidity = Date.parse((q.validUntil as string) + 'T00:00:00Z') + 86_400_000
  const expiresAt = new Date(Math.min(Date.now() + APPROVAL_LINK_DAYS * 86_400_000, endOfValidity))
  const opened = await rpc<{ number: string; valid_until: string; verification_token: string }>('quotation_request_approval', {
    p_actor: actorId, p_id: id, p_approval: approvalId, p_token_hash: await sha256Hex(raw), p_expires_at: expiresAt.toISOString(),
  })
  const queued = await enqueue('quotation_approval_request', recipientEmail, {
    customer_name: recipientName, document_number: opened.number, valid_until: opened.valid_until,
    approval_url: `${baseUrl}/quotation-approval/${raw}`, approval_expiry: expiresAt.toISOString().slice(0, 10),
    verify_url: opened.verification_token ? `${baseUrl}/verify/${opened.verification_token}` : '',
  }, { attachmentKind: 'quotation', attachmentId: id, dedupeKey: `quotation-approval-${approvalId}` })
  if (!queued) throw new ActionError('The email provider is not ready', 409)
}

/** The approval request plus what the customer is being asked to accept: shown on the private page before anything is signed. */
export type ApprovalView = QuotationApprovalsRow & {
  quotationNumber: string; quotationStatus: string
  validUntil: string; currency: string; totalMinor: number; paymentTerms: string; termsConditions: string
}

/** Finds an approval request by its bearer token. Only the SHA-256 of the token is stored. */
export async function approvalByToken(token: string): Promise<ApprovalView | null> {
  if (typeof token !== 'string' || token.length < 36 || token.length > 150) return null
  const hash = await sha256Hex(token)
  const a = await one('quotation_approvals', (q) => q.eq('token_hash', hash))
  return a ? withQuotation(a) : null
}

async function withQuotation(a: Record<string, unknown>): Promise<ApprovalView> {
  const q = await one('quotations', (f) => f.eq('id', a.quotationId as number), 'number,status,valid_until,currency,total_minor,payment_terms,terms_conditions')
  return {
    ...(a as unknown as QuotationApprovalsRow), quotationNumber: q!.number as string, quotationStatus: q!.status as string, validUntil: q!.validUntil as string,
    currency: q!.currency as string, totalMinor: q!.totalMinor as number, paymentTerms: q!.paymentTerms as string, termsConditions: q!.termsConditions as string,
  }
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
  const item = await one('quotation_approvals', (q) => q.eq('token_hash', hash))
  if (!item) throw new ActionError('This approval link is not valid', 404)
  const q = await one('quotations', (f) => f.eq('id', item.quotationId as number), 'number,status')
  if (item.status !== 'pending' || (item.expiresAt as Date).getTime() < Date.now() || !q || q.status !== 'awaiting_approval') {
    throw new ActionError('This approval request has expired or was already used', 410)
  }
  const digest = await inspectSignedQuotation(input.file, q.number as string)
  let submitted: { approval_id: number; quotation_id: number; number: string; signer_name: string; signer_title: string; customer_id: number | null }
  const key = `quotation-approvals/${item.id}/${randomBytes(22).toString('base64url')}.pdf`
  await putObject('documents', key, input.file, 'application/pdf')
  try {
    submitted = await rpc('approval_submit', { p_token_hash: hash, p_key: key, p_sha256: digest, p_signer: signer, p_title: title })
  } catch (e) {
    await removeObject('documents', key)       // someone else used the link first: do not leave this file behind
    throw e
  }
  // The quotation is now APPROVED BY THE CUSTOMER (not yet validated). VORA's administrator is told; a mail problem never undoes the upload.
  await bestEffort('quotation_customer_approved_admin', async () => {
    const conf = await getMailConfig()
    if (!conf?.enabled) return
    const c = submitted.customer_id ? await one('customers', (f) => f.eq('id', submitted.customer_id as number), 'name') : undefined
    await enqueue('quotation_customer_approved_admin', conf.adminEmail ?? 'info@voraworld.id', {
      document_number: submitted.number, customer_name: (c?.name as string) ?? '', signer_name: submitted.signer_name, signer_title: submitted.signer_title,
      admin_url: `${publicBaseUrl()}/admin/quotations/${submitted.quotation_id}`,
    }, { dedupeKey: `quotation-customer-approved-${submitted.approval_id}` })
  })
}

/**
 * VORA's decision on the file the customer uploaded. Validation (after looking at the signature and the company stamp by hand) is a separate
 * step from the customer's upload and is never automatic; a rejection needs a reason and lets the quotation be sent again.
 */
export async function reviewApproval(actorId: number, id: number, outcome: string, verified: boolean, note: string): Promise<number> {
  if (outcome !== 'approve' && outcome !== 'reject') throw new ActionError('Invalid review outcome')
  const r = await rpc<{ quotation_id: number; number: string; customer_id: number | null }>('approval_review', { p_actor: actorId, p_id: id, p_outcome: outcome, p_verified: verified, p_note: note.slice(0, 2000) })
  if (outcome === 'approve' && r.customer_id) {
    await bestEffort('quotation_validated_customer', async () => {
      const q = await one('quotations', (f) => f.eq('id', r.quotation_id), 'pic_email')
      const c = await one('customers', (f) => f.eq('id', r.customer_id as number), 'name,email,pic_email')
      const to = ((q?.picEmail as string) || (c?.picEmail as string) || (c?.email as string)) ?? ''
      if (to) await enqueue('quotation_validated_customer', to, { customer_name: c?.name ?? '', document_number: r.number }, { dedupeKey: `quotation-validated-${id}`, verify: [{ kind: 'quotation', id: r.quotation_id }] })
    })
  }
  return r.quotation_id
}

/** The customer's signed PDF, re-hashed on every read: a tampered or swapped file is refused. */
export async function readApprovalFile(id: number): Promise<{ bytes: Uint8Array; quotationNumber: string }> {
  const item = await one('quotation_approvals', (q) => q.eq('id', id), 'signed_pdf_key,signed_pdf_sha256,quotation_id')
  if (!item?.signedPdfKey) throw new ActionError('No signed PDF has been uploaded', 404)
  const q = await one('quotations', (f) => f.eq('id', item.quotationId as number), 'number')
  const bytes = await getObject('documents', item.signedPdfKey as string, maxUploadBytes() + 1)
  if ((await sha256Hex(bytes)) !== item.signedPdfSha256) throw new ActionError('The stored PDF does not match its recorded fingerprint', 409)
  return { bytes, quotationNumber: q!.number as string }
}
