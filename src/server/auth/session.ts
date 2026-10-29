import { createHash } from 'node:crypto'
import { isProd, sessionSecret } from '../env'
import { signToken, verifyToken } from '../crypto'

export const SESSION_COOKIE = 'vora_session'
export const CSRF_COOKIE = 'vora_csrf'
export const SESSION_MAX_AGE = 8 * 3600
export const CSRF_MAX_AGE = 12 * 3600
const SALT = 'vora-auth-v1'

/** Ties a session to the stored credential: a password reset or deactivation ends every earlier session. */
export function credentialFingerprint(passwordHash: string): string {
  return createHash('sha256').update(`vora-pv:${passwordHash}`).digest('hex').slice(0, 24)
}

export function createSessionToken(user: { id: number; passwordHash: string }): Promise<string> {
  return signToken({ id: user.id, pv: credentialFingerprint(user.passwordHash) }, sessionSecret(), SALT)
}

export async function readSessionToken(token: string | undefined | null): Promise<{ id: number; pv: string } | null> {
  const payload = await verifyToken<{ id: number; pv: string }>(token, sessionSecret(), SALT, SESSION_MAX_AGE)
  return payload && Number.isInteger(payload.id) ? { id: payload.id, pv: String(payload.pv ?? '') } : null
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: isProd(), sameSite: 'lax' as const, path: '/', maxAge }
}
