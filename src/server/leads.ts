import { sql, tx } from './db'
import { ensurePublicCode, nextNumber } from './numbering'
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

/** Validates, throttles per email address (DB-backed, so it holds across serverless instances) and stores a lead. */
export async function createLead(input: InquiryInput): Promise<{ id: number; reference: string }> {
  if (!input.name || !input.message || !EMAIL.test(input.email)) throw new ActionError('Name, message and valid email are required')
  if (input.kind === 'rfq' && (!input.mode || !input.origin || !input.destination)) throw new ActionError('Service, origin and destination required')
  const since = new Date(Date.now() - INQUIRY_WINDOW_MINUTES * 60_000)
  const [{ n }] = await sql`select count(*)::int as n from leads where email = ${input.email} and created_at >= ${since}`
  if (n >= INQUIRY_MAX_PER_EMAIL) throw new ActionError('Too many submissions; try again later', 429)
  const rfq = input.kind === 'rfq'
  const lead = await tx(async (t) => {
    const [row] = await t`insert into leads (type, name, email, message, company, mode, origin, destination, cargo, pickup, source)
      values (${rfq ? 'RFQ' : 'contact'}, ${input.name}, ${input.email}, ${input.message}, ${input.company},
              ${rfq ? input.mode : ''}, ${rfq ? input.origin : ''}, ${rfq ? input.destination : ''}, ${rfq ? input.cargo : ''}, ${rfq ? input.pickup : ''}, 'website')
      returning id`
    const code = await ensurePublicCode(t, 'leads', row.id as number)
    const reference = await nextNumber(t, rfq ? 'RFQ' : 'INQ', code)
    await t`update leads set reference = ${reference} where id = ${row.id as number}`
    const conf = await getMailConfig(t)
    if (conf?.enabled) {
      const context = { lead_type: rfq ? 'RFQ' : 'contact', lead_id: reference, name: input.name, company: input.company, email: input.email,
        mode: rfq ? input.mode : '', origin: rfq ? input.origin : '', destination: rfq ? input.destination : '', message: input.message,
        admin_url: `${publicBaseUrl()}/admin/leads/${row.id}` }
      await enqueue(t, 'lead_admin', conf.adminEmail ?? 'info@voraworld.id', context, { dedupeKey: `lead-admin-${row.id}` })
      await enqueue(t, 'lead_customer', input.email, context, { dedupeKey: `lead-customer-${row.id}` })
    }
    return { id: row.id as number, reference }
  })
  return lead
}

/**
 * Emails the person who wrote in, from the admin screen. It needs SMTP switched on and the `lead_reply` notification
 * enabled, so nothing leaves the building unless the owner has chosen to send mail. The reply is kept on the lead's timeline.
 */
export async function replyToLead(actorId: number, id: number, rawMessage: string): Promise<void> {
  const message = rawMessage.trim().slice(0, 6000)
  if (message.length < 2) throw new ActionError('Write the reply first')
  await tx(async (t) => {
    const [lead] = await t`select id, name, email, reference, status from leads where id = ${id} for update`
    if (!lead) throw new ActionError('Lead not found', 404)
    if (!lead.email) throw new ActionError('This lead has no email address')
    const conf = await getMailConfig(t)
    const [rule] = await t`select enabled from email_rules where key = 'lead_reply'`
    if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the lead_reply email rule first (Admin → SMTP & Email Rules)', 409)
    const queued = await enqueue(t, 'lead_reply', lead.email as string, { name: lead.name, lead_id: (lead.reference as string) || String(id), reply_message: message },
      { dedupeKey: `lead-reply-${id}-${(await sha256Hex(message)).slice(0, 16)}-${Math.floor(Date.now() / 60_000)}` })      // the same text pressed twice in a minute is one email; a different text is another
    if (!queued) throw new ActionError('Email delivery is disabled', 409)
    await t`insert into lead_activities (lead_id, actor_id, message) values (${id}, ${actorId}, ${'Replied by email: ' + message.slice(0, 500)})`
    if (lead.status === 'new') await t`update leads set status = 'contacted', updated_at = now() where id = ${id}`
    await recordAudit(t, actorId, 'reply', 'lead', id, 'Email reply queued')
  })
}
