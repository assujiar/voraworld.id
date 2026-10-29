import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { can, type Permission } from './auth/roles'
import { userFromToken, type SessionUser } from './auth/guard'
import { SESSION_COOKIE } from './auth/session'

/** Authoritative per-page check (middleware only verified the signed cookie). */
export async function requirePageUser(permission?: Permission): Promise<SessionUser> {
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) redirect('/admin/login')
  if (!can(user.role, permission)) redirect('/admin?error=' + encodeURIComponent('Permission denied'))
  return user
}
