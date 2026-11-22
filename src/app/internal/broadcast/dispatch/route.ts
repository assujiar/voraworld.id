import { safeEqual } from '@/server/crypto'
import { dispatchBroadcast } from '@/server/broadcast/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Invoke every 5-15 min with a scheduler; the database enforces a global 60-min limit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || ''
  const given = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || '')?.[1] ?? ''
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
  if (secret.length < 32 || !given || !safeEqual(given, secret)) return new Response('Unauthorized', { status: 401, headers })
  try { return Response.json(await dispatchBroadcast(5), { headers }) }
  catch { return Response.json({ error: 'Broadcast dispatcher failed. Check server logs.' }, { status: 500, headers }) }
}
