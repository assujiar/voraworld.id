'use server'
import { adminRun, ActionError } from '@/server/action'
import { one, update } from '@/server/data'
import { int } from '@/server/http'
import { recordAudit } from '@/server/audit'

/** Acknowledges a potential identity collision after an administrator has reviewed it. No auto-merge. */
export async function reviewAgentIdentity(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    if (!(await one('agent_identity_reviews', (q) => q.eq('id', id), 'id'))) throw new ActionError('Registration review not found', 404)
    await update('agent_identity_reviews', { status: 'reviewed', reviewed_at: new Date() }, (q) => q.eq('id', id))
    await recordAudit(user.id, 'update', 'agent_identity_review', id, 'Checked potential contact duplication')
    return { to: '/admin/agent-contacts', notice: 'Review acknowledged' }
  })
}
