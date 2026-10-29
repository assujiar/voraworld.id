import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { run, type Io } from '../scripts/manage-users'
import { UserCommandError, checkPassword, createAdmin, listUsers, normalizeEmail, resetPassword, setActive } from '../scripts/lib/users'
import { attemptLogin } from '@/server/auth/login'
import { userFromToken } from '@/server/auth/guard'
import { verifyPassword } from '@/server/auth/password'
import { readSessionToken } from '@/server/auth/session'
import { sql } from '@/server/db'

const PW1 = 'first-password-1234'
const PW2 = 'second-password-5678'
const login = async (email: string, password: string, ip = '203.0.113.9') => attemptLogin(email, password, ip)
const refuses = async (p: Promise<unknown>, message: RegExp | string) => {
  const e = await p.then(() => null, (x: unknown) => x)
  expect(e).toBeInstanceOf(UserCommandError)
  expect((e as Error).message).toMatch(message)
}

describe('account administration', () => {
  it('creates an admin, hashes the password, audits it and refuses duplicates', async () => {
    const u = await createAdmin(sql as never, '  New.Admin@Example.INVALID ', PW1)
    const [row] = await sql`select email, role, active, password_hash from users where id = ${u.id}`
    expect(row).toMatchObject({ email: 'new.admin@example.invalid', role: 'admin', active: true })
    expect(row.passwordHash).toMatch(/^pbkdf2_sha256\$310000\$[0-9a-f]{64}\$[0-9a-f]{64}$/)
    expect(row.passwordHash).not.toContain(PW1)
    expect(await verifyPassword(PW1, row.passwordHash as string)).toBe(true)
    const [audit] = await sql`select verb, actor_id, summary from audit_logs where object_type = 'user' and object_id = ${u.id}`
    expect(audit).toMatchObject({ verb: 'user-create', actorId: null }); expect(audit.summary).not.toContain(PW1)
    await refuses(createAdmin(sql as never, 'NEW.admin@example.invalid', PW2), 'already exists')
  })

  it('rejects weak passwords and malformed addresses without creating anything', async () => {
    const before = (await listUsers(sql as never)).length
    for (const pw of ['short', 'x'.repeat(13), ' '.repeat(20), '']) await refuses(createAdmin(sql as never, 'weak@example.invalid', pw), /at least 14|blank/)
    for (const email of ['', 'nobody', 'a@b', 'a b@c.d', '@x.example']) await refuses(createAdmin(sql as never, email, PW1), 'valid email')
    expect((await listUsers(sql as never)).length).toBe(before)
    expect(() => normalizeEmail('A@B.CO')).not.toThrow(); expect(() => checkPassword('x'.repeat(14))).not.toThrow()
  })

  it('resetting the password signs the account out everywhere; the old password stops working', async () => {
    await createAdmin(sql as never, 'reset.me@example.invalid', PW1)
    const first = await login('reset.me@example.invalid', PW1)
    expect(first.status).toBe('ok')
    const token = (first as { token: string }).token
    expect((await readSessionToken(token))?.id).toBeTypeOf('number')
    expect(await userFromToken(token)).toMatchObject({ email: 'reset.me@example.invalid', role: 'admin' })
    await resetPassword(sql as never, 'reset.me@example.invalid', PW2)
    expect(await userFromToken(token)).toBeNull()                          // the session died with the old password
    expect((await login('reset.me@example.invalid', PW1, '203.0.113.10')).status).toBe('invalid')
    expect((await login('reset.me@example.invalid', PW2, '203.0.113.11')).status).toBe('ok')
    await refuses(resetPassword(sql as never, 'nobody@example.invalid', PW2), 'No such account')
    await refuses(resetPassword(sql as never, 'reset.me@example.invalid', 'short'), 'at least 14')
  })

  it('deactivating ends the sessions and blocks sign-in; activating brings the account back', async () => {
    await createAdmin(sql as never, 'toggle@example.invalid', PW1)
    const token = ((await login('toggle@example.invalid', PW1, '203.0.113.20')) as { token: string }).token
    await setActive(sql as never, 'toggle@example.invalid', false)
    expect(await userFromToken(token)).toBeNull()
    expect((await login('toggle@example.invalid', PW1, '203.0.113.21')).status).toBe('invalid')
    await setActive(sql as never, 'toggle@example.invalid', true)
    expect((await login('toggle@example.invalid', PW1, '203.0.113.22')).status).toBe('ok')
    const verbs = (await sql`select verb from audit_logs where object_type = 'user' and summary = 'toggle@example.invalid' order by id`).map((r) => r.verb)
    expect(verbs).toEqual(['user-deactivate', 'user-activate'])
    await refuses(setActive(sql as never, 'nobody@example.invalid', false), 'No such account')
  })
})

