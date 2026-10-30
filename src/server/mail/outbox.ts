import { insert, many, one, rpc, toRows, update, upsert } from '../data'
import { emailAddress } from './address'
import { getMailConfig } from './config'
import { renderTemplate } from './template'
import { send, type Attachment } from './transport'

export interface EnqueueOptions { attachmentKind?: 'invoice' | 'receipt' | 'quotation' | 'prepayment' | 'delivery' | 'pod'; attachmentId?: number; force?: boolean; dedupeKey?: string }
export const MAX_ATTEMPTS = 5
const LEASE_MINUTES = 10

/** Queues a message if SMTP is enabled and the event's rule is on. `dedupeKey` makes the call idempotent. */
export async function enqueue(event: string, recipient: string, context: Record<string, unknown>, opts: EnqueueOptions = {}) {
  const rule = await one('email_rules', (q) => q.eq('key', event), 'enabled')
  if (!opts.force && !rule?.enabled) return null
  const conf = await getMailConfig()
  if (!conf?.enabled) return null
  const to = emailAddress(recipient)
  const { subject, html } = await renderTemplate(event, context)
  if (opts.dedupeKey) {
    const prior = await one('email_jobs', (q) => q.eq('dedupe_key', opts.dedupeKey!), 'id,status')
    if (prior) return prior as { id: number; status: string }
  }
  const row = { event, recipient: to, subject, html, attachment_kind: opts.attachmentKind ?? null, attachment_id: opts.attachmentId ?? null, status: 'queued', attempts: 0, dedupe_key: opts.dedupeKey ?? null }
  if (!opts.dedupeKey) return (await insert('email_jobs', row))[0] as { id: number; status: string }
  // Two requests with the same dedupe key at once: the unique index keeps one row (the other insert is ignored) and both get that one back.
  const [created] = await upsert('email_jobs', row, 'dedupe_key', true)
  return (created ?? (await one('email_jobs', (q) => q.eq('dedupe_key', opts.dedupeKey!), 'id,status'))) as { id: number; status: string }
}

export interface DispatchResult { sent: number; failed: number; reason?: string }

const ATTACHMENT_TABLE = { invoice: 'invoices', receipt: 'receipts', quotation: 'quotations', prepayment: 'prepayment_receipts' } as const
export type AttachmentKind = keyof typeof ATTACHMENT_TABLE

/** Queues ONE message that carries several attachments, all or nothing, once per `dedupeKey`. The same rules as `enqueue`: SMTP on, the event's rule on. */
export async function enqueueWithAttachments(event: string, recipient: string, context: Record<string, unknown>, attachments: Array<{ kind: AttachmentKind; id: number }>,
  opts: { dedupeKey: string; force?: boolean }) {
  const rule = await one('email_rules', (q) => q.eq('key', event), 'enabled')
  if (!opts.force && !rule?.enabled) return null
  const conf = await getMailConfig()
  if (!conf?.enabled) return null
  const to = emailAddress(recipient)
  const { subject, html } = await renderTemplate(event, context)
  return rpc<{ id: number; status: string; created: boolean }>('mail_enqueue', { p: { event, recipient: to, subject, html, dedupe_key: opts.dedupeKey, attachments: attachments.map((a) => ({ kind: a.kind, id: a.id })) } })
}

/** Builds the PDF to attach, refusing documents that must not be released yet. */
async function attachmentOf(kind: string, documentId: number, baseUrl: string): Promise<Attachment> {
  const { renderDocumentPdf } = await import('../pdf/documents')
  if (!(kind in ATTACHMENT_TABLE)) throw new Error('Unsupported email attachment')
  const doc = await one(ATTACHMENT_TABLE[kind as AttachmentKind], (q) => q.eq('id', documentId))
  if (!doc || ['void', 'draft', 'pending_stamp', 'pending_confirmation'].includes(doc.status as string)) throw new Error('Attachment is not eligible for sending')
  if (kind === 'receipt') {
    const payment = await one('payments', (q) => q.eq('id', doc.paymentId as number), 'status')
    if (payment?.status !== 'recorded') throw new Error('Receipt payment not confirmed')
    if (doc.stampRequired && !doc.stampStorageKey) throw new Error('Required e-meterai not uploaded')
  }
  if (kind === 'prepayment' && doc.stampRequired && !doc.stampStorageKey) throw new Error('Required e-meterai not uploaded')
  const ver = await one('document_verification_tokens', (q) => q.eq('kind', kind).eq('document_id', documentId).order('id'), 'revoked')
  if (!ver || ver.revoked) throw new Error('Verification token missing or revoked')
  return { filename: `${doc.number}.pdf`, content: await renderDocumentPdf(kind as 'invoice', documentId, baseUrl) }
}

/**
 * The attachments of a message: those of its own list (a package) or its single one. EVERY attachment must be ready: if one is not, nothing is
 * sent and the message is retried later - a package is never sent half.
 */
async function attachmentsFor(job: { id: number; attachmentKind: string | null; attachmentId: number | null }, baseUrl: string): Promise<Attachment | Attachment[] | undefined> {
  const list = await many('email_job_attachments', (q) => q.eq('job_id', job.id).order('position').order('id'), 'kind,document_id')
  if (list.length) return Promise.all(list.map((a) => attachmentOf(a.kind as string, a.documentId as number, baseUrl)))
  return job.attachmentKind ? attachmentOf(job.attachmentKind, job.attachmentId as number, baseUrl) : undefined
}

/**
 * Sends due messages. Jobs are claimed atomically (see `mail_claim`), so two cron workers or an admin click can never send the same
 * message twice, and a crashed worker's jobs are picked up again.
 */
export async function dispatch(baseUrl: string, limit = 10): Promise<DispatchResult> {
  const conf = await getMailConfig()
  if (!conf?.enabled) return { sent: 0, failed: 0, reason: 'SMTP disabled' }
  const jobs = toRows('email_jobs', await rpc<unknown[]>('mail_claim', { p_limit: limit, p_lease_minutes: LEASE_MINUTES }))
  const result: DispatchResult = { sent: 0, failed: 0 }
  for (const job of [...jobs].sort((a, b) => (a.id as number) - (b.id as number))) {
    try {
      const attachment = await attachmentsFor(job as never, baseUrl)
      await send(conf, job.recipient as string, job.subject as string, job.html as string, attachment)
      await update('email_jobs', { status: 'sent', attempts: (job.attempts as number) + 1, error: '', sent_at: new Date() }, (q) => q.eq('id', job.id as number))
      result.sent++
    } catch (e) {
      const attempts = (job.attempts as number) + 1
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 350)
      await update('email_jobs', {
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'retry', attempts, error: message, next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
      }, (q) => q.eq('id', job.id as number))
      result.failed++
    }
  }
  return result
}

/** Puts a failed or waiting message back in the queue (admin "Retry"). */
export async function retryJob(actorId: number, id: number): Promise<void> {
  await rpc('mail_retry', { p_actor: actorId, p_id: id })
}

