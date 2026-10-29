import { afterEach, describe, expect, it, vi } from 'vitest'
import { sql } from '@/server/db'
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '@/server/auth/password'
import { createSessionToken, credentialFingerprint, readSessionToken } from '@/server/auth/session'
import { signToken, verifyToken } from '@/server/crypto'
import { requireUser, userFromToken } from '@/server/auth/guard'
import { attemptLogin, LOGIN_MAX_PER_EMAIL, LOGIN_MAX_PER_IP } from '@/server/auth/login'
import { assertSameOrigin } from '@/server/auth/csrf'
import { can, ROLE_NAMES } from '@/server/auth/roles'
import { clientIp, parseCookies } from '@/server/auth/cookies'
import { HttpError } from '@/server/http'

// Produced by the previous Python implementation (hashlib.pbkdf2_hmac, 310000 rounds, salt 00..1f).
const PYTHON_HASH = 'pbkdf2_sha256$310000$000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f$67cd1dea9a72f37ea164bd70a81235aac5af9ddea3c01b57b450e681c7f445b8'

async function makeUser(email: string, role = 'viewer', password = 'A-long-test-password-1') {
  const passwordHash = await hashPassword(password)
  const [u] = await sql`insert into users (email, password_hash, role) values (${email}, ${passwordHash}, ${role}) returning id`
  return { id: u.id as number, passwordHash, role }
}

describe('passwords', () => {
  it('accepts hashes written by the Python version and rejects other passwords', async () => {
    expect(await verifyPassword('LocalTestPass!9', PYTHON_HASH)).toBe(true)
    expect(await verifyPassword('LocalTestPass!8', PYTHON_HASH)).toBe(false)
  })
  it('hashes with a random salt and the same wire format', async () => {
    const a = await hashPassword('same-password-twice')
    const b = await hashPassword('same-password-twice')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^pbkdf2_sha256\$310000\$[0-9a-f]{64}\$[0-9a-f]{64}$/)
    expect(await verifyPassword('same-password-twice', a)).toBe(true)
  })
  it('never throws on malformed stored values', async () => {
    for (const bad of ['', 'x', 'pbkdf2_sha256$abc$00$00', 'md5$1$00$00', 'pbkdf2_sha256$310000$zz$zz', DUMMY_PASSWORD_HASH]) {
      expect(await verifyPassword('anything', bad)).toBe(false)
    }
  })
})

describe('signed tokens and sessions', () => {
  afterEach(() => vi.useRealTimers())
  it('round-trips and rejects tampering, wrong secret and wrong salt', async () => {
    const token = await signToken({ a: 1 }, 'secret-one', 'salt')
    expect((await verifyToken(token, 'secret-one', 'salt', 60))?.a).toBe(1)
    expect(await verifyToken(token, 'secret-two', 'salt', 60)).toBeNull()
    expect(await verifyToken(token, 'secret-one', 'other', 60)).toBeNull()
    const [body, mac] = token.split('.')
    expect(await verifyToken(`${body}x.${mac}`, 'secret-one', 'salt', 60)).toBeNull()
    expect(await verifyToken(`${body}.${mac}x`, 'secret-one', 'salt', 60)).toBeNull()
    for (const junk of ['', 'abc', '.', 'a.b', undefined, null]) expect(await verifyToken(junk as never, 'secret-one', 'salt', 60)).toBeNull()
  })
  it('expires after the maximum age', async () => {
    vi.useFakeTimers()
    const token = await signToken({}, 's', 'salt')
    vi.advanceTimersByTime(59_000)
    expect(await verifyToken(token, 's', 'salt', 60)).not.toBeNull()
    vi.advanceTimersByTime(2_000)
    expect(await verifyToken(token, 's', 'salt', 60)).toBeNull()
  })
  it('session tokens expire after 8 hours', async () => {
    vi.useFakeTimers()
    const token = await createSessionToken({ id: 7, passwordHash: 'h', role: 'viewer' })
    expect((await readSessionToken(token))?.id).toBe(7)
    vi.advanceTimersByTime(8 * 3600_000 + 5_000)
    expect(await readSessionToken(token)).toBeNull()
  })
})

