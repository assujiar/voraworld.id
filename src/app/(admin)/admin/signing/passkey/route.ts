import { requireUser } from '@/server/auth/guard'
import { assertSameOrigin } from '@/server/auth/csrf'
import { errorResponse } from '@/server/http'
import { ActionError } from '@/server/errors'
import { beginPasskeyRegistration, finishPasskeyRegistration } from '@/server/trust/signing'

/** Registering a passkey: the signer's own session, a challenge that is used once, and the verification of the new key. JSON in, JSON out, never cached. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    const user = await requireUser(request)
    const body = (await request.json().catch(() => null)) as { step?: string; response?: never; label?: string } | null
    if (body?.step === 'options') return json(await beginPasskeyRegistration(user))
    if (body?.step === 'verify' && body.response) { await finishPasskeyRegistration(user, body.response, String(body.label ?? '')); return json({ ok: true }) }
    throw new ActionError('Unknown step', 400)
  } catch (e) { return errorResponse(e) }
}
const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
