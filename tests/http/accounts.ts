import type { Sql } from 'postgres'
import { Client } from './client'
import { ensureAuthAccount, jarOf, signInCookies } from '../helpers/auth'

export interface Account { id: number; email: string; role: string; password: string }

/** A portal account on the HTTP suite's server: a real Supabase Auth account plus its row in public.users. */
export async function account(db: Sql, email: string, role: string, password = 'Correct-horse-battery-9'): Promise<Account> {
  const authId = await ensureAuthAccount(email, password)
  const [u] = await db`insert into users (email, role, auth_user_id, active) values (${email}, ${role}, ${authId}, true)
                       on conflict (email) do update set role = excluded.role, auth_user_id = excluded.auth_user_id, active = true returning id`
  return { id: u.id as number, email, role, password }
}

/** A browser that has signed in as this account against the real Supabase Auth (it holds the cookies the server set up for it). */
export async function browserFor(a: Account): Promise<Client> {
  const c = new Client()
  for (const [name, value] of jarOf(await signInCookies(a.email, a.password))) c.cookies.set(name, value)
  return c
}

/** A browser holding exactly these cookies (a JSON session from tests/helpers/auth). */
export function clientWith(session: string): Client {
  const c = new Client()
  for (const [name, value] of jarOf(session)) c.cookies.set(name, value)
  return c
}
