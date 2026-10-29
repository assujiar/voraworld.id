import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { userFromToken, type SessionUser } from './auth/guard'
import { isAdminRole } from './auth/roles'
import { SESSION_COOKIE } from './auth/session'

/** Authoritative per-page check (middleware only verified the signed cookie). */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) redirect('/admin/login')
  if (!isAdminRole(user.role)) redirect('/admin/login?error=' + encodeURIComponent('This account does not have admin access'))
  return user
}
