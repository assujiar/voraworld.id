import { safeEqual } from '@/server/crypto'
import { publicBaseUrl } from '@/server/env'
import { dispatch } from '@/server/mail/outbox'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Scheduled retry of queued emails (Vercel Cron calls this daily and sends `Authorization: Bearer $CRON_SECRET`).
 * Without a long random CRON_SECRET the endpoint does not exist as far as callers can tell: it answers 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || ''
  const given = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || '')?.[1] ?? ''
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
  if (secret.length < 32 || !given || !safeEqual(given, secret)) return new Response('Unauthorized', { status: 401, headers })
  const result = await dispatch(publicBaseUrl(), 30)
  return Response.json(result, { headers })
}
