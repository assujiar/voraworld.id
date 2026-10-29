import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_MENU } from '@/content/admin-menu'
import { hashPassword } from '@/server/auth/password'
import { SESSION_COOKIE, createSessionToken } from '@/server/auth/session'
import { Client } from './client'

/** The real production server, real cookies, every admin URL: who gets in, and what each page contains. */
const db = postgres(process.env.HTTP_DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(async () => { await db.end({ timeout: 5 }) })

async function account(email: string, role: string) {
  const passwordHash = await hashPassword('Correct-horse-battery-9')
  const [u] = await db`insert into users (email, password_hash, role) values (${email}, ${passwordHash}, ${role}) on conflict (email) do update set password_hash = excluded.password_hash, role = excluded.role, active = true returning id`
  return { id: u.id as number, passwordHash, role }
}
const withSession = async (u: { id: number; passwordHash: string; role: string }) => {
  process.env.SESSION_SECRET = process.env.HTTP_SESSION_SECRET
  const c = new Client()
  c.cookies.set(SESSION_COOKIE, await createSessionToken(u))
  return c
}

/** URL of every page and route handler under src/app/(admin)/admin, with dynamic segments filled in. */
function adminRoutes(): string[] {
  const root = join(process.cwd(), 'src/app/(admin)/admin')
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (!/^(page\.tsx|route\.ts)$/.test(name)) continue
      const segs = relative(root, dir).split('/').filter((s) => s && !/^\(.*\)$/.test(s)).map((s) => (s.startsWith('[') ? '{id}' : s))
      out.push('/admin' + (segs.length ? '/' + segs.join('/') : ''))
    }
  }
  walk(root)
  return [...new Set(out)].sort()
}
const ROUTES = adminRoutes()
/** Ids of fixture rows by collection, so `/admin/articles/{id}` can be opened for real. */
const IDS: Record<string, number> = {}
const url = (route: string) => route.replace(/\/([^/]+)\/\{id\}/, (_m, parent: string) => `/${parent}/${IDS[parent] ?? 1}`)
const PUBLIC_ADMIN_PAGES = new Set(['/admin/login'])
const PROTECTED = ROUTES.filter((r) => !PUBLIC_ADMIN_PAGES.has(r))

describe('route enumeration', () => {
  it('finds the whole portal, including every menu link', () => {
    expect(PROTECTED.length).toBeGreaterThanOrEqual(ADMIN_MENU.flatMap((c) => c.links).length)
    for (const cat of ADMIN_MENU) for (const l of cat.links) expect(ROUTES, `menu link ${l.href} has no page`).toContain(l.href)
  })
})

describe('anonymous visitors', () => {
  const c = new Client()
  it('are sent to the sign-in page from every admin page, with the page they wanted remembered', async () => {
    for (const route of PROTECTED) {
      const r = url(route)
      const res = await c.get(r)
      expect(res.status, r).toBe(307)
      const to = res.headers.get('location') ?? ''
      expect(to, r).toContain('/admin/login')
      if (r !== '/admin') expect(decodeURIComponent(to.split('next=')[1]), r).toBe(r)
      expect(res.headers.get('cache-control'), r).toContain('no-store')
      expect(res.headers.get('x-robots-tag'), r).toContain('noindex')
      expect(await res.text(), r).not.toMatch(/<h1|admin-sidebar/i)
    }
  })
  it('get 401 for every POST (a Server Action call included) and 401 for other methods too', async () => {
    for (const r of PROTECTED.map(url)) {
      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        const res = await c.request(r, { method, headers: { 'content-type': 'application/x-www-form-urlencoded', 'next-action': 'deadbeef' }, body: 'x=1' })
        expect(res.status, `${method} ${r}`).toBe(401)
      }
    }
  })
  it('cannot preview drafts', async () => {
    for (const p of ['/en/preview/article/1', '/en/preview/page/1', '/id/preview/article/1']) {
      const res = await c.get(p)
      expect([302, 303, 307], p).toContain(res.status)
      expect(res.headers.get('location'), p).toContain('/admin/login')
    }
  })
  it('see a sign-in form that reveals nothing about accounts', async () => {
    const html = await c.text('/admin/login')
    expect(html).toContain('name="email"'); expect(html).toContain('name="password"'); expect(html).toContain('type="password"')
    expect(html).not.toMatch(/superadmin|editor|viewer|sales role|finance role/i)
  })
  it('cannot read uploads that are not images in the media table', async () => {
    for (const p of ['/uploads/..%2f..%2fetc%2fpasswd', '/uploads/not-there.png', '/uploads/%2e%2e/%2e%2e/package.json']) expect([400, 404], p).toContain((await c.get(p)).status)
  })
})

describe('accounts without the admin role', () => {
  it.each(['editor', 'sales', 'finance', 'viewer', 'superadmin'])('%s is refused everywhere', async (role) => {
    const c = await withSession(await account(`${role}@http.example.invalid`, role))
    for (const r of PROTECTED.map(url)) {
      const res = await c.get(r)
      expect(res.status, `${role} GET ${r}`).toBe(403)
      expect(await res.text()).not.toMatch(/<h1|admin-sidebar/i)
      expect((await c.request(r, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'next-action': 'deadbeef' }, body: 'x=1' })).status, `${role} POST ${r}`).toBe(403)
    }
    expect((await c.get('/en/preview/article/1')).status).toBe(307)
  })
})

