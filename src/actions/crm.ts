'use server'
import { ActionError, adminRun } from '@/server/action'
import { recordAudit } from '@/server/audit'
import { tx } from '@/server/db'
import { afterResponse } from '@/server/after'
import { publicBaseUrl } from '@/server/env'
import { int, rawStr, str } from '@/server/http'
import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/server/lead-constants'
import { replyToLead } from '@/server/leads'
import { dispatch } from '@/server/mail/outbox'

export async function updateLeadAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const status = str(form, 'status', 30)
    if (!LEAD_STATUSES.includes(status)) throw new ActionError('Invalid lead status')
    const priority = LEAD_PRIORITIES.includes(str(form, 'priority', 20)) ? str(form, 'priority', 20) : 'normal'
    await tx(async (t) => {
      const [lead] = await t`select id from leads where id = ${id} for update`
      if (!lead) throw new ActionError('Lead not found', 404)
      await t`update leads set status = ${status}, priority = ${priority}, assignee = ${str(form, 'assignee', 160)}, followup = ${str(form, 'followup', 30)}, updated_at = now() where id = ${id}`
      const note = str(form, 'note', 3000)
      if (note) await t`insert into lead_activities (lead_id, actor_id, message) values (${id}, ${user.id}, ${note})`
      await recordAudit(t, user.id, 'update', 'lead', id, status)
    })
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
