import { afterResponse } from '@/server/after'
import { dispatch } from '@/server/mail/outbox'
import { publicBaseUrl } from '@/server/env'
import { createLead } from '@/server/leads'
import { agentBudget, agentEnabled, agentSameOrigin, getAgentToken } from '@/server/agent/security'
import { loadSession } from '@/server/agent/store'
import { ActionError } from '@/server/errors'

export const runtime = 'nodejs'
export const maxDuration = 30
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const str = (v: unknown, max: number) => typeof v === 'string' ? v.replaceAll('\u0000', '').trim().slice(0, max) : ''

/** An explicit handoff: reuse existing lead_create CRM RPC, throttling and notification pipeline. */
export async function POST(request: Request) {
  if (!await agentEnabled()) return json({ error: 'disabled' }, 503)
  if (!agentSameOrigin(request)) return json({ error: 'invalid_origin' }, 403)
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'invalid_request' }, 415)
  if (Number(request.headers.get('content-length') || 0) > 10000) return json({ error: 'too_large' }, 413)
  let body: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 10000) return json({ error: 'too_large' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'invalid_request' }, 400)
    body = parsed as Record<string, unknown>
  } catch { return json({ error: 'invalid_request' }, 400) }
  if (body.consent !== true || body.website) return json({ error: 'consent_required' }, 400)
  const token = await getAgentToken()
  if (!token) return json({ error: 'session_expired' }, 401)
  try {
    if (!await agentBudget(request, token, 'lead')) return json({ error: 'rate_limit' }, 429)
    const session = await loadSession(token)
    if (!session?.identityAt) return json({ error: 'registration_required' }, 403)
    // Visitor approves the exact handoff summary shown in the UI. The backend adds no hidden transcript.
    const message = str(body.message, 5400)
    if (!message) return json({ error: 'message_required' }, 400)
    const result = await createLead({ kind: 'contact', name: session.name, email: session.email, phone: session.phone, company: session.company, message: `VORA Virtual Agent inquiry\n\n${message}`, mode: '', origin: '', destination: '', cargo: '', pickup: '' })
    afterResponse(() => dispatch(publicBaseUrl(), 10))
    return json({ ok: true, reference: result.reference })
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.message }, e.status)
    console.error('VORA agent handoff failed:', e instanceof Error ? e.message : e)
    return json({ error: 'service_unavailable' }, 503)
  }
}
