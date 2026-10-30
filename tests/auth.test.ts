import { describe, expect, it } from 'vitest'
import { sql } from './helpers/db'
import { requireUser, userFromRequest } from '@/server/auth/guard'
import { attemptLogin, LOGIN_MAX_PER_EMAIL, LOGIN_MAX_PER_IP, requestPasswordReset } from '@/server/auth/login'
import { assertSameOrigin } from '@/server/auth/csrf'
import { ADMIN_ROLE, isAdminRole } from '@/server/auth/roles'
import { clientIp } from '@/server/auth/cookies'
import { MIN_PASSWORD_LENGTH } from '@/server/auth/policy'
import { HttpError } from '@/server/http'
import { resetPassword } from '@/actions/auth'
import { GET as authCallback } from '@/app/(admin)/admin/auth/callback/route'
import { act, cookiesAfter, createUser, hasSessionCookie, provision, q, sessionFor } from './helpers/actions'
import { authAdmin, authMails, cookieHeaderOf, ensureAuthAccount, forgedSessions, revokeSession, signInCookies } from './helpers/auth'

/**
 * Everything here runs against a real Supabase Auth server (GoTrue) in Docker: passwords, sessions, refresh, sign-out and the recovery email are
 * Supabase's own. What these tests prove is the application's side: who counts as an administrator, what happens to every other kind of account,
 * and that no session that Supabase Auth would refuse is ever accepted.
 */
const req = (as?: string) => new Request('http://x/', { headers: as ? { cookie: cookieHeaderOf(as) } : {} })
const ctxCookies = () => (globalThis as unknown as { __voraRequestContext: { cookies: Map<string, string>; headers: Headers } }).__voraRequestContext
/** Sign-in attempts run as a browser would: with an empty cookie jar and a request context. */
function browser(ip = '10.0.0.1') {
  const c = ctxCookies()
  c.cookies.clear()
  c.headers = new Headers({ host: 'testserver', 'x-real-ip': ip })
}

describe('guard', () => {
  it('lets an active administrator in and answers 401 to anyone without a valid Supabase session', async () => {
    const admin = await sessionFor(await createUser('admin-guard@invalid.example', 'admin'))
    await expect(requireUser(req(admin))).resolves.toMatchObject({ role: 'admin', email: 'admin-guard@invalid.example' })
    await expect(requireUser(req())).rejects.toMatchObject({ status: 401 })
    await expect(requireUser(new Request('http://x/', { headers: { cookie: 'sb-127-auth-token=garbage' } }))).rejects.toMatchObject({ status: 401 })
  })

  it('answers 403 to an account whose role is not admin', async () => {
    for (const role of ['viewer', 'editor', 'sales', 'finance', 'superadmin', 'ADMIN', '']) {
      const session = await sessionFor(await createUser(`role-${role || 'blank'}@invalid.example`, role))
      await expect(requireUser(req(session)), role).rejects.toMatchObject({ status: 403 })
    }
  })

  it('takes the role from public.users and never from what the Auth account says about itself', async () => {
    const u = await createUser('metadata@invalid.example', 'viewer')
    const authId = await provision(u)
    const { error } = await authAdmin().updateUserById(authId, { user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } })
    expect(error).toBeNull()
    const session = await signInCookies(u.email, u.password)
    await expect(requireUser(req(session))).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a Supabase account that has no row in public.users', async () => {
    await ensureAuthAccount('stranger@invalid.example', 'Stranger-password-1234')
    const session = await signInCookies('stranger@invalid.example', 'Stranger-password-1234')
    await expect(requireUser(req(session))).rejects.toMatchObject({ status: 401 })
    expect(await userFromRequest(req(session))).toBeNull()
  })

  it('stops accepting a session the moment the account is deactivated, and again after it is reactivated', async () => {
    const u = await createUser('deactivated@invalid.example', 'admin')
    const session = await sessionFor(u)
    await expect(requireUser(req(session))).resolves.toMatchObject({ id: u.id })
    await sql`update users set active = false where id = ${u.id}`
    await expect(requireUser(req(session))).rejects.toMatchObject({ status: 401 })
    await sql`update users set active = true where id = ${u.id}`
    await expect(requireUser(req(session))).resolves.toMatchObject({ id: u.id })
    await sql`update users set role = 'viewer' where id = ${u.id}`
    await expect(requireUser(req(session))).rejects.toMatchObject({ status: 403 })   // a role change applies at once: nothing is cached in the cookie
  })

  it('stops accepting a session that Supabase Auth has ended (sign-out elsewhere) or whose account was deleted', async () => {
    const out = await sessionFor(await createUser('signed-out@invalid.example', 'admin'))
    await expect(requireUser(req(out))).resolves.toBeTruthy()
    await revokeSession(out)
    await expect(requireUser(req(out))).rejects.toMatchObject({ status: 401 })

    const gone = await createUser('deleted@invalid.example', 'admin')
    const session = await sessionFor(gone)
    const [{ authUserId }] = await sql`select auth_user_id from users where id = ${gone.id}`
    const { error } = await authAdmin().deleteUser(authUserId as string)
    expect(error).toBeNull()
    await expect(requireUser(req(session))).rejects.toMatchObject({ status: 401 })
  })

  it('refuses sessions that were forged or tampered with', async () => {
    const real = await sessionFor(await createUser('forged@invalid.example', 'admin'))
    await expect(requireUser(req(real))).resolves.toBeTruthy()
    const forged = forgedSessions(real)
    expect(Object.keys(forged).length).toBeGreaterThanOrEqual(6)
    for (const [kind, session] of Object.entries(forged)) await expect(requireUser(req(session)), kind).rejects.toMatchObject({ status: 401 })
  })
})