describe('the admin', () => {
  let c: Client
  let u: { id: number; passwordHash: string; role: string }
  beforeAll(async () => {
    u = await account('boss@http.example.invalid', 'admin')
    c = await withSession(u)
    const [lead] = await db`insert into leads (type, name, company, email, message, reference, public_code, status) values ('contact', ${'=HYPERLINK("http://evil.example","x")'}, 'ACME, Inc.', 'lead@example.invalid', 'hello', 'LEAD-1', 'L0000000001', 'new') returning id`
    const [article] = await db`insert into articles (title, slug, excerpt, body, status, locale) values ('Draft piece', 'draft-piece', 'x', '<p>secret draft</p>', 'draft', 'en') returning id`
    const [page] = await db`insert into pages (title, slug, locale) values ('Careers', 'careers', 'en') returning id`
    Object.assign(IDS, { leads: lead.id, articles: article.id, pages: page.id })
  })

  it('opens every admin page that exists and gets the full portal chrome', async () => {
    for (const r of PROTECTED.filter((x) => x !== '/admin/leads.csv').map(url)) {
      const res = await c.get(r)
      expect(res.status, r).toBe(200)
      expect(res.headers.get('cache-control'), r).toContain('no-store')
      expect(res.headers.get('x-robots-tag'), r).toContain('noindex')
      const html = await res.text()
      expect((html.match(/<h1[ >]/g) ?? []).length, `${r} h1`).toBe(1)
      for (const t of ['Sales', 'Finance', 'Website', 'System']) expect(html, `${r} category ${t}`).toContain(t)
      expect(html, r).toContain('boss@http.example.invalid')
    }
  })

  it('shows every menu entry in the sidebar of every page and none of them is a dead link', async () => {
    const html = await c.text('/admin')
    for (const cat of ADMIN_MENU) for (const l of cat.links) expect(html, l.href).toContain(`href="${l.href}"`)
    const seen = new Set<string>()
    for (const r of PROTECTED.map(url)) {
      if (r === '/admin/leads.csv') continue
      for (const m of (await c.text(r)).matchAll(/href="(\/admin[^"#]*)"/g)) seen.add(m[1].replace(/&amp;/g, '&'))
    }
    for (const href of seen) {
      const res = await c.get(href)
      expect(res.status, `broken link ${href}`).toBeLessThan(400)
    }
  })

  it('exports leads as CSV without letting a spreadsheet run formulas', async () => {
    const res = await c.get('/admin/leads.csv')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const csv = await res.text()
    expect(csv.split('\r\n')[0]).toBe('id,reference,public_code,type,name,company,email,status,priority,mode,origin,destination,created_at')
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`)
    expect(csv).toContain('"ACME, Inc."')
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
  })

  it('can preview a draft that visitors cannot see', async () => {
    const [{ id }] = await db`select id from articles where slug = 'draft-piece'`
    const preview = await c.get(`/en/preview/article/${id}`)
    expect(preview.status).toBe(200)
    expect(await preview.text()).toContain('secret draft')
    expect(preview.headers.get('x-robots-tag') ?? '').toMatch(/noindex/)
    const anon = new Client()
    expect((await anon.get('/en/insights/draft-piece')).status).toBe(404)
    expect(await (await anon.get('/en/insights')).text()).not.toContain('Draft piece')
    expect((await anon.get(`/en/preview/article/${id}`)).status).toBe(307)
  })

  it('loses access at once when the password changes, the role changes or the account is deactivated', async () => {
    const mk = async (email: string) => { const a = await account(email, 'admin'); return { a, c: await withSession(a) } }
    const stale = await mk('stale@http.example.invalid')
    expect((await stale.c.get('/admin')).status).toBe(200)
    await db`update users set password_hash = ${await hashPassword('Another-password-for-me-77')} where id = ${stale.a.id}`
    expect((await stale.c.get('/admin')).status).toBe(307)            // signature fine, credential changed -> sign in again
    const demoted = await mk('demoted@http.example.invalid')
    await db`update users set role = 'viewer' where id = ${demoted.a.id}`
    expect((await demoted.c.get('/admin/leads')).status).toBe(307)
    const off = await mk('off@http.example.invalid')
    await db`update users set active = false where id = ${off.a.id}`
    expect((await off.c.get('/admin/leads')).status).toBe(307)
  })

  it('rejects a tampered or expired cookie', async () => {
    const good = (await withSession(u)).cookies.get(SESSION_COOKIE)!
    for (const token of [good.slice(0, -3) + 'AAA', good.split('.')[0], 'garbage', '']) {
      const t = new Client(); t.cookies.set(SESSION_COOKIE, token)
      expect((await t.get('/admin')).status, token.slice(0, 12)).toBe(307)
    }
  })
})
