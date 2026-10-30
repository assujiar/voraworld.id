'use server'
import { ActionError, adminRun } from '@/server/action'
import { recordAudit } from '@/server/audit'
import { insert, one, update } from '@/server/data'
import { afterResponse } from '@/server/after'
import { publicBaseUrl } from '@/server/env'
import { int, rawStr, str } from '@/server/http'
import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/server/lead-constants'
import { convertLead, replyToLead } from '@/server/leads'
import { dispatch } from '@/server/mail/outbox'

export async function updateLeadAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const status = str(form, 'status', 30)
    if (!LEAD_STATUSES.includes(status)) throw new ActionError('Invalid lead status')
    const priority = LEAD_PRIORITIES.includes(str(form, 'priority', 20)) ? str(form, 'priority', 20) : 'normal'
    if (!(await one('leads', (f) => f.eq('id', id), 'id'))) throw new ActionError('Lead not found', 404)
    await update('leads', { status, priority, assignee: str(form, 'assignee', 160), followup: str(form, 'followup', 30), updated_at: new Date() }, (f) => f.eq('id', id))
    const note = str(form, 'note', 3000)
    if (note) await insert('lead_activities', { lead_id: id, actor_id: user.id, message: note })
    await recordAudit(user.id, 'update', 'lead', id, status)
    return { to: `/admin/leads/${id}`, notice: 'Lead updated' }
  })
}

export async function replyLeadAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await replyToLead(user.id, id, rawStr(form, 'message', 6000))
    afterResponse(() => dispatch(publicBaseUrl(), 10))
    return { to: `/admin/leads/${id}`, notice: 'Reply queued for sending. Check the SMTP outbox for delivery status' }
  })
}

/**
 * Saves the lead as a customer (a new one, reviewed in the form, or an existing one chosen from the list), keeping the lead as it was.
 * `then=quotation` goes straight on to a quotation for that customer, tied to this lead.
 */
export async function convertLeadAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const existing = int(form, 'existing_customer_id') || null
    const r = await convertLead(user.id, id, {
      existingCustomerId: existing,
      customer: existing ? undefined : {
        name: rawStr(form, 'name', 201), email: rawStr(form, 'email', 201), phone: rawStr(form, 'phone', 61), address: rawStr(form, 'address', 3000), taxId: rawStr(form, 'tax_id', 101),
        currency: str(form, 'currency', 3), termsDays: str(form, 'terms_days', 4),
        picName: rawStr(form, 'pic_name', 161), picPosition: rawStr(form, 'pic_position', 161), picEmail: rawStr(form, 'pic_email', 201), picPhone: rawStr(form, 'pic_phone', 61),
      },
      acknowledgeDuplicates: form.get('different_customer') === 'yes',
    })
    const notice = r.created ? 'Saved as a new customer' : 'Linked to the existing customer'
    return form.get('then') === 'quotation'
      ? { to: '/admin/quotations/new', query: `customer=${r.customerId}&lead=${id}`, notice }
      : { to: `/admin/leads/${id}`, notice }
  })
}