describe('roles', () => {
  it('has one role, admin, and denies every other value', () => {
    expect(ADMIN_ROLE).toBe('admin')
    expect(isAdminRole('admin')).toBe(true)
    for (const other of ['superadmin', 'editor', 'sales', 'finance', 'viewer', 'ADMIN', 'admin ', '', 'root', null, undefined]) expect(isAdminRole(other as string), String(other)).toBe(false)
  })
})

describe('login', () => {
  it('signs in, audits, and treats unknown accounts exactly like wrong passwords', async () => {
    const u = await createUser('login@invalid.example', 'admin', 'Correct-horse-battery-1')
    await provision(u)
    browser('10.0.0.1')
    const wrong = await attemptLogin('login@invalid.example', 'nope', '10.0.0.1')
    const unknown = await attemptLogin('ghost@invalid.example', 'nope', '10.0.0.1')
    expect(wrong).toEqual(unknown)
    expect(wrong).toEqual({ status: 'invalid' })
    expect(hasSessionCookie()).toBe(false)
    const ok = await attemptLogin('  LOGIN@invalid.example ', 'Correct-horse-battery-1', '10.0.0.2')
    expect(ok.status).toBe('ok')
    expect(hasSessionCookie()).toBe(true)
    const [{ n }] = await sql`select count(*)::int as n from audit_logs where verb = 'login' and actor_id = ${u.id}`
    expect(n).toBe(1)
  })

  it('does not let a Supabase account in unless it is an active administrator, and leaves no session behind', async () => {
    await ensureAuthAccount('no-row@invalid.example', 'No-row-password-1234')
    const viewer = await createUser('viewer-login@invalid.example', 'viewer', 'Viewer-password-1234')
    await provision(viewer)
    const inactive = await createUser('inactive-login@invalid.example', 'admin', 'Inactive-password-1234')
    await provision(inactive)
    await sql`update users set active = false where id = ${inactive.id}`
    for (const [email, password] of [['no-row@invalid.example', 'No-row-password-1234'], [viewer.email, viewer.password], [inactive.email, inactive.password]]) {
      browser('10.0.1.1')
      expect(await attemptLogin(email, password, '10.0.1.1'), email).toEqual({ status: 'invalid' })
      expect(hasSessionCookie(), email).toBe(false)
    }
  })

  it('locks an email out after repeated failures, even for the right password', async () => {
    const lock = await createUser('lock@invalid.example', 'admin', 'Correct-horse-battery-2')
    await provision(lock)
    for (let i = 0; i < LOGIN_MAX_PER_EMAIL; i++) { browser(`10.1.0.${i}`); expect((await attemptLogin('lock@invalid.example', 'bad', `10.1.0.${i}`)).status).toBe('invalid') }
    browser('10.1.9.9')
    expect((await attemptLogin('lock@invalid.example', 'Correct-horse-battery-2', '10.1.9.9')).status).toBe('blocked')
    expect(hasSessionCookie()).toBe(false)
    const other = await createUser('other@invalid.example', 'admin', 'Correct-horse-battery-3')
    await provision(other)
    browser('10.1.9.10')
    expect((await attemptLogin('other@invalid.example', 'Correct-horse-battery-3', '10.1.9.10')).status).toBe('ok')
  })

  it('locks an IP address out after many failures across accounts', async () => {
    browser('10.2.0.1')
    for (let i = 0; i < LOGIN_MAX_PER_IP; i++) await attemptLogin(`spray${i}@invalid.example`, 'bad', '10.2.0.1')
    expect((await attemptLogin('spray-final@invalid.example', 'bad', '10.2.0.1')).status).toBe('blocked')
  })

  it('does not count old failures', async () => {
    const u = await createUser('old@invalid.example', 'admin', 'Correct-horse-battery-4')
    await provision(u)
    await sql`insert into login_attempts (email, ip, succeeded, created_at) select 'old@invalid.example', '10.3.0.1', false, now() - interval '20 minutes' from generate_series(1, 10)`
    browser('10.3.0.2')
    expect((await attemptLogin('old@invalid.example', 'Correct-horse-battery-4', '10.3.0.2')).status).toBe('ok')
  })
})

