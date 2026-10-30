import { redirect } from 'next/navigation'
import { currentUser, type SessionUser } from './auth/guard'
import { isAdminRole } from './auth/roles'

/** Authoritative per-page check (the middleware only knows that a valid Supabase session exists). */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) redirect('/admin/login')
  if (!isAdminRole(user.role)) redirect('/admin/login?error=' + encodeURIComponent('This account does not have admin access'))
  return user
}