describe('guard', () => {
  it('ends the session on password change, deactivation, deletion and role lookup', async () => {
    const u = await makeUser('guard@invalid.example', 'finance')
    const token = await createSessionToken(u)
    expect(await userFromToken(token)).toMatchObject({ email: 'guard@invalid.example', role: 'finance' })
    const changed = await hashPassword('A-new-password-after-reset')
    await sql`update users set password_hash = ${changed} where id = ${u.id}`
    expect(await userFromToken(token)).toBeNull()
    const fresh = await createSessionToken({ id: u.id, passwordHash: changed, role: 'finance' })
    expect(await userFromToken(fresh)).not.toBeNull()
    await sql`update users set role = 'admin' where id = ${u.id}`
    expect(await userFromToken(fresh)).toBeNull()   // a role change signs the user out, so the cookie's role is never stale
    await sql`update users set role = 'finance' where id = ${u.id}`
    expect(await userFromToken(fresh)).not.toBeNull()
    await sql`update users set active = false where id = ${u.id}`
    expect(await userFromToken(fresh)).toBeNull()
    await sql`delete from users where id = ${u.id}`
    expect(await userFromToken(fresh)).toBeNull()
    expect(await credentialFingerprint('a', 'x')).not.toBe(await credentialFingerprint('b', 'x'))
    expect(await credentialFingerprint('a', 'x')).not.toBe(await credentialFingerprint('a', 'y'))
  })
  it('requireUser answers 401 for anonymous and 403 for missing permission', async () => {
    const u = await makeUser('viewer-guard@invalid.example', 'viewer')
    const token = await createSessionToken(u)
    const req = (cookie?: string) => new Request('http://x/', { headers: cookie ? { cookie } : {} })
    await expect(requireUser(req())).rejects.toMatchObject({ status: 401 })
    await expect(requireUser(req('vora_session=garbage'))).rejects.toMatchObject({ status: 401 })
    await expect(requireUser(req(`vora_session=${token}`))).resolves.toMatchObject({ role: 'viewer' })
    await expect(requireUser(req(`vora_session=${token}`), 'finance')).rejects.toMatchObject({ status: 403 })
  })
})

describe('roles', () => {
  it('grant exactly the documented permissions', () => {
    const grants: Record<string, string[]> = { superadmin: ['content', 'crm', 'finance', 'settings'], admin: ['content', 'crm', 'finance', 'settings'], editor: ['content'], sales: ['crm'], finance: ['finance'], viewer: [] }
    for (const role of ROLE_NAMES) for (const p of ['content', 'crm', 'finance', 'settings'] as const) expect(can(role, p), `${role}:${p}`).toBe(grants[role].includes(p))
    expect(can('nobody', 'content')).toBe(false)
    expect(can('viewer')).toBe(true)
  })
})

describe('login', () => {
  it('signs in, audits, and treats unknown accounts exactly like wrong passwords', async () => {
    await makeUser('login@invalid.example', 'admin', 'Correct-horse-battery-1')
    const wrong = await attemptLogin('login@invalid.example', 'nope', '10.0.0.1')
    const unknown = await attemptLogin('ghost@invalid.example', 'nope', '10.0.0.1')
    expect(wrong).toEqual(unknown)
    expect(wrong).toEqual({ status: 'invalid' })
    const ok = await attemptLogin('  LOGIN@invalid.example ', 'Correct-horse-battery-1', '10.0.0.2')
    expect(ok.status).toBe('ok')
    const [{ n }] = await sql`select count(*)::int as n from audit_logs where verb = 'login'`
    expect(n).toBe(1)
  })
  it('locks an email out after repeated failures, even for the right password', async () => {
    await makeUser('lock@invalid.example', 'admin', 'Correct-horse-battery-2')
    for (let i = 0; i < LOGIN_MAX_PER_EMAIL; i++) expect((await attemptLogin('lock@invalid.example', 'bad', `10.1.0.${i}`)).status).toBe('invalid')
    expect((await attemptLogin('lock@invalid.example', 'Correct-horse-battery-2', '10.1.9.9')).status).toBe('blocked')
    await makeUser('other@invalid.example', 'admin', 'Correct-horse-battery-3')
    expect((await attemptLogin('other@invalid.example', 'Correct-horse-battery-3', '10.1.9.10')).status).toBe('ok')
  })
  it('locks an IP address out after many failures across accounts', async () => {
    for (let i = 0; i < LOGIN_MAX_PER_IP; i++) await attemptLogin(`spray${i}@invalid.example`, 'bad', '10.2.0.1')
    expect((await attemptLogin('spray-final@invalid.example', 'bad', '10.2.0.1')).status).toBe('blocked')
  })
  it('does not count old failures', async () => {
    await makeUser('old@invalid.example', 'admin', 'Correct-horse-battery-4')
    await sql`insert into login_attempts (email, ip, succeeded, created_at) select 'old@invalid.example', '10.3.0.1', false, now() - interval '20 minutes' from generate_series(1, 10)`
    expect((await attemptLogin('old@invalid.example', 'Correct-horse-battery-4', '10.3.0.2')).status).toBe('ok')
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
  it('parses cookies and client IPs', () => {
    expect(parseCookies('a=1; b=two%20words; a=ignored')).toEqual({ a: '1', b: 'two words' })
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' }))).toBe('9.9.9.9')
    expect(clientIp(new Headers())).toBe('')
  })
})
