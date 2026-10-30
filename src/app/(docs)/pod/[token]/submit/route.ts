import { clientIp } from '@/server/auth/cookies'
import { MAX_SUBMISSION_BYTES, submitProof } from '@/server/delivery/deliveries'
import { publicBaseUrl } from '@/server/env'
import { ActionError } from '@/server/errors'

export const maxDuration = 30
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replaceAll('\u0000', '').slice(0, max) : '')

/**
 * The receiver's phone sends the proof of delivery here. No account: the unguessable token in the address is the only credential, and it works
 * once. The body is capped before it is read, and every field is validated again by the service.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > MAX_SUBMISSION_BYTES + 100_000) throw new ActionError('The photos are too large to send: take them again', 413)
    const raw = await request.text()
    if (raw.length > MAX_SUBMISSION_BYTES * 1.4) throw new ActionError('The photos are too large to send: take them again', 413)
    let b: Record<string, unknown>
    try { b = JSON.parse(raw) } catch { throw new ActionError('The form could not be read: reload the page and try again', 400) }
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ActionError('The form could not be read: reload the page and try again', 400)
    const photos = Array.isArray(b.photos) ? b.photos.slice(0, 8).map((p) => text(p, 2_000_000)) : []
    const received = await submitProof({
      token: (await params).token, courierName: text(b.courierName, 400), courierPhone: text(b.courierPhone, 100),
      receiverName: text(b.receiverName, 400), receiverPosition: text(b.receiverPosition, 400), receiverPhone: text(b.receiverPhone, 100), receiverEmail: text(b.receiverEmail, 300),
      receiverIdNumber: text(b.receiverIdNumber, 100), condition: text(b.condition, 20), conditionNote: text(b.conditionNote, 1_100),
      signature: text(b.signature, 600_000), photos,
      latitude: text(b.latitude, 40), longitude: text(b.longitude, 40), accuracy: text(b.accuracy, 40), locationStatus: text(b.locationStatus, 20), locationNote: text(b.locationNote, 300),
      deviceTime: text(b.deviceTime, 60), ip: clientIp(request.headers), userAgent: request.headers.get('user-agent') ?? '',
    }, publicBaseUrl())
    return json({ ok: true, number: received.number, receiver: received.receiver, at: received.at.toISOString() }, 200)
  } catch (e) {
    if (e instanceof ActionError) return json({ ok: false, error: e.message }, e.status)
    console.error(e)
    return json({ ok: false, error: 'The proof of delivery could not be saved: try again' }, 500)
  }
}
