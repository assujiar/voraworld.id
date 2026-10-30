import { deliveryBy, proofEvidence, proofsOf, TOKEN } from '@/server/delivery/deliveries'
import { errorResponse } from '@/server/http'
import { ActionError } from '@/server/errors'

/** A signature or photo of the live proof, for whoever holds the emailed view address. Checked against its stored hash on every read. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  try {
    const { token, file } = await params
    const d = TOKEN.test(token) ? await deliveryBy('view_token', token) : null
    const proof = d?.status === 'delivered' ? (await proofsOf(d.id)).find((p) => p.status === 'submitted') : undefined
    const evidence = proof ? await proofEvidence(proof, file) : null
    if (!evidence) throw new ActionError('Not found', 404)
    return new Response(evidence.bytes as BodyInit, { headers: { 'Content-Type': evidence.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch (e) {
    return errorResponse(e)
  }
}
