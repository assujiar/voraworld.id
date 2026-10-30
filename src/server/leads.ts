import { insert, one, rpc, update } from './data'
import { enqueue } from './mail/outbox'
import { getMailConfig } from './mail/config'
import { publicBaseUrl } from './env'
import { ActionError } from './errors'
import { recordAudit } from './audit'
import { sha256Hex } from './crypto'

export interface InquiryInput {
  kind: 'contact' | 'rfq'
  name: string; email: string; message: string; company: string
  mode: string; origin: string; destination: string; cargo: string; pickup: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const INQUIRY_WINDOW_MINUTES = 15
export const INQUIRY_MAX_PER_EMAIL = 4

/** Validates, throttles per email address (in the database, so it holds across serverless instances) and stores a lead. */
export async function createLead(input: InquiryInput): Promise<{ id: number; reference: string }> {
  if (!input.name || !input.message || !EMAIL.test(input.email)) throw new ActionError('Name, message and valid email are required')
  if (input.kind === 'rfq' && (!input.mode || !input.origin || !input.destination)) throw new ActionError('Service, origin and destination required')
  const rfq = input.kind === 'rfq'
  const lead = await rpc<{ id: number; reference: string }>('lead_create', { p: { ...input, window_minutes: INQUIRY_WINDOW_MINUTES, max_per_email: INQUIRY_MAX_PER_EMAIL } })
  try {
    const conf = await getMailConfig()
    if (conf?.enabled) {
      const context = { lead_type: rfq ? 'RFQ' : 'contact', lead_id: lead.reference, name: input.name, company: input.company, email: input.email,
        mode: rfq ? input.mode : '', origin: rfq ? input.origin : '', destination: rfq ? input.destination : '', message: input.message,
        admin_url: `${publicBaseUrl()}/admin/leads/${lead.id}` }
      await enqueue('lead_admin', conf.adminEmail ?? 'info@voraworld.id', context, { dedupeKey: `lead-admin-${lead.id}` })
      await enqueue('lead_customer', input.email, context, { dedupeKey: `lead-customer-${lead.id}` })
    }
  } catch (e) {
    console.error('lead notification skipped:', e instanceof Error ? e.message : e)      // the enquiry is stored; a mail problem must not lose it
  }
  return lead
}

/**
 * Emails the person who wrote in, from the admin screen. It needs SMTP switched on and the `lead_reply` notification
 * enabled, so nothing leaves the building unless the owner has chosen to send mail. The reply is kept on the lead's timeline.
 */
export async function replyToLead(actorId: number, id: number, rawMessage: string): Promise<void> {
  const message = rawMessage.trim().slice(0, 6000)
  if (message.length < 2) throw new ActionError('Write the reply first')
  const lead = await one('leads', (q) => q.eq('id', id), 'id,name,email,reference,status')
  if (!lead) throw new ActionError('Lead not found', 404)
  if (!lead.email) throw new ActionError('This lead has no email address')
  const conf = await getMailConfig()
  const rule = await one('email_rules', (q) => q.eq('key', 'lead_reply'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the lead_reply email rule first (Admin → SMTP & Email Rules)', 409)
  const queued = await enqueue('lead_reply', lead.email as string, { name: lead.name, lead_id: (lead.reference as string) || String(id), reply_message: message },
    { dedupeKey: `lead-reply-${id}-${(await sha256Hex(message)).slice(0, 16)}-${Math.floor(Date.now() / 60_000)}` })      // the same text pressed twice in a minute is one email; a different text is another
  if (!queued) throw new ActionError('Email delivery is disabled', 409)
  await insert('lead_activities', { lead_id: id, actor_id: actorId, message: 'Replied by email: ' + message.slice(0, 500) })
  if (lead.status === 'new') await update('leads', { status: 'contacted', updated_at: new Date() }, (q) => q.eq('id', id))
  await recordAudit(actorId, 'reply', 'lead', id, 'Email reply queued')
}
