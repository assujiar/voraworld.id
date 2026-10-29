import { sql, tx } from './db'
import { ensurePublicCode, nextNumber } from './numbering'
import { enqueue } from './mail/outbox'
import { getMailConfig } from './mail/config'
import { publicBaseUrl } from './env'
import { ActionError } from './errors'

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
