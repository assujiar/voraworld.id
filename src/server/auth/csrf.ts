import { safeEqual } from '../crypto'
import { HttpError } from '../http'
import { CSRF_COOKIE } from './session'
import { readCookie } from './cookies'

/** Browsers always send Origin on cross-site POSTs; refuse any whose host is not ours. Non-browser clients send none. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') {
    if (origin === 'null') throw new HttpError(403, 'Cross-site request refused')
    return
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  let originHost = ''
  try { originHost = new URL(origin).host } catch { /* fallthrough */ }
  if (!host || originHost !== host) throw new HttpError(403, 'Cross-site request refused')
}

/** Double-submit check: the hidden form field must equal the HttpOnly cookie set by middleware. */
export function assertCsrf(request: Request, form: FormData): void {
  const cookie = readCookie(request, CSRF_COOKIE) ?? ''
  const field = form.get('csrf')
  const incoming = typeof field === 'string' ? field : ''
  if (!cookie || !incoming || !safeEqual(cookie, incoming)) throw new HttpError(403, 'Invalid CSRF token')
}