describe('password reset', () => {
  const redirectTo = 'http://localhost:3000/admin/auth/callback?next=%2Fadmin%2Freset-password'

  /** The address in the recovery email that GoTrue sent, opened the way the person's browser would: it answers with a redirect carrying the code. */
  async function codeFromEmail(to: string): Promise<{ code: string; mail: Awaited<ReturnType<typeof authMails>>[number] }> {
    const mail = (await authMails()).filter((m) => m.to === to).at(-1)
    expect(mail, `a recovery email for ${to}`).toBeTruthy()
    const href = /href="([^"]+)"/.exec(mail!.body)?.[1].replace(/&amp;/g, '&')
    expect(href, 'a link in the email').toMatch(/\/verify\?token=pkce_/)
    const hop = await fetch(href!, { redirect: 'manual' })
    const location = hop.headers.get('location') ?? ''
    expect(location, 'Supabase sends the person back to the application').toMatch(/^http:\/\/localhost:3000\/admin\/auth\/callback\?/)
    const code = new URL(location).searchParams.get('code')
    expect(code, 'a one-time code').toBeTruthy()
    return { code: code!, mail: mail! }
  }

  it('emails an administrator a one-time link; the same answer is given for an address that is not one, and nothing is sent to it', async () => {
    await authMails(true)
    const u = await createUser('reset@invalid.example', 'admin', 'Old-password-for-reset-1')
    await provision(u)
    const viewer = await createUser('reset-viewer@invalid.example', 'viewer'); await provision(viewer)
    ctxCookies().cookies.clear()
    ctxCookies().headers = new Headers({ host: 'testserver' })
    for (const email of ['reset@invalid.example', 'reset-viewer@invalid.example', 'ghost-reset@invalid.example']) {
      expect(await requestPasswordReset(email, '10.4.0.1', redirectTo), email).toBe('sent-or-ignored')
    }
    const recipients = (await authMails()).map((m) => m.to)
    expect(recipients).toEqual(['reset@invalid.example'])
  })

  it('signs the administrator in through the emailed link once, lets them choose a new password, and the link cannot be used again', async () => {
    await authMails(true)
    const u = await createUser('reset-flow@invalid.example', 'admin', 'Old-password-for-flow-1')
    await provision(u)
    browser('10.4.1.1')
    await requestPasswordReset(u.email, '10.4.1.1', redirectTo)
    const verifier = new Map(ctxCookies().cookies)            // the browser keeps the PKCE verifier cookie while the person reads their mail
    expect([...verifier.keys()].some((k) => k.endsWith('code-verifier'))).toBe(true)
    const { code } = await codeFromEmail(u.email)

    const land = async (c: string) => {
      browser('10.4.1.2')
      for (const [k, v] of verifier) ctxCookies().cookies.set(k, v)
      return authCallback(new Request(`http://testserver/admin/auth/callback?code=${encodeURIComponent(c)}&next=${encodeURIComponent('/admin/reset-password')}`))
    }
    const res = await land(code)
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location')!, 'http://x').pathname).toBe('/admin/reset-password')
    expect(hasSessionCookie()).toBe(true)
    const session = JSON.stringify([...cookiesAfter()].filter(([k]) => /^sb-.*-auth-token/.test(k) && !k.endsWith('code-verifier')))

    const newPassword = 'A-brand-new-password-2026'
    expect(newPassword.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH)
    expect(q((await act(resetPassword, { password: 'short', confirm: 'short' }, { as: session })).redirect).get('error')).toMatch(/at least/)
    expect(q((await act(resetPassword, { password: newPassword, confirm: newPassword + 'x' }, { as: session })).redirect).get('error')).toMatch(/do not match/)
    const done = await act(resetPassword, { password: newPassword, confirm: newPassword }, { as: session })
    expect(done.redirect).toMatch(/^\/admin\?notice=/)

    await expect(signInCookies(u.email, 'Old-password-for-flow-1')).rejects.toBeTruthy()
    await expect(signInCookies(u.email, newPassword)).resolves.toBeTruthy()

    const again = await land(code)                              // used already
    expect(new URL(again.headers.get('location')!, 'http://x').pathname).toBe('/admin/login')
    expect(new URL(again.headers.get('location')!, 'http://x').searchParams.get('error')).toMatch(/expired or was already used/)
  })

  it('does not accept an empty, oversized or invented code at the callback', async () => {
    for (const c of ['', 'x', 'a'.repeat(500), 'pkce_' + 'b'.repeat(40)]) {
      browser('10.4.2.1')
      const res = await authCallback(new Request(`http://testserver/admin/auth/callback?code=${c}&next=/admin`))
      expect(new URL(res.headers.get('location')!, 'http://x').pathname, c.slice(0, 8)).toBe('/admin/login')
      expect(hasSessionCookie()).toBe(false)
    }
  })

  it('only follows a local /admin path after the callback', async () => {
    browser('10.4.3.1')
    const res = await authCallback(new Request('http://testserver/admin/auth/callback?code=&next=https://evil.example'))
    expect(res.headers.get('location')).toMatch(/^\/admin\/login\?error=/)       // a relative path: the person stays on the address they came by
  })
})

describe('origin check', () => {
  const h = (headers: Record<string, string>) => new Headers(headers)
  it('refuses cross-site Origin headers but allows same-site and non-browser clients', () => {
    expect(() => assertSameOrigin(h({ host: 'app.example', origin: 'http://app.example' }))).not.toThrow()
    expect(() => assertSameOrigin(h({ host: 'app.example' }))).not.toThrow()
    expect(() => assertSameOrigin(h({ 'x-forwarded-host': 'app.example', host: 'internal:3000', origin: 'https://app.example' }))).not.toThrow()
    expect(() => assertSameOrigin(h({ host: 'app.example', origin: 'https://evil.example' }))).toThrow(HttpError)
    expect(() => assertSameOrigin(h({ host: 'app.example', origin: 'null' }))).toThrow(HttpError)
    expect(() => assertSameOrigin(h({ host: 'app.example', origin: 'http://app.example.evil.example' }))).toThrow(HttpError)
    expect(() => assertSameOrigin(h({ origin: 'http://app.example' }))).toThrow(HttpError)
  })
  it('reads the client address from the proxy headers', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' }))).toBe('9.9.9.9')
    expect(clientIp(new Headers())).toBe('')
  })
})