describe('the command line', () => {
  const io = (opts: { stdin?: string; secrets?: string[]; interactive?: boolean } = {}) => {
    const out: string[] = []
    const secrets = [...(opts.secrets ?? [])]
    const tool: Io = { out: (l) => out.push(l), readLine: async () => opts.stdin ?? '', readSecret: async () => secrets.shift() ?? '', interactive: opts.interactive ?? false }
    return { out, tool }
  }

  it('creates an account from a piped password and never prints it', async () => {
    const { out, tool } = io({ stdin: PW1 + '\n' })
    expect(await run(['create', 'cli.user@example.invalid', '--password-stdin'], sql as never, tool)).toBe(0)
    expect(out.join('\n')).toContain('Admin account created'); expect(out.join('\n')).not.toContain(PW1)
    expect((await login('cli.user@example.invalid', PW1, '203.0.113.30')).status).toBe('ok')
  })
  it('asks twice on a terminal and refuses a mismatch', async () => {
    const a = io({ interactive: true, secrets: [PW1, PW2] })
    expect(await run(['create', 'typo@example.invalid'], sql as never, a.tool)).toBe(2)
    expect(a.out.join('\n')).toContain('do not match')
    expect((await sql`select 1 from users where email = 'typo@example.invalid'`).length).toBe(0)
    const b = io({ interactive: true, secrets: [PW1, PW1] })
    expect(await run(['create', 'typed@example.invalid'], sql as never, b.tool)).toBe(0)
  })
  it('refuses to guess a password when it is not on a terminal', async () => {
    const { out, tool } = io({ interactive: false })
    expect(await run(['create', 'pipe@example.invalid'], sql as never, tool)).toBe(2)
    expect(out.join('\n')).toContain('--password-stdin')
  })
  it('has no role option: one role, admin, everything open', async () => {
    for (const argv of [['create', 'r@example.invalid', '--role', 'finance', '--password-stdin'], ['create', 'r@example.invalid', '--role=viewer'], ['set-role', 'typed@example.invalid', 'viewer'], ['promote', 'x@example.invalid'], [], ['create']]) {
      const { out, tool } = io({ stdin: PW1 })
      expect(await run(argv, sql as never, tool), argv.join(' ')).toBe(2)
      expect(out.length).toBeGreaterThan(0)
    }
    expect((await sql`select 1 from users where email = 'r@example.invalid'`).length).toBe(0)
  })
  it('warns when an account holds a role that gives no access, and says how to fix it', async () => {
    await sql`insert into users (email, password_hash, role) values ('legacy.sales@example.invalid', 'x', 'sales')`
    const create = io({ stdin: PW1 })
    expect(await run(['create', 'legacy.sales@example.invalid', '--password-stdin'], sql as never, create.tool)).toBe(2)
    expect(create.out.join('\n')).toMatch(/role "sales".*UPDATE users SET role = 'admin' WHERE email = 'legacy\.sales@example\.invalid';/s)
    const reset = io({ stdin: PW2 })
    expect(await run(['reset-password', 'legacy.sales@example.invalid', '--password-stdin'], sql as never, reset.tool)).toBe(0)
    expect(reset.out.join('\n')).toMatch(/Note: .*role "sales"/s)
    const on = io(); expect(await run(['activate', 'legacy.sales@example.invalid'], sql as never, on.tool)).toBe(0)
    expect(on.out.join('\n')).toMatch(/Note: .*role "sales"/s)
    const off = io(); expect(await run(['deactivate', 'legacy.sales@example.invalid'], sql as never, off.tool)).toBe(0)
    expect(off.out.join('\n')).not.toContain('Note:')
    // The statement it prints really does open the portal.
    await sql`update users set role = 'admin' where email = 'legacy.sales@example.invalid'`
    const again = io({ stdin: PW1 }); expect(await run(['create', 'legacy.sales@example.invalid', '--password-stdin'], sql as never, again.tool)).toBe(2)
    expect(again.out.join('\n')).toContain('already exists (use reset-password)')
  })
  it('lists, resets, deactivates and activates', async () => {
    const list = io(); expect(await run(['list'], sql as never, list.tool)).toBe(0)
    expect(list.out.join('\n')).toMatch(/cli\.user@example\.invalid\s+admin\s+active/)
    const reset = io({ stdin: PW2 }); expect(await run(['reset-password', 'CLI.user@example.invalid', '--password-stdin'], sql as never, reset.tool)).toBe(0)
    expect(reset.out.join('\n')).toContain('existing session'); expect((await login('cli.user@example.invalid', PW2, '203.0.113.31')).status).toBe('ok')
    const off = io(); expect(await run(['deactivate', 'cli.user@example.invalid'], sql as never, off.tool)).toBe(0)
    const list2 = io(); await run(['list'], sql as never, list2.tool); expect(list2.out.join('\n')).toMatch(/cli\.user@example\.invalid\s+admin\s+DISABLED/)
    const on = io(); expect(await run(['activate', 'cli.user@example.invalid'], sql as never, on.tool)).toBe(0)
    const missing = io(); expect(await run(['deactivate', 'ghost@example.invalid'], sql as never, missing.tool)).toBe(2)
  })
})

