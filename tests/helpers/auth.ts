import { createHmac } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Helpers that talk to the real Supabase Auth (GoTrue) started by tests/setup/global.ts. A "session" in a test is exactly what the browser
 * would hold: the cookies the Supabase client writes after signing in, kept as a JSON list of [name, value] pairs.
 */
const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const secretKey = () => process.env.SUPABASE_SECRET_KEY!

/** Where the Supabase Auth under test is; defaults to the one named by the environment. */
export interface AuthTarget { url: string; secretKey: string }
const envTarget = (): AuthTarget => ({ url: url(), secretKey: secretKey() })

export const authAdmin = (t: AuthTarget = envTarget()) => createClient(t.url, t.secretKey, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin

async function findAuthUser(email: string, t?: AuthTarget) {
  const a = authAdmin(t)
  for (let page = 1; page < 50; page++) {
    const { data, error } = await a.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit || data.users.length < 200) return hit
  }
  return undefined
}

/** Creates the Auth account (confirmed, as an administrator would from the dashboard), or resets its password when it already exists. */
export async function ensureAuthAccount(email: string, password: string, t?: AuthTarget): Promise<string> {
  const a = authAdmin(t)
  const made = await a.createUser({ email, password, email_confirm: true })
  if (made.data.user) return made.data.user.id
  const found = await findAuthUser(email, t)
  if (!found) throw made.error ?? new Error(`Could not create the Auth account ${email}`)
  const updated = await a.updateUserById(found.id, { password, email_confirm: true })
  if (updated.error) throw updated.error
  return found.id
}

export type CookieJar = Map<string, string>

/** A Supabase server client whose cookies live in `jar`. */
export function clientWithJar(jar: CookieJar) {
  return createServerClient(url(), publishableKey(), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => { for (const c of list) { if (!c.value) jar.delete(c.name); else jar.set(c.name, c.value) } },
    },
  })
}

/** Signs in for real and returns the session as the cookie list a browser would send. */
export async function signInCookies(email: string, password: string): Promise<string> {
  const jar: CookieJar = new Map()
  const { error } = await clientWithJar(jar).auth.signInWithPassword({ email, password })
  if (error) throw error
  return JSON.stringify([...jar])
}

export const jarOf = (as: string): CookieJar => new Map(JSON.parse(as) as Array<[string, string]>)
/** The Cookie header for a session, for code that reads a raw Request. */
export const cookieHeaderOf = (as: string) => [...jarOf(as)].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')

export interface SinkMail { to: string; subject: string; body: string }
/** Messages Supabase Auth tried to email (read from the test gateway). */
export async function authMails(clear = false): Promise<SinkMail[]> {
  const r = await fetch(`${url()}/__mails`, { method: clear ? 'DELETE' : 'GET' })
  return (await r.json()) as SinkMail[]
}

/** Ends the session on the Auth server (global sign-out), the way an administrator signing out elsewhere would. The cookies stay valid-looking. */
export async function revokeSession(as: string): Promise<void> {
  const { error } = await clientWithJar(jarOf(as)).auth.signOut({ scope: 'global' })
  if (error) throw error
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** The session JSON a Supabase cookie holds (`base64-` + base64url of JSON), possibly split over `name.0`, `name.1`... */
function readSession(jar: CookieJar): { name: string; session: Record<string, unknown> } {
  const name = [...jar.keys()].map((k) => k.replace(/\.\d+$/, '')).find((k) => /^sb-.*-auth-token$/.test(k))
  if (!name) throw new Error('No Supabase session cookie in this session')
  const parts = [...jar].filter(([k]) => k === name || k.startsWith(`${name}.`)).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  const raw = parts.map(([, v]) => v).join('')
  return { name, session: JSON.parse(Buffer.from(raw.replace(/^base64-/, ''), 'base64url').toString('utf8')) }
}

function writeSession(jar: CookieJar, name: string, session: Record<string, unknown>): string {
  for (const k of [...jar.keys()]) if (k === name || k.startsWith(`${name}.`)) jar.delete(k)
  jar.set(name, 'base64-' + b64u(JSON.stringify(session)))
  return JSON.stringify([...jar])
}

/** Sessions an attacker could make up, each carrying the real account's id but never a valid signature from this project. */
export function forgedSessions(as: string): Record<string, string> {
  const real = jarOf(as)
  const { name, session } = readSession(real)
  const token = String(session.access_token)
  const [head, body] = token.split('.')
  const resign = (secret: string, payload: Record<string, unknown>) => {
    const h = `${head}.${b64u(JSON.stringify(payload))}`
    return `${h}.${createHmac('sha256', secret).update(h).digest('base64url')}`
  }
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>
  const out: Record<string, string> = {
    'another secret': writeSession(jarOf(as), name, { ...session, access_token: resign('not-this-projects-secret', claims) }),
    'altered claims': writeSession(jarOf(as), name, { ...session, access_token: `${head}.${b64u(JSON.stringify({ ...claims, role: 'service_role', sub: '00000000-0000-0000-0000-000000000000' }))}.${token.split('.')[2]}` }),
    'cut signature': writeSession(jarOf(as), name, { ...session, access_token: token.slice(0, -4) + 'AAAA' }),
    'no signature': writeSession(jarOf(as), name, { ...session, access_token: `${head}.${body}.` }),
    'not a token': writeSession(jarOf(as), name, { ...session, access_token: 'x', refresh_token: 'y' }),
    'not json': JSON.stringify([[name, 'base64-' + b64u('not json')]]),
    'plain text': JSON.stringify([[name, 'x']]),
  }
  return out
}
