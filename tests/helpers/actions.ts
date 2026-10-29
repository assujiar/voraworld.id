import { hashPassword } from '@/server/auth/password'
import { createSessionToken, SESSION_COOKIE } from '@/server/auth/session'
import { sql } from '@/server/db'

interface Ctx { cookies: Map<string, string>; headers: Headers }
const ctx = () => (globalThis as unknown as { __voraRequestContext: Ctx }).__voraRequestContext
const signals = () => (globalThis as unknown as { __voraSignals: { RedirectSignal: new (u: string) => Error & { url: string; permanent: boolean } } }).__voraSignals

export interface Outcome { redirect?: string; permanent?: boolean; error?: Error & { status?: number }; state?: { error?: string; values?: Record<string, string | string[]> } }
export type Action = (...args: never[]) => Promise<unknown>

export async function createUser(email: string, role: string, password = 'Test-password-for-' + role + '-1') {
  const passwordHash = await hashPassword(password)
  const [u] = await sql`insert into users (email, password_hash, role) values (${email}, ${passwordHash}, ${role})
                        on conflict (email) do update set password_hash = excluded.password_hash, role = excluded.role, active = true returning id`
  return { id: u.id as number, email, role, passwordHash, password }
}

export async function sessionFor(user: { id: number; passwordHash: string; role: string }) {
  return createSessionToken(user)
}

/** Calls a Server Action as `as` (a session token) or anonymously, and reports where it redirected or what it threw. */
export async function act(action: Action, fields: Record<string, string | string[] | Blob> = {}, opts: { as?: string; headers?: Record<string, string> } = {}): Promise<Outcome> {
  const c = ctx()
  c.cookies.clear()
  c.headers = new Headers({ host: 'testserver', ...(opts.headers ?? {}) })
  if (opts.as) c.cookies.set(SESSION_COOKIE, opts.as)
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

export const q = (url: string | undefined) => new URL(url ?? '/', 'http://x').searchParams
