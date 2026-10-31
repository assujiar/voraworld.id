import { requireUser } from '@/server/auth/guard'
import { assertSameOrigin } from '@/server/auth/csrf'
import { errorResponse, routeId } from '@/server/http'
import { ActionError } from '@/server/errors'
import { beginSigning, finishSigning } from '@/server/trust/signing'

/**
 * The two server steps of the signing ceremony. The signer is the signed-in account itself: whatever the request body says, nobody else's signing can be completed
 * from this session, and the server never takes the signer's name, position, the document's fingerprint or its status from the client.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request.headers)
    const user = await requireUser(request)
    const id = routeId((await params).id)
    if (!id) throw new ActionError('Not found', 404)
    const body = (await request.json().catch(() => null)) as { step?: string; placement?: unknown; confirmations?: unknown; response?: never } | null
    if (body?.step === 'begin') return json(await beginSigning(user, id, { placement: body.placement, confirmations: body.confirmations }))
    if (body?.step === 'finish' && body.response) return json({ ok: true, ...(await finishSigning(user, id, body.response)) })
    throw new ActionError('Unknown step', 400)
  } catch (e) { return errorResponse(e) }
}
const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
