import { afterResponse } from '@/server/after'
import { remove } from '@/server/data'
import { agentMessages, addAgentMessage, loadSession, touchSession } from '@/server/agent/store'
import { generateAgentReply } from '@/server/agent/gemini'
import { agentBudget, agentCleanup, agentEnabled, agentLocale, agentSameOrigin, deleteAgentToken, getAgentToken, safeMessage } from '@/server/agent/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
const json = (body: unknown, status = 200, retryAfter?: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...(retryAfter ? { 'retry-after': String(retryAfter) } : {}) } })

/** Read the visitor's own chat from an HttpOnly opaque cookie, never from a supplied session ID. */
export async function GET() {
  if (!await agentEnabled()) return json({ enabled: false, messages: [] }, 200)
  try {
    const token = await getAgentToken()
    if (!token) return json({ enabled: true, registered: false, messages: [] })
    const session = await loadSession(token)
    if (!session?.identityAt) return json({ enabled: true, registered: false, messages: [] })
    return json({ enabled: true, registered: true, messages: await agentMessages(session.id, 40) })
  } catch (e) {
    console.error('VORA agent history failed:', e instanceof Error ? e.message : e)
    return json({ enabled: true, messages: [], error: 'history_unavailable' }, 503)
  }
}

export async function POST(request: Request) {
  if (!await agentEnabled()) return json({ error: 'disabled' }, 503)
  if (!agentSameOrigin(request)) return json({ error: 'invalid_origin' }, 403)
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'invalid_request' }, 415)
  if (Number(request.headers.get('content-length') || 0) > 8000) return json({ error: 'too_large' }, 413)
  let payload: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 8000) return json({ error: 'too_large' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_request' }, 400)
    payload = parsed as Record<string, unknown>
  } catch { return json({ error: 'invalid_request' }, 400) }
  const message = safeMessage(payload.message)
  if (!message || payload.consent !== true) return json({ error: 'invalid_request' }, 400)
  const locale = agentLocale(payload.locale)
  try {
    const previousToken = await getAgentToken()
    if (!previousToken) return json({ error: 'registration_required' }, 403)
    const session = await loadSession(previousToken)
    if (!session?.identityAt) return json({ error: 'registration_required' }, 403)
    if (!await agentBudget(request, previousToken, 'chat')) return json({ error: 'rate_limit' }, 429, 600)
    await addAgentMessage(session.id, 'user', message)
    await touchSession(session.id)
    const messages = await agentMessages(session.id)
    const reply = await generateAgentReply(messages, locale)
    if ('error' in reply) {
      if (reply.error === 'quota') return json({ error: 'provider_limit' }, 429, 60)
      return json({ error: 'provider_unavailable' }, 503, 30)
    }
    await addAgentMessage(session.id, 'assistant', reply.text)
    afterResponse(() => agentCleanup())
    return json({ reply: reply.text })
  } catch (e) {
    console.error('VORA agent chat failed:', e instanceof Error ? e.message : e)
    return json({ error: 'service_unavailable' }, 503)
  }
}

/** Visitor-initiated deletion clears server history as well as the session cookie. */
export async function DELETE(request: Request) {
  if (!agentSameOrigin(request)) return json({ error: 'invalid_origin' }, 403)
  try {
    const token = await getAgentToken()
    if (token) {
      const session = await loadSession(token)
      if (session) await remove('agent_sessions', (q) => q.eq('id', session.id))
    }
    await deleteAgentToken()
    return json({ ok: true })
  } catch (e) {
    console.error('VORA agent history deletion failed:', e instanceof Error ? e.message : e)
    return json({ error: 'service_unavailable' }, 503)
  }
}
