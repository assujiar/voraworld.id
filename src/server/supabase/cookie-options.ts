/**
 * How the Supabase session cookies are written. The application never reads the session in the browser (every check happens on the
 * server), so the cookies are HttpOnly: a script injected into a page cannot steal them. The lifetime matches the old portal session
 * (8 hours, renewed whenever the access token is refreshed). Plain data only: the middleware runs on the Edge runtime too.
 */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

interface CookieOptions { path?: string; maxAge?: number; domain?: string; sameSite?: boolean | 'lax' | 'strict' | 'none'; httpOnly?: boolean; secure?: boolean; expires?: Date }

export function sessionCookieOptions(options: CookieOptions = {}): CookieOptions {
  const removing = options.maxAge === 0
  return { ...options, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: removing ? 0 : SESSION_MAX_AGE_SECONDS }
}
