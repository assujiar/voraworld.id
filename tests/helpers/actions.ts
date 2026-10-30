import { sql } from './db'
import { ensureAuthAccount, jarOf, signInCookies } from './auth'

interface Ctx { cookies: Map<string, string>; headers: Headers }
const ctx = () => (globalThis as unknown as { __voraRequestContext: Ctx }).__voraRequestContext
const signals = () => (globalThis as unknown as { __voraSignals: { RedirectSignal: new (u: string) => Error & { url: string; permanent: boolean } } }).__voraSignals

export interface Outcome { redirect?: string; permanent?: boolean; error?: Error & { status?: number }; state?: { error?: string; values?: Record<string, string | string[]> } }
export type Action = (...args: never[]) => Promise<unknown>

export interface TestUser { id: number; email: string; role: string; password: string }

/** A row in public.users (who may use the portal). It has no Supabase Auth account until `provision` or `sessionFor` gives it one. */
export async function createUser(email: string, role: string, password = 'Test-password-for-' + role + '-1'): Promise<TestUser> {
  const [u] = await sql`insert into users (email, role) values (${email}, ${role})
                        on conflict (email) do update set role = excluded.role, active = true returning id`
  return { id: u.id as number, email, role, password }
}

/** Gives the user a real Supabase Auth account with its password and links it to the row in public.users. */
export async function provision(user: TestUser): Promise<string> {
  const authId = await ensureAuthAccount(user.email, user.password)
  await sql`update users set auth_user_id = ${authId}, active = true where id = ${user.id}`
  return authId
}

/** Signs the user in against Supabase Auth and returns the session (the cookies a browser would hold). */
export async function sessionFor(user: TestUser): Promise<string> {
  await provision(user)
  return signInCookies(user.email, user.password)
}

/** Calls a Server Action as `as` (a session from sessionFor) or anonymously, and reports where it redirected or what it threw. */
export async function act(action: Action, fields: Record<string, string | string[] | Blob> = {}, opts: { as?: string; headers?: Record<string, string> } = {}): Promise<Outcome> {
  const c = ctx()
  c.cookies.clear()
  c.headers = new Headers({ host: 'testserver', ...(opts.headers ?? {}) })
  if (opts.as) for (const [name, value] of jarOf(opts.as)) c.cookies.set(name, value)
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) { if (Array.isArray(v)) v.forEach((x) => form.append(k, x)); else form.set(k, v) }
  try {
    // Form-state actions (used with React's useActionState) take (previousState, form) and return the state to show.
    const result = action.length >= 2 ? await (action as (p: unknown, f: FormData) => Promise<unknown>)({}, form) : await (action as (f: FormData) => Promise<unknown>)(form)
    return result ? { state: result as Outcome['state'] } : {}
  } catch (e) {
    const { RedirectSignal } = signals()
    if (e instanceof RedirectSignal) return { redirect: e.url, permanent: e.permanent }
    return { error: e as Outcome['error'] }
  }
}

/** Cookies set by the last action (e.g. the session after sign-in). */
export const cookiesAfter = () => new Map(ctx().cookies)
/** True when the last action left a Supabase Auth session cookie. */
export const hasSessionCookie = () => [...ctx().cookies.keys()].some((k) => /^sb-.*-auth-token/.test(k))

export const q = (url: string | undefined) => new URL(url ?? '/', 'http://x').searchParams
