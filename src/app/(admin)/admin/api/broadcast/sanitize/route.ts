import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { errorResponse } from '@/server/http'
import { cleanEmailHtml } from '@/server/mail/sanitize-email'

/** Never insert raw HTML-source changes into a contentEditable surface without sanitising first. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    await requireUser(request)
    const body = await request.json() as { html?: unknown }
    return Response.json({ html: cleanEmailHtml(typeof body.html === 'string' ? body.html.slice(0,60_000) : '') }, { headers: { 'cache-control': 'no-store' } })
  } catch(e) { return errorResponse(e) }
}
