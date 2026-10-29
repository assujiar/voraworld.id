import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRole } from '@/server/auth/roles'
import { SESSION_COOKIE, readSessionToken } from '@/server/auth/session'

/**
 * Admin gate. It checks the signed cookie only (no database in the edge runtime) so unauthenticated requests
 * are answered before any page or action code runs. Pages and actions repeat the authoritative check against
 * the database (active account, unchanged credential, admin role).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const guard = (res: NextResponse) => {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
  if (pathname === '/admin/login') return guard(NextResponse.next())

  const claims = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!claims) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`
      return guard(NextResponse.redirect(url))
    }
    return guard(new NextResponse('Authentication required', { status: 401 }) as NextResponse)
  }
  if (!isAdminRole(claims.role)) return guard(new NextResponse('Permission denied', { status: 403 }) as NextResponse)
  return guard(NextResponse.next())
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
