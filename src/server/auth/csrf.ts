import { HttpError } from '../http'

/**
 * Defence in depth for form submissions. Next.js already verifies the Origin of every Server Action call;
 * this repeats the check inside our own wrapper (browsers always send Origin on cross-site POSTs).
 * Non-browser clients send no Origin and are not a CSRF vector, because they do not carry the session cookie.
 */
export function assertSameOrigin(headers: Headers): void {
  const origin = headers.get('origin')
  if (!origin) return
  if (origin === 'null') throw new HttpError(403, 'Cross-site request refused')
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  let originHost = ''
  try { originHost = new URL(origin).host } catch { /* refused below */ }
  if (!host || originHost !== host) throw new HttpError(403, 'Cross-site request refused')
}
