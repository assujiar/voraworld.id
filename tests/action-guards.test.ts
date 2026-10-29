import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sql } from '@/server/db'
import { act, createUser, sessionFor } from './helpers/actions'

/**
 * Every Server Action is a public HTTP endpoint. This file proves, for ALL actions found in src/actions/,
 * that the guard cannot be forgotten and that it works: source scan + execution as anonymous visitor,
 * as accounts without the admin role, as a stale session and from another origin.
 */
const DIR = join(process.cwd(), 'src/actions')
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts')).sort()

/** Actions that visitors may call without signing in. Adding one here is a deliberate, reviewed decision. */
const PUBLIC_ACTIONS = new Set(['login', 'logout', 'submitContact', 'submitQuote', 'submitApprovalAction'])

interface Found { file: string; name: string; body: string }
const found: Found[] = []
for (const file of FILES) {
  const src = readFileSync(join(DIR, file), 'utf8')
  const re = /^export async function (\w+)\(([^)]*)\)[^{]*\{/gm
  const marks = [...src.matchAll(re)]
  marks.forEach((m, i) => {
    found.push({ file, name: m[1], body: src.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? src.length) })
  })
}

describe('source scan', () => {
  it('finds the actions, including every one that moves money or releases a document', () => {
    expect(found.length).toBeGreaterThan(20)
    const names = found.map((f) => f.name)
    for (const n of ['confirmPaymentAction', 'cancelPaymentAction', 'recordPaymentAction', 'voidReceiptAction', 'uploadStampAction', 'reviewApprovalAction', 'requestApprovalAction',
      'createInvoiceAction', 'invoiceStatusAction', 'sendInvoiceAction', 'createQuotationAction', 'quotationStatusAction', 'saveCustomerAction', 'createBankAction', 'updateBankAction']) expect(names, n).toContain(n)
  })
  it.each(FILES)('%s is a "use server" module that exports only async functions (or types)', (file) => {
    const src = readFileSync(join(DIR, file), 'utf8')
    expect(src.startsWith("'use server'")).toBe(true)
    const stray = src.split('\n').filter((l) => /^export\s/.test(l) && !/^export async function \w+\(/.test(l) && !/^export (type|interface) /.test(l))
    expect(stray).toEqual([])
  })
  it('every action takes the form and hands its body to a guard runner', () => {
    for (const a of found) {
      const isPublic = PUBLIC_ACTIONS.has(a.name)
      expect(a.body, `${a.file}: ${a.name} must call its guard`).toMatch(isPublic ? /return publicRun\(/ : /return adminRun(Form)?\(/)
      expect(a.body, `${a.file}: ${a.name} uses the wrong guard`).not.toMatch(isPublic ? /adminRun/ : /publicRun/)
    }
  })
  it('an admin action does nothing before the guard runs', () => {
    for (const a of found.filter((f) => !PUBLIC_ACTIONS.has(f.name))) {
      expect(/^return adminRun(Form)?\(form,/.test(a.body.trimStart()), `${a.file}: ${a.name} starts with something else`).toBe(true)
    }
  })
  it('public actions are only in the files meant for visitors', () => {
    const allowedFiles = new Set(['auth.ts', 'public.ts', 'approval.ts'])
    for (const a of found.filter((f) => PUBLIC_ACTIONS.has(f.name))) expect(allowedFiles.has(a.file), `${a.name} in ${a.file}`).toBe(true)
  })
})

const tables = async () => (await sql`select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`).map((r) => r.name as string)
/** Content hash of every public table: detects inserted, changed and deleted rows. */
async function fingerprint() {
  const out: Record<string, string> = {}
  for (const t of await tables()) {
    const [r] = await sql.unsafe(`select count(*)::text || ':' || coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as h from "${t}" x`)
    out[t] = r.h as string
  }
  return out
}

/** Plausible values for whatever fields an action reads, so each guard is exercised with a realistic request. */
function formFor(body: string): Record<string, string | Blob> {
  const names = new Set<string>()
  for (const m of body.matchAll(/(?:str|rawStr|int|ids|fileBytes)\(form,\s*'(\w+)'/g)) names.add(m[1])
  for (const m of body.matchAll(/form\.get\('(\w+)'\)/g)) names.add(m[1])
  const form: Record<string, string | Blob> = {}
  for (const n of names) {
    if (/^(id|revision|.*_id)$/.test(n)) form[n] = '1'
    else if (n === 'move') form[n] = 'up'
    else if (/^(delete|remove|enabled|active|visible|funds_cleared)$/.test(n)) form[n] = n === 'funds_cleared' ? 'yes' : '1'
    else if (n === 'action') form[n] = 'publish'
    else if (/email/.test(n)) form[n] = 'someone@example.invalid'
    else if (/^(image|file|stamped|signed|document)/.test(n)) form[n] = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' })
    else if (n === 'port') form[n] = '587'
    else if (n === 'locale') form[n] = 'en'
    else form[n] = 'test'
  }
  return form
}

type AnyAction = (...args: never[]) => Promise<unknown>
const adminActions: Array<Found & { fn: AnyAction }> = []
beforeAll(async () => {
  for (const file of FILES) {
    const mod = (await import(/* @vite-ignore */ join(DIR, file))) as Record<string, AnyAction>
    for (const f of found.filter((x) => x.file === file && !PUBLIC_ACTIONS.has(x.name))) {
      expect(typeof mod[f.name], `${file}: ${f.name}`).toBe('function')
      adminActions.push({ ...f, fn: mod[f.name] })
    }
  }
})

describe('every admin action, executed', () => {
  let admin: string
  beforeAll(async () => { admin = await sessionFor(await createUser('guard-admin@example.invalid', 'admin')) })

  it('sends an anonymous visitor to the sign-in page and changes nothing', async () => {
    expect(adminActions.length).toBeGreaterThan(20)
    const before = await fingerprint()
    for (const a of adminActions) {
      const r = await act(a.fn, formFor(a.body))
      expect(r.redirect, `${a.name} (anonymous)`).toBe('/admin/login')
    }
    expect(await fingerprint()).toEqual(before)
  })

  it.each(['editor', 'sales', 'finance', 'viewer', 'superadmin', 'ADMIN', ''])('refuses an account whose role is %j and changes nothing', async (role) => {
    const token = await sessionFor(await createUser(`role-${role || 'blank'}@example.invalid`, role))
    const before = await fingerprint()
    for (const a of adminActions) {
      const r = await act(a.fn, formFor(a.body), { as: token })
      expect(r.redirect, `${a.name} (${role})`).toBeUndefined()
      expect(r.error?.status, `${a.name} (${role})`).toBe(403)
    }
    expect(await fingerprint()).toEqual(before)
  })

  it('refuses a deactivated account and a session issued before a password change', async () => {
    const u = await createUser('guard-stale@example.invalid', 'admin')
    const token = await sessionFor(u)
    await sql`update users set active = false where id = ${u.id}`
    const before = await fingerprint()
    for (const a of adminActions) expect((await act(a.fn, formFor(a.body), { as: token })).redirect, `${a.name} (deactivated)`).toBe('/admin/login')
    expect(await fingerprint()).toEqual(before)
    await sql`update users set active = true, password_hash = ${'pbkdf2_sha256$310000$c2FsdA$' + 'a'.repeat(43)} where id = ${u.id}`
    const afterReset = await fingerprint()
    for (const a of adminActions) expect((await act(a.fn, formFor(a.body), { as: token })).redirect, `${a.name} (stale)`).toBe('/admin/login')
    expect(await fingerprint()).toEqual(afterReset)
  })

  it('refuses a forged session cookie', async () => {
    const before = await fingerprint()
    for (const token of ['', 'x', 'a.b', 'eyJpZCI6MSwicm9sZSI6ImFkbWluIn0.AAAA', admin.slice(0, -2) + 'AA']) {
      for (const a of adminActions) expect((await act(a.fn, formFor(a.body), { as: token })).redirect, `${a.name} (${token.slice(0, 10)})`).toBe('/admin/login')
    }
    expect(await fingerprint()).toEqual(before)
  })

  it('refuses a request from another origin even with a valid admin session', async () => {
    const before = await fingerprint()
    for (const origin of ['https://evil.example', 'null', 'http://testserver.evil.example']) {
      for (const a of adminActions) {
        const r = await act(a.fn, formFor(a.body), { as: admin, headers: { origin } })
        expect(r.error?.status, `${a.name} (${origin})`).toBe(403)
      }
    }
    expect(await fingerprint()).toEqual(before)
  })

  it('answers malformed input with a message on the form, never a crash', async () => {
    for (const a of adminActions) {
      const empty = await act(a.fn, {}, { as: admin })
      expect(empty.error, `${a.name} (empty form): ${empty.error?.message}`).toBeUndefined()
      const junk = Object.fromEntries(Object.keys(formFor(a.body)).map((k) => [k, k === 'id' || k === 'revision' ? '99999999999999999999' : '\u0000'.repeat(3) + 'x'.repeat(50_000)]))
      const r = await act(a.fn, junk, { as: admin })
      expect(r.error, `${a.name} (junk): ${r.error?.message}`).toBeUndefined()
    }
  })
})
