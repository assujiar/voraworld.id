import { sql } from '../db'
import { recordAudit } from '../audit'
import { supabaseForRequest } from '../supabase/clients'
import { isAdminRole } from './roles'

export const LOGIN_WINDOW_MINUTES = 15
export const LOGIN_MAX_PER_EMAIL = 5
export const LOGIN_MAX_PER_IP = 30

export type LoginResult = { status: 'ok' } | { status: 'blocked' } | { status: 'invalid' }

/** Failed attempts of this email or this address in the window: the application's own brake, on top of Supabase's rate limits. */
async function tooMany(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000)
  const [{ byEmail, byIp }] = await sql`
    select count(*) filter (where email = ${email})::int as by_email,
           count(*) filter (where ip = ${ip})::int as by_ip
    from login_attempts where succeeded = false and created_at >= ${since} and (email = ${email} or ip = ${ip})`
  return byEmail >= LOGIN_MAX_PER_EMAIL || byIp >= LOGIN_MAX_PER_IP
}

export const normalizeLoginEmail = (raw: string) => raw.trim().toLowerCase().slice(0, 200)

/**
 * Signs in with Supabase Auth. The session cookies are written by the Supabase client itself. Access needs BOTH a valid Auth account and an
 * active admin row in public.users: an account that exists only in Supabase Auth is signed straight out again. Every failure answers the same.
 */
export async function attemptLogin(rawEmail: string, password: string, ip: string): Promise<LoginResult> {
  const email = normalizeLoginEmail(rawEmail)
  if (await tooMany(email, ip)) return { status: 'blocked' }
  const supabase = await supabaseForRequest()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  let member: { id: number; role: string; active: boolean } | undefined
  if (!error && data.user) {
    const [u] = await sql`select id, role, active from users where auth_user_id = ${data.user.id}`
    member = u as typeof member
  }
  const ok = Boolean(member && member.active && isAdminRole(member.role))
  await sql`insert into login_attempts (email, ip, succeeded) values (${email}, ${ip}, ${ok})`
  if (!ok || !member) {
    if (data?.session) await supabase.auth.signOut({ scope: 'local' })          // a valid Auth account without portal access must not keep a session
    return { status: 'invalid' }
  }
  await recordAudit(sql, member.id, 'login', 'user', member.id)
  return { status: 'ok' }
}

/** Sends the password-reset email, but only for a portal administrator; the answer to the visitor never says whether the address qualified. */
export async function requestPasswordReset(rawEmail: string, ip: string, redirectTo: string): Promise<'sent-or-ignored' | 'blocked'> {
  const email = normalizeLoginEmail(rawEmail)
  if (await tooMany(email, ip)) return 'blocked'
  await sql`insert into login_attempts (email, ip, succeeded) values (${email}, ${ip}, false)`     // counts towards the same limit: a reset is as sensitive as a sign-in
  const [u] = await sql`select active, role from users where email = ${email} and auth_user_id is not null`
  if (u && u.active && isAdminRole(u.role as string)) {
    const supabase = await supabaseForRequest()
    await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  }
  return 'sent-or-ignored'
}
