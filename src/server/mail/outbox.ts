import type { Db } from '../db'
import { sql } from '../db'
import { recordAudit } from '../audit'
import { emailAddress } from './address'
import { getMailConfig } from './config'
import { renderTemplate } from './template'
import { send, type Attachment } from './transport'

export interface EnqueueOptions { attachmentKind?: 'invoice' | 'receipt' | 'quotation'; attachmentId?: number; force?: boolean; dedupeKey?: string }
export const MAX_ATTEMPTS = 5
const LEASE_MINUTES = 10

/** Queues a message if SMTP is enabled and the event's rule is on. `dedupeKey` makes the call idempotent. */
export async function enqueue(db: Db, event: string, recipient: string, context: Record<string, unknown>, opts: EnqueueOptions = {}) {
  const [rule] = await db`select enabled from email_rules where key = ${event}`
  if (!opts.force && !rule?.enabled) return null
  const conf = await getMailConfig(db)
  if (!conf?.enabled) return null
  const to = emailAddress(recipient)
  const { subject, html } = await renderTemplate(db, event, context)
  if (opts.dedupeKey) {
    const [prior] = await db`select id, status from email_jobs where dedupe_key = ${opts.dedupeKey}`
    if (prior) return prior as { id: number; status: string }
  }
  const [job] = await db`insert into email_jobs (event, recipient, subject, html, attachment_kind, attachment_id, status, attempts, dedupe_key)
    values (${event}, ${to}, ${subject}, ${html}, ${opts.attachmentKind ?? null}, ${opts.attachmentId ?? null}, 'queued', 0, ${opts.dedupeKey ?? null})
    on conflict (dedupe_key) do update set dedupe_key = excluded.dedupe_key returning id, status`
  return job as { id: number; status: string }
}

export interface DispatchResult { sent: number; failed: number; reason?: string }

/** Builds the PDF to attach, refusing documents that must not be released yet. */
async function attachmentFor(db: Db, job: { attachmentKind: string; attachmentId: number }, baseUrl: string): Promise<Attachment> {
  const { renderDocumentPdf } = await import('../pdf/documents')
  const kind = job.attachmentKind
  if (!['invoice', 'receipt', 'quotation'].includes(kind)) throw new Error('Unsupported email attachment')
  const table = { invoice: 'invoices', receipt: 'receipts', quotation: 'quotations' }[kind as 'invoice']
  const [doc] = await db`select * from ${db(table)} where id = ${job.attachmentId}`
  if (!doc || ['void', 'draft', 'pending_stamp', 'pending_confirmation'].includes(doc.status as string)) throw new Error('Attachment is not eligible for sending')
  if (kind === 'receipt') {
    const [payment] = await db`select status from payments where id = ${doc.paymentId}`
    if (payment?.status !== 'recorded') throw new Error('Receipt payment not confirmed')
    if (doc.stampRequired && !doc.stampStorageKey) throw new Error('Required e-meterai not uploaded')
  }
  const [ver] = await db`select revoked from document_verification_tokens where kind = ${kind} and document_id = ${job.attachmentId} order by id limit 1`
  if (!ver || ver.revoked) throw new Error('Verification token missing or revoked')
  return { filename: `${doc.number}.pdf`, content: await renderDocumentPdf(db, kind as 'invoice', job.attachmentId, baseUrl) }
}

/**
 * Sends due messages. Jobs are claimed atomically (`for update skip locked` + a 10-minute lease), so two cron
 * workers or an admin click can never send the same message twice, and a crashed worker's jobs are picked up again.
 */
export async function dispatch(baseUrl: string, limit = 10): Promise<DispatchResult> {
  const conf = await getMailConfig(sql)
  if (!conf?.enabled) return { sent: 0, failed: 0, reason: 'SMTP disabled' }
  const n = Math.min(Math.max(limit, 1), 30)
  const jobs = await sql`
    update email_jobs set status = 'sending', next_attempt_at = now() + make_interval(mins => ${LEASE_MINUTES})
    where id in (select id from email_jobs where status in ('queued', 'retry', 'sending') and next_attempt_at <= now()
                 order by id limit ${n} for update skip locked)
    returning *`
  const result: DispatchResult = { sent: 0, failed: 0 }
  for (const job of [...jobs].sort((a, b) => (a.id as number) - (b.id as number))) {
    try {
      const attachment = job.attachmentKind ? await attachmentFor(sql, job as never, baseUrl) : undefined
      await send(conf, job.recipient as string, job.subject as string, job.html as string, attachment)
      await sql`update email_jobs set status = 'sent', attempts = attempts + 1, error = '', sent_at = now() where id = ${job.id as number}`
      result.sent++
    } catch (e) {
      const attempts = (job.attempts as number) + 1
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 350)
      await sql`update email_jobs set status = ${attempts >= MAX_ATTEMPTS ? 'failed' : 'retry'}, attempts = ${attempts}, error = ${message},
                  next_attempt_at = now() + make_interval(mins => ${Math.min(60, 2 ** attempts)}) where id = ${job.id as number}`
      result.failed++
    }
  }
  return result
}

/** Puts a failed or waiting message back in the queue (admin "Retry"). */
export async function retryJob(actorId: number, id: number): Promise<void> {
  await sql.begin(async (t) => {
    const [job] = await t`select id, status, event from email_jobs where id = ${id} for update`
    if (!job) throw Object.assign(new Error('Message not found'), { status: 404 })
    if (!['failed', 'retry'].includes(job.status as string)) throw Object.assign(new Error('Only failed or waiting messages can be retried'), { status: 409 })
    await t`update email_jobs set status = 'queued', attempts = 0, error = '', next_attempt_at = now() where id = ${id}`
    await recordAudit(t, actorId, 'retry', 'email-job', id, job.event as string)
  })
}
