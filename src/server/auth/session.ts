import { isProd, sessionSecret } from '../env'
import { sha256Hex, signToken, verifyToken } from '../crypto'

// Edge-safe on purpose: middleware reads the role from the signed cookie to answer 401/403 without a database.
export const SESSION_COOKIE = 'vora_session'
export const SESSION_MAX_AGE = 8 * 3600
const SALT = 'vora-auth-v1'

/**
 * Ties a session to the stored credential AND the role: a password reset, a role change or a deactivation
 * ends every earlier session, so the role carried in the cookie can never be stale while the cookie is valid.
 */
export function credentialFingerprint(passwordHash: string, role: string): Promise<string> {
  return sha256Hex(`vora-pv:${role}:${passwordHash}`).then((h) => h.slice(0, 24))
}

export interface SessionClaims { id: number; pv: string; role: string }

export async function createSessionToken(user: { id: number; passwordHash: string; role: string }): Promise<string> {
  return signToken({ id: user.id, role: user.role, pv: await credentialFingerprint(user.passwordHash, user.role) }, sessionSecret(), SALT)
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  const p = await verifyToken<{ id: number; pv: string; role: string }>(token, sessionSecret(), SALT, SESSION_MAX_AGE)
  return p && Number.isInteger(p.id) ? { id: p.id, pv: String(p.pv ?? ''), role: String(p.role ?? '') } : null
}

export function cookieOptions(maxAge = SESSION_MAX_AGE) {
  return { httpOnly: true, secure: isProd(), sameSite: 'lax' as const, path: '/', maxAge }
}
