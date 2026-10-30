import { many } from '../data'

export interface MailLine { id: number; event: string; recipient: string; status: string; attempts: number; error: string; createdAt: Date; sentAt: Date | null; attachments: number }

/** The messages that carried a document, newest first: queued, sent, failed or waiting to be retried, so a person can see what really happened. */
export async function mailHistory(kind: 'invoice' | 'receipt' | 'quotation' | 'prepayment', documentId: number): Promise<MailLine[]> {
  const direct = await many('email_jobs', (q) => q.eq('attachment_kind', kind).eq('attachment_id', documentId), 'id,event,recipient,status,attempts,error,created_at,sent_at')
  const linked = await many('email_job_attachments', (q) => q.eq('kind', kind).eq('document_id', documentId), 'job_id')
  const extra = linked.length ? await many('email_jobs', (q) => q.in('id', linked.map((l) => l.jobId as number)), 'id,event,recipient,status,attempts,error,created_at,sent_at') : []
  const all = [...new Map([...direct, ...extra].map((j) => [j.id as number, j])).values()].sort((a, b) => (b.id as number) - (a.id as number))
  const counts = all.length ? await many('email_job_attachments', (q) => q.in('job_id', all.map((j) => j.id as number)), 'job_id') : []
  return all.map((j) => ({
    id: j.id as number, event: j.event as string, recipient: j.recipient as string, status: j.status as string, attempts: j.attempts as number, error: String(j.error ?? ''),
    createdAt: j.createdAt as Date, sentAt: (j.sentAt as Date | null) ?? null, attachments: counts.filter((c) => c.jobId === j.id).length || 1,
  }))
}
