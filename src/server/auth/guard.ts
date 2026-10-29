import { sql } from '../db'
import { HttpError } from '../http'
import { safeEqual } from '../crypto'
import { can, type Permission } from './roles'
import { SESSION_COOKIE, credentialFingerprint, readSessionToken } from './session'
import { readCookie } from './cookies'

export interface SessionUser { id: number; email: string; role: string }

/** Loads the signed-in user: valid signature, account still active, credential unchanged since sign-in. */
export async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  const session = await readSessionToken(token)
  if (!session) return null
  const [u] = await sql`select id, email, role, active, password_hash from users where id = ${session.id}`
  if (!u || !u.active || !safeEqual(session.pv, credentialFingerprint(u.passwordHash as string))) return null
  return { id: u.id as number, email: u.email as string, role: u.role as string }
}

export const userFromRequest = (request: Request) => userFromToken(readCookie(request, SESSION_COOKIE))

export function assertPermission(user: SessionUser, permission?: Permission): void {
  if (!can(user.role, permission)) throw new HttpError(403, 'Permission denied')
}

/** 401 when not signed in, 403 when signed in without the permission. */
export async function requireUser(request: Request, permission?: Permission): Promise<SessionUser> {
  const user = await userFromRequest(request)
  if (!user) throw new HttpError(401, 'Authentication required')
  assertPermission(user, permission)
  return user
}
