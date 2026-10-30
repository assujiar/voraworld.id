import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabasePublishableKey, supabaseUrl } from '@/server/env'
import { sessionCookieOptions } from '@/server/supabase/cookie-options'

/** Admin pages a visitor may open without being signed in. */
const OPEN = new Set(['/admin/login', '/admin/forgot-password', '/admin/auth/callback'])

/**
 * Admin gate, run before any page or action. It refreshes the Supabase session (rotating an expired access token with the refresh
 * token and writing the new cookies to both the request and the response) and refuses anyone who is not signed in. The check here
 * is cryptographic (getClaims); the authoritative one, which also asks Supabase Auth whether the session still exists and whether the
 * account is an ACTIVE administrator, is repeated by every page, route handler and Server Action.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const guard = (res: NextResponse) => {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
  if (OPEN.has(pathname)) return guard(NextResponse.next())

  let response = NextResponse.next({ request: req })
  let signedIn = false
  try {
    const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) req.cookies.set(name, value)
          response = NextResponse.next({ request: req })
          for (const { name, value, options } of list) response.cookies.set(name, value, sessionCookieOptions(options))
        },
      },
    })
    const { data } = await supabase.auth.getClaims()
    signedIn = Boolean(data?.claims?.sub)
  } catch {
    signedIn = false                                          // an unreachable Auth server never lets anyone in
  }
  if (!signedIn) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`
      return guard(NextResponse.redirect(url))
    }
    return guard(new NextResponse('Authentication required', { status: 401 }) as NextResponse)
  }
  return guard(response)
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
