import { one, rpc } from '@/server/data'
import { getMailConfig } from '@/server/mail/config'
import { send } from '@/server/mail/transport'
import { publicBaseUrl } from '@/server/env'
import { renderBroadcast } from './content'

interface Claim {
  id: number; attempt_id: number; campaign_id: number; contact_id: number; email: string; subject: string; html: string
  company_name: string; pic_name: string; position: string; unsubscribe_token: string
}
export interface BroadcastDispatchResult { claimed: number; sent: number; failed: number; uncertain: number; reason?: string }

/** Five sends per call, claim reservations and the rolling-hour cap are global and atomic in Postgres. */
export async function dispatchBroadcast(batch = 5): Promise<BroadcastDispatchResult> {
  const conf = await getMailConfig()
  if (!conf?.enabled) return { claimed: 0, sent: 0, failed: 0, uncertain: 0, reason: 'SMTP disabled' }
  const claims = await rpc<Claim[]>('broadcast_claim', { p_limit: Math.max(1, Math.min(5, Math.trunc(batch))) })
  const result: BroadcastDispatchResult = { claimed: claims.length, sent: 0, failed: 0, uncertain: 0 }
  const outcomes = await Promise.allSettled(claims.map(async (job): Promise<'sent'|'failed'|'uncertain'> => {
    // A contact may unsubscribe after the claim was reserved. Re-check immediately before SMTP.
    let smtpAccepted = false
    let failure = ''
    try {
      const contact = await one('broadcast_contacts', q => q.eq('id',job.contact_id), 'email,consent_status')
      if (!contact || contact.consentStatus !== 'subscribed' || contact.email !== job.email) throw new Error('Contact no longer subscribed')
      const url = `${publicBaseUrl()}/unsubscribe?token=${encodeURIComponent(job.unsubscribe_token)}`
      const { subject, html } = renderBroadcast(job.subject, job.html, {
        company_name: job.company_name, pic_name: job.pic_name, position: job.position, email: job.email,
      }, url)
      await send(conf, job.email, subject, html, undefined, { unsubscribeUrl: `${publicBaseUrl()}/unsubscribe/one-click?token=${encodeURIComponent(job.unsubscribe_token)}` })
      smtpAccepted = true
    } catch (error) { failure = (error instanceof Error ? error.message : String(error)).slice(0, 500) }
    // If SMTP accepted a message but the acknowledgement fails, never auto-retry it.
    // The DB lease recovery will mark its outcome unknown, requiring manual review.
    try {
      await rpc('broadcast_finish', { p_delivery: job.id, p_attempt: job.attempt_id, p_success: smtpAccepted, p_error: failure })
    } catch (error) {
      console.error('Broadcast acknowledgement failed',job.id,error instanceof Error ? error.message : 'Unknown error')
      return 'uncertain'
    }
    return smtpAccepted ? 'sent' : 'failed'
  }))
  for (const r of outcomes) {
    if (r.status === 'rejected' || r.value === 'uncertain') result.uncertain++
    else if (r.value === 'sent') result.sent++
    else result.failed++
  }
  return result
}
