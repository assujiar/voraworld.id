'use server'
import { ActionError, adminRun } from '@/server/action'
import { recordAudit } from '@/server/audit'
import { insert, one, many, remove, rpc, update } from '@/server/data'
import { removeObject } from '@/server/storage'
import { getKnowledgeId, getKnowledgeRevision, inputFromForm, knowledgePayload, type KnowledgeInput } from '@/server/agent/knowledge-admin'

function snapshot(input: KnowledgeInput, row: Record<string, unknown>) {
  return { ...knowledgePayload(input), status: row.status, published_revision: row.publishedRevision, attachment_name: row.attachmentName, attachment_key: row.attachmentKey }
}

export async function saveAgentKnowledge(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const input = inputFromForm(form)
    const id = Number(form.get('record') || 0)
    if (id && (!Number.isSafeInteger(id) || id < 1)) throw new ActionError('Invalid article ID')
    let savedId: number
    let revision = 1
    if (!id) {
      const rows = await insert('agent_knowledge', { ...knowledgePayload(input), status: 'draft', created_by: user.id, updated_by: user.id })
      savedId = Number(rows[0].id)
    } else {
      const expected = getKnowledgeRevision(form)
      const existing = await one('agent_knowledge', (q) => q.eq('id', id), 'id,revision,status,published_revision,attachment_name,attachment_key')
      if (!existing) throw new ActionError('Article not found')
      if (Number(existing.revision) !== expected) throw new ActionError('Article changed. Refresh before saving.')
      const rows = await update('agent_knowledge', {
        ...knowledgePayload(input), revision: expected + 1, updated_by: user.id, updated_at: new Date(),
      }, (q) => q.eq('id', id).eq('revision', expected))
      if (!rows.length) throw new ActionError('Article changed. Refresh before saving.')
      savedId = id
      revision = expected + 1
    }
    const newRow = await one('agent_knowledge', (q) => q.eq('id', savedId), 'id,status,published_revision,attachment_name,attachment_key')
    await insert('agent_knowledge_revisions', { document_id: savedId, revision, snapshot: snapshot(input, newRow || {}), actor_id: user.id, action: 'save' })
    await recordAudit(user.id, id ? 'update' : 'create', 'agent_knowledge', savedId, `Saved draft: ${input.titleEn || input.titleId}`)
    return { to: `/admin/agent-knowledge/${savedId}`, notice: 'Draft saved. Publish to make changes available to the agent.' }
  })
}

export async function changeAgentKnowledgeStatus(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = getKnowledgeId(form)
    const expected = getKnowledgeRevision(form)
    const action = String(form.get('operation'))
    const row = await one('agent_knowledge', (q) => q.eq('id', id), 'id,revision,status,title_en,title_id,body_en,body_id,category,source_url,attachment_key,attachment_name,published_revision')
    if (!row) throw new ActionError('Article not found')
    if (Number(row.revision) !== expected) throw new ActionError('Article changed. Refresh before continuing.')
    if (action === 'publish') {
      await rpc<number>('agent_knowledge_publish', { p_id: id, p_actor: user.id, p_expected_revision: expected })
      await recordAudit(user.id, 'update', 'agent_knowledge', id, `Published article: ${row.titleEn || row.titleId}`)
      return { to: `/admin/agent-knowledge/${id}`, notice: 'Published. The agent can now retrieve this knowledge.' }
    }
    if (!['unpublish','archive','restore','delete'].includes(action)) throw new ActionError('Invalid operation')
    if (action === 'delete') {
      const removed = await remove('agent_knowledge', (q) => q.eq('id', id).eq('revision', expected))
      if (!removed.length) throw new ActionError('Article changed. Refresh before continuing.')
      await recordAudit(user.id, 'delete', 'agent_knowledge', id, `Deleted knowledge: ${row.titleEn || row.titleId}`)
      if (row.attachmentKey) await removeObject('documents', String(row.attachmentKey))
      return { to: '/admin/agent-knowledge', notice: 'Knowledge article deleted' }
    }
    const status = action === 'archive' ? 'archived' : 'draft'
    const rows = await update('agent_knowledge', { status, revision: expected + 1, updated_at: new Date(), updated_by: user.id }, (q) => q.eq('id', id).eq('revision', expected))
    if (!rows.length) throw new ActionError('Article changed. Refresh before continuing.')
    await insert('agent_knowledge_revisions', { document_id: id, revision: expected + 1, actor_id: user.id, action, snapshot: {
      category: row.category, title_en: row.titleEn, title_id: row.titleId, body_en: row.bodyEn, body_id: row.bodyId,
      source_url: row.sourceUrl, status, published_revision: row.publishedRevision,
    } })
    await recordAudit(user.id, 'update', 'agent_knowledge', id, `${action}: ${row.titleEn || row.titleId}`)
    return { to: `/admin/agent-knowledge/${id}`, notice: action === 'unpublish' ? 'Unpublished from agent retrieval' : action === 'archive' ? 'Article archived' : 'Article restored as draft' }
  })
}

export async function restoreAgentKnowledgeRevision(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = getKnowledgeId(form)
    const expected = getKnowledgeRevision(form)
    const selected = Number(form.get('target_revision'))
    if (!Number.isSafeInteger(selected) || selected < 1) throw new ActionError('Invalid history revision')
    const [original, previous] = await Promise.all([
      one('agent_knowledge', (q) => q.eq('id', id), 'revision,status'),
      one('agent_knowledge_revisions', (q) => q.eq('document_id', id).eq('revision', selected), 'snapshot'),
    ])
    if (!original || !previous) throw new ActionError('Revision not found')
    if (Number(original.revision) !== expected) throw new ActionError('Article changed. Refresh before restoring.')
    const s = previous.snapshot as Record<string, unknown>
    const input = inputFromSnapshot(s)
    const rows = await update('agent_knowledge', { ...knowledgePayload(input), revision: expected + 1, updated_at: new Date(), updated_by: user.id }, (q) => q.eq('id', id).eq('revision', expected))
    if (!rows.length) throw new ActionError('Article changed. Refresh before restoring.')
    await insert('agent_knowledge_revisions', { document_id: id, revision: expected + 1, actor_id: user.id, action: 'restore', snapshot: { ...knowledgePayload(input), status: original.status } })
    await recordAudit(user.id, 'update', 'agent_knowledge', id, `Restored working draft from revision ${selected}`)
    return { to: `/admin/agent-knowledge/${id}`, notice: 'Previous content restored as working draft. Publish to apply.' }
  })
}

function inputFromSnapshot(s: Record<string, unknown>): KnowledgeInput {
  const f = new FormData()
  for (const key of ['category','title_en','title_id','body_en','body_id','source_url']) f.set(key, String(s[key] ?? ''))
  return inputFromForm(f)
}
