'use server'
import { ActionError, adminRun } from '@/server/action'
import { recordAudit } from '@/server/audit'
import { sql, tx } from '@/server/db'
import { int, str } from '@/server/http'

import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/server/lead-constants'

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
    void sql
    return { to: `/admin/leads/${id}`, notice: 'Lead updated' }
  })
}
