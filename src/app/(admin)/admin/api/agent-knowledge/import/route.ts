import { randomUUID } from 'node:crypto'
import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { insert, remove } from '@/server/data'
import { ActionError } from '@/server/errors'
import { errorResponse } from '@/server/http'
import { putObject, removeObject } from '@/server/storage'
import { extractKnowledgeDocument, AGENT_FILE_MAX_BYTES } from '@/server/agent/document-import'
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from '@/server/agent/knowledge-admin'
import { recordAudit } from '@/server/audit'

export const runtime = 'nodejs'
export const maxDuration = 30
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    const user = await requireUser(request)
    const length = Number(request.headers.get('content-length') || '0')
    if (length > AGENT_FILE_MAX_BYTES + 65536) throw new ActionError('Maximum document size is 4 MB', 413)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size > AGENT_FILE_MAX_BYTES || !file.size) throw new ActionError('Choose a PDF/DOCX smaller than 4 MB')
    const locale = form.get('locale') === 'id' ? 'id' : 'en'
    const category = String(form.get('category') || 'other')
    if (!KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory)) throw new ActionError('Invalid category')
    const filename = file.name.replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0,200) || 'document'
    const bytes = new Uint8Array(await file.arrayBuffer())
    const extracted = await extractKnowledgeDocument(bytes, filename)
    const title = filename.replace(/\.(docx|pdf)$/i,'').slice(0,190)
    const key = `agent-knowledge/${randomUUID()}.${filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'}`
    await putObject('documents', key, bytes, extracted.type)
    let createdId: number | null = null
    try {
      const row = {
        category, status: 'draft', title_en: locale === 'en' ? title : '', title_id: locale === 'id' ? title : '',
        body_en: locale === 'en' ? extracted.text : '', body_id: locale === 'id' ? extracted.text : '',
        attachment_name: filename, attachment_key: key, created_by: user.id, updated_by: user.id,
      }
      const [saved] = await insert('agent_knowledge', row)
      createdId = Number(saved.id)
      await insert('agent_knowledge_revisions', { document_id: saved.id, revision: 1, actor_id: user.id, action: 'save', snapshot: row })
      await recordAudit(user.id, 'create', 'agent_knowledge', Number(saved.id), `Imported draft from ${filename}`)
      return Response.json({ id: saved.id, extractedCharacters: extracted.text.length }, { headers: { 'cache-control': 'no-store' } })
    } catch (e) { if (createdId) await remove('agent_knowledge', (q) => q.eq('id', createdId)); await removeObject('documents', key); throw e }
  } catch (e) { return errorResponse(e) }
}
