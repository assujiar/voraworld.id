import { NextResponse, type NextRequest } from 'next/server'
import { adminPermission } from '@/server/auth/routes'
import { can } from '@/server/auth/roles'
import { SESSION_COOKIE, readSessionToken } from '@/server/auth/session'

/**
 * Admin gate. It checks the signed cookie only (no database in the edge runtime) so unauthenticated and
 * unauthorised requests are answered before any page or action code runs. Pages and actions repeat the
 * authoritative check against the database (active account, unchanged credential).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const noindex = (res: NextResponse) => {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
  if (pathname === '/admin/login') return noindex(NextResponse.next())

  const claims = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!claims) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`
      return noindex(NextResponse.redirect(url))
    }
    return noindex(new NextResponse('Authentication required', { status: 401 }) as NextResponse)
  }
  const needed = adminPermission(pathname)
  if (needed === undefined) return noindex(new NextResponse('Not found', { status: 404 }) as NextResponse)
  if (needed && !can(claims.role, needed)) return noindex(new NextResponse('Permission denied', { status: 403 }) as NextResponse)
  return noindex(NextResponse.next())
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
