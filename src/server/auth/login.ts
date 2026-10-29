import { sql } from '../db'
import { recordAudit } from '../audit'
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password'
import { createSessionToken } from './session'

export const LOGIN_WINDOW_MINUTES = 15
export const LOGIN_MAX_PER_EMAIL = 5
export const LOGIN_MAX_PER_IP = 30

export type LoginResult = { status: 'ok'; token: string } | { status: 'blocked' } | { status: 'invalid' }

export async function attemptLogin(rawEmail: string, password: string, ip: string): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase().slice(0, 200)
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000)
  const [{ byEmail, byIp }] = await sql`
    select count(*) filter (where email = ${email})::int as by_email,
           count(*) filter (where ip = ${ip})::int as by_ip
    from login_attempts where succeeded = false and created_at >= ${since} and (email = ${email} or ip = ${ip})`
  if (byEmail >= LOGIN_MAX_PER_EMAIL || byIp >= LOGIN_MAX_PER_IP) return { status: 'blocked' }
  const [user] = await sql`select id, role, password_hash from users where email = ${email} and active = true`
  // Always verify against a hash, so unknown accounts cost the same time as wrong passwords.
  const ok = (await verifyPassword(password, (user?.passwordHash as string) ?? DUMMY_PASSWORD_HASH)) && Boolean(user)
  await sql`insert into login_attempts (email, ip, succeeded) values (${email}, ${ip}, ${ok})`
  if (!ok || !user) return { status: 'invalid' }
  await recordAudit(sql, user.id as number, 'login', 'user', user.id as number)
  return { status: 'ok', token: await createSessionToken({ id: user.id as number, passwordHash: user.passwordHash as string, role: user.role as string }) }
}
