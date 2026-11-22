import { rpc } from '@/server/data'

/** RFC 8058 one-click unsubscribe: no cookies needed; the 128-bit contact token authorises only removal. */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return new Response('Invalid link', { status: 400 })
  const body = await request.text()
  if (!/(?:^|&)List-Unsubscribe=One-Click(?:&|$)/.test(body)) return new Response('Invalid unsubscribe request', { status: 400 })
  try {
    const ok = await rpc<boolean>('broadcast_unsubscribe', { p_token: token })
    return new Response(ok ? 'Unsubscribed' : 'Invalid link', { status: ok ? 200 : 404, headers: { 'cache-control': 'no-store' } })
  } catch { return new Response('Unable to process request', { status: 500 }) }
}
