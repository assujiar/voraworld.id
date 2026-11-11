import { createHash } from 'node:crypto'
import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { rpc } from '@/server/data'
import { validateKnowledgeInput } from '@/server/agent/knowledge-admin'
import { generateAgentReply } from '@/server/agent/gemini'
import { ActionError } from '@/server/errors'
import { errorResponse } from '@/server/http'

export const runtime = 'nodejs'
export const maxDuration = 30
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    const user = await requireUser(request)
    const raw = await request.text()
    if (raw.length > 165_000) throw new ActionError('Preview request is too large', 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ActionError('Invalid preview request')
    const obj = parsed as Record<string, unknown>
    const input = validateKnowledgeInput(obj)
    const question = typeof obj.question === 'string' ? obj.question.trim() : ''
    if (question.length < 3 || question.length > 600) throw new ActionError('Enter a question (3–600 characters)')
    const locale = obj.locale === 'id' ? 'id' : 'en'
    const hash = (v: string) => createHash('sha256').update(v).digest('hex')
    for (const [period,max] of [[600,8],[86400,25]]) {
      const permitted = await rpc<boolean>('agent_consume_quota', { p_key: hash(`admin-kb-preview:${user.id}:${period}`), p_window_seconds: period, p_max: max })
      if (!permitted) return Response.json({ error: 'Preview quota reached. Try later.' }, { status: 429 })
    }
    const preview = {
      id: 'admin-preview', title: locale === 'id' ? (input.titleId || input.titleEn) : (input.titleEn || input.titleId),
      url: input.sourceUrl || '', text: locale === 'id' ? (input.bodyId || input.bodyEn) : (input.bodyEn || input.bodyId),
    }
    const answer = await generateAgentReply([{ role: 'user', content: question }], locale, preview)
    return Response.json('text' in answer ? { reply: answer.text } : { error: answer.error === 'quota' ? 'Provider quota reached' : 'AI provider is not configured or unavailable' }, {
      status: 'text' in answer ? 200 : 503, headers: { 'cache-control': 'no-store' },
    })
  } catch (e) { return errorResponse(e) }
}
