import { createHash } from 'node:crypto'
import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { rpc } from '@/server/data'
import { validModel, validProvider, providerKey } from '@/server/agent/providers'
import { errorResponse } from '@/server/http'

export const runtime = 'nodejs'
export const maxDuration = 30
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    const user = await requireUser(request)
    const payload = await request.text()
    if (payload.length > 600) return Response.json({ error: 'Invalid payload' }, { status: 400 })
    const input = JSON.parse(payload) as { provider?: unknown; model?: unknown }
    if (!validProvider(input.provider) || !validModel(input.provider, input.model)) return Response.json({ error: 'Invalid provider/model' }, { status: 400 })
    const identity = createHash('sha256').update(`agent-provider-test:${user.id}`).digest('hex')
    const permitted = await rpc<boolean>('agent_consume_quota', { p_key: identity, p_window_seconds: 3600, p_max: 12 })
    if (!permitted) return Response.json({ error: 'Hourly test limit reached' }, { status: 429 })
    const key = await providerKey(input.provider)
    if (!key) return Response.json({ error: 'Save an API key first' }, { status: 400 })
    const url = input.provider === 'gemini'
      ? `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`
      : 'https://api.openai.com/v1/responses'
    const body = input.provider === 'gemini'
      ? { contents: [{ parts: [{ text: 'Reply with exactly: VORA CONNECTION OK' }] }], generationConfig: { maxOutputTokens: 40 } }
      : { model: input.model, input: 'Reply with exactly: VORA CONNECTION OK', store: false, max_output_tokens: 100 }
    const upstream = await fetch(url, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', ...(input.provider === 'gemini' ? { 'x-goog-api-key': key } : { authorization: `Bearer ${key}` }) },
      body: JSON.stringify(body) })
    if (!upstream.ok) return Response.json({ ok: false, error: `Provider HTTP ${upstream.status}. Check model access, quota and billing.` }, { status: 400, headers: { 'cache-control': 'no-store' } })
    return Response.json({ ok: true, message: 'Connection successful. API key and selected model are responding.' }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) { return errorResponse(error) }
}
