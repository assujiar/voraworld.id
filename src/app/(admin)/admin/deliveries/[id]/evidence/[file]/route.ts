import { requireUser } from '@/server/auth/guard'
import { proofEvidence, proofsOf } from '@/server/delivery/deliveries'
import { ActionError } from '@/server/errors'
import { errorResponse, routeId } from '@/server/http'

/** A signature or photo of a proof of delivery, for a signed-in administrator. Checked against its stored hash on every read. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  try {
    await requireUser(request)
    const { id: rawId, file } = await params
    const id = routeId(rawId)
    const proofId = routeId(new URL(request.url).searchParams.get('proof') ?? '')
    const proof = id > 0 && id < 2_147_483_647 ? (await proofsOf(id)).find((p) => p.id === proofId) : undefined
    const evidence = proof ? await proofEvidence(proof, file) : null
    if (!evidence) throw new ActionError('Not found', 404)
    return new Response(evidence.bytes as BodyInit, { headers: { 'Content-Type': evidence.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (e) {
    return errorResponse(e)
  }
}
