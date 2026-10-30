import { cache } from 'react'
import { sql } from '../db'
import { HttpError } from '../http'
import { supabaseForRequest, supabaseFromCookieHeader } from '../supabase/clients'
import { isAdminRole } from './roles'

export interface SessionUser { id: number; email: string; role: string }

type AuthClient = Awaited<ReturnType<typeof supabaseForRequest>>

/**
 * Who is signed in, proven by Supabase Auth: getUser() asks the Auth server to validate the access token, so a revoked session or a deleted
 * account is refused at once (the signature alone would not show that). Then the person must have an ACTIVE row in public.users linked to that
 * Auth account: the role comes from this table, never from anything the user can edit.
 */
async function memberFrom(client: AuthClient): Promise<SessionUser | null> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  const [u] = await sql`select id, email, role, active from users where auth_user_id = ${data.user.id}`
  if (!u || !u.active) return null
  return { id: u.id as number, email: u.email as string, role: u.role as string }
}

/** The signed-in user of the current request (cookies from next/headers). One lookup per request, however many components ask. */
export const currentUser = cache(async (): Promise<SessionUser | null> => memberFrom(await supabaseForRequest()))

export const userFromRequest = (request: Request): Promise<SessionUser | null> => memberFrom(supabaseFromCookieHeader(request.headers.get('cookie')))

/** Only the admin role may use the portal. */
export function assertAdmin(user: SessionUser): void {
  if (!isAdminRole(user.role)) throw new HttpError(403, 'Permission denied')
}

/** 401 when not signed in, 403 when the account does not hold the admin role. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await userFromRequest(request)
  if (!user) throw new HttpError(401, 'Authentication required')
  assertAdmin(user)
  return user
}
