import type { Sql } from 'postgres'
import { recordAudit } from '../../src/server/audit'
import { hashPassword, MIN_PASSWORD_LENGTH } from '../../src/server/auth/password'
import { ADMIN_ROLE } from '../../src/server/auth/roles'

/** A refusal the person at the terminal can act on (bad input, unknown account); anything else is a real error. */
export class UserCommandError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string): string {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) throw new UserCommandError('A valid email address is required')
  return email
}

export function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw new UserCommandError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  if (!password.trim()) throw new UserCommandError('Password cannot be blank')
}

async function find(sql: Sql, email: string) {
  const [u] = await sql`select id, email, role, active from users where email = ${email}`
  return u as { id: number; email: string; role: string; active: boolean } | undefined
}

/** The portal has ONE role, `admin`: every account created here can use every menu. There is no role argument. */
export async function createAdmin(sql: Sql, rawEmail: string, password: string): Promise<{ id: number; email: string }> {
  const email = normalizeEmail(rawEmail)
  checkPassword(password)
  if (await find(sql, email)) throw new UserCommandError('That account already exists (use reset-password)')
  const hash = await hashPassword(password)
  return sql.begin(async (t) => {
    const [u] = await t`insert into users (email, password_hash, role, active) values (${email}, ${hash}, ${ADMIN_ROLE}, true) returning id`
    await recordAudit(t as unknown as Sql, null, 'user-create', 'user', u.id as number, `${email} role=${ADMIN_ROLE}`)
    return { id: u.id as number, email }
  })
}

/** Changing the password ends every existing session of that account at once (sessions are bound to the password hash). */
export async function resetPassword(sql: Sql, rawEmail: string, password: string): Promise<void> {
  const email = normalizeEmail(rawEmail)
  checkPassword(password)
  const user = await find(sql, email)
  if (!user) throw new UserCommandError('No such account')
  const hash = await hashPassword(password)
  await sql.begin(async (t) => {
    await t`update users set password_hash = ${hash} where id = ${user.id}`
    await recordAudit(t as unknown as Sql, null, 'user-password-reset', 'user', user.id, email)
  })
}

export async function setActive(sql: Sql, rawEmail: string, active: boolean): Promise<void> {
  const email = normalizeEmail(rawEmail)
  const user = await find(sql, email)
  if (!user) throw new UserCommandError('No such account')
  await sql.begin(async (t) => {
    await t`update users set active = ${active} where id = ${user.id}`
    await recordAudit(t as unknown as Sql, null, active ? 'user-activate' : 'user-deactivate', 'user', user.id, email)
  })
}

export async function listUsers(sql: Sql): Promise<Array<{ id: number; email: string; role: string; active: boolean }>> {
  return (await sql`select id, email, role, active from users order by id`) as unknown as Array<{ id: number; email: string; role: string; active: boolean }>
}
