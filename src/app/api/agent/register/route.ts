import { rpc } from '@/server/data'
import { parseVisitorIdentity } from '@/server/agent/identity'
import { ensureSession, loadSession } from '@/server/agent/store'
import { agentBudget, agentEnabled, agentLocale, agentSameOrigin, getAgentToken, newToken, setAgentToken } from '@/server/agent/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/** Required contact details are accepted before any Gemini chat requests can be made. */
export async function POST(request: Request) {
  if (!await agentEnabled()) return json({ error: 'disabled' }, 503)
  if (!agentSameOrigin(request)) return json({ error: 'invalid_origin' }, 403)
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'invalid_request' }, 415)
  if (Number(request.headers.get('content-length') || 0) > 3000) return json({ error: 'too_large' }, 413)
  let payload: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 3000) return json({ error: 'too_large' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_request' }, 400)
    payload = parsed as Record<string, unknown>
  } catch { return json({ error: 'invalid_request' }, 400) }
  if (payload.consent !== true || payload.website) return json({ error: 'consent_required' }, 400)
  const visitor = parseVisitorIdentity(payload)
  if (!visitor) return json({ error: 'invalid_identity' }, 400)
  try {
    const oldToken = await getAgentToken()
    const oldSession = oldToken ? await loadSession(oldToken) : null
    if (oldSession?.identityAt) return json({ registered: true })
    const token = oldSession ? oldToken! : newToken()
    if (!await agentBudget(request, token, 'register')) return json({ error: 'rate_limit' }, 429)
    const session = oldSession || await ensureSession(token, agentLocale(payload.locale))
    // The function atomically checks existing leads, customers and agent contacts.
    // Possible typos are held for manual review; public callers never learn matching CRM identities.
    await rpc('agent_register_identity', {
      p_session: session.id, p_name: visitor.name, p_company: visitor.company,
      p_email: visitor.email, p_phone: visitor.phone, p_email_key: visitor.emailKey,
      p_phone_key: visitor.phoneKey,
    })
    await setAgentToken(token)
    return json({ registered: true })
  } catch (e) {
    console.error('VORA agent registration failed:', e instanceof Error ? e.message : 'error')
    return json({ error: 'service_unavailable' }, 503)
  }
}