describe('the program itself (a real child process, a real pipe)', () => {
  /** Runs `scripts/manage-users.ts` the way an owner does: DATABASE_URL in the environment, the password on standard input. */
  const cli = (args: string[], stdin = '') => {
    const r = spawnSync(process.execPath, [join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), 'scripts/manage-users.ts', ...args], {
      input: stdin, encoding: 'utf8', env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, timeout: 60_000,
    })
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
  }

  it('reads a piped password with or without a trailing newline, and never prints it', async () => {
    const withNewline = cli(['create', 'pipe.one@example.invalid', '--password-stdin'], PW1 + '\n')
    expect(withNewline.code, withNewline.out).toBe(0)
    const without = cli(['create', 'pipe.two@example.invalid', '--password-stdin'], PW2)
    expect(without.code, without.out).toBe(0)
    expect(withNewline.out + without.out).not.toContain(PW1)
    expect(withNewline.out + without.out).not.toContain(PW2)
    expect((await login('pipe.one@example.invalid', PW1, '203.0.113.50')).status).toBe('ok')
    expect((await login('pipe.two@example.invalid', PW2, '203.0.113.51')).status).toBe('ok')
  })

  it('refuses an empty pipe, a short password and a second account with the same email', () => {
    expect(cli(['create', 'empty@example.invalid', '--password-stdin'], '').out).toContain('at least 14')
    expect(cli(['create', 'short@example.invalid', '--password-stdin'], 'short\n').out).toContain('at least 14')
    const again = cli(['create', 'pipe.one@example.invalid', '--password-stdin'], PW2 + '\n')
    expect(again.code).toBe(2)
    expect(again.out).toContain('already exists')
  })

  it('lists and deactivates through the same entry point', () => {
    const list = cli(['list'])
    expect(list.code, list.out).toBe(0)
    expect(list.out).toMatch(/pipe\.one@example\.invalid\s+admin\s+active/)
    expect(cli(['deactivate', 'pipe.one@example.invalid']).code).toBe(0)
    expect(cli(['list']).out).toMatch(/pipe\.one@example\.invalid\s+admin\s+DISABLED/)
  })
})
