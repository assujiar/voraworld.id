import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { errorResponse } from '@/server/http'
import { previewTemplate } from '@/server/mail/preview'

/** A preview of an email template as it would be sent, made with the real sanitiser. Nothing is stored or sent. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    await requireUser(request)
    const body = await request.json().catch(() => ({})) as { subject?: unknown; html?: unknown }
    const subject = typeof body.subject === 'string' ? body.subject : ''
    const html = typeof body.html === 'string' ? body.html : ''
    return Response.json(previewTemplate(subject, html), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
