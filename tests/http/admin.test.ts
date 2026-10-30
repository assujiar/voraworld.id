import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_MENU } from '@/content/admin-menu'
import { Client } from './client'
import { account as makeAccount, browserFor, clientWith, type Account } from './accounts'
import { forgedSessions, revokeSession, signInCookies } from '../helpers/auth'
import { seedFinance } from './fixtures'

/** The real production server, real cookies, every admin URL: who gets in, and what each page contains. */
const db = postgres(process.env.HTTP_DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(async () => { await db.end({ timeout: 5 }) })

const account = (email: string, role: string) => makeAccount(db, email, role)
const withSession = (u: Account) => browserFor(u)

/** URL of every page and route handler under src/app/(admin)/admin, with dynamic segments filled in. */
function adminRoutes(): Array<{ path: string; kind: 'page' | 'route' }> {
  const root = join(process.cwd(), 'src/app/(admin)/admin')
  const out: Array<{ path: string; kind: 'page' | 'route' }> = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (!/^(page\.tsx|route\.ts)$/.test(name)) continue
      const segs = relative(root, dir).split('/').filter((s) => s && !/^\(.*\)$/.test(s)).map((s) => (s.startsWith('[') ? '{id}' : s))
      out.push({ path: '/admin' + (segs.length ? '/' + segs.join('/') : ''), kind: name === 'page.tsx' ? 'page' : 'route' })
    }
  }
  walk(root)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}
const ALL = adminRoutes()
const ROUTES = ALL.map((r) => r.path)
/** Routes that answer with a file (PDF, CSV), not a page. */
const FILES = new Set(ALL.filter((r) => r.kind === 'route').map((r) => r.path))
/** Ids of fixture rows by collection, so `/admin/articles/{id}` can be opened for real. */
const IDS: Record<string, number> = {}
const url = (route: string) => route.replace(/\/([^/]+)\/\{id\}/, (_m, parent: string) => `/${parent}/${IDS[parent] ?? 1}`)
/** Open to visitors who are not signed in: the sign-in and password-reset request pages, and the landing of the emailed reset link. */
/** Signed-in pages that are a single focused form, like the sign-in page: no sidebar. */
const STANDALONE = new Set(['/admin/reset-password'])
const PUBLIC_ADMIN_PAGES = new Set(['/admin/login', '/admin/forgot-password', '/admin/auth/callback'])
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
    for (const route of PROTECTED) {
      const r = url(route)
      // A page sends the account back to the sign-in page with a message; a file (PDF, CSV) answers 403. Neither shows the portal.
      const res = await c.get(r)
      if (FILES.has(route)) expect(res.status, `${role} GET ${r}`).toBe(403)
      else {
        expect(res.status, `${role} GET ${r}`).toBe(307)
        expect(res.headers.get('location'), `${role} GET ${r}`).toMatch(/\/admin\/login\?error=.*admin%20access/)
      }
      expect(await res.text()).not.toMatch(/<h1|admin-sidebar/i)
      // A Server Action call never reaches an action it does not know, and the guard of every real one is proven in tests/action-guards.test.ts.
      const post = await c.request(r, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'next-action': 'deadbeef' }, body: 'x=1' })
      expect(post.status, `${role} POST ${r}`).toBeGreaterThanOrEqual(400)
      expect(await post.text()).not.toMatch(/admin-sidebar/i)
    }
    expect((await c.get('/en/preview/article/1')).status).toBe(307)
  })
})

describe('the admin', () => {
  let c: Client
  let u: Account
  beforeAll(async () => {
    u = await account('boss@http.example.invalid', 'admin')
    c = await withSession(u)
    const [lead] = await db`insert into leads (type, name, company, email, message, reference, public_code, status) values ('contact', ${'=HYPERLINK("http://evil.example","x")'}, 'ACME, Inc.', 'lead@example.invalid', 'hello', 'LEAD-1', 'L0000000001', 'new') returning id`
    const [article] = await db`insert into articles (title, slug, excerpt, body, status, locale) values ('Draft piece', 'draft-piece', 'x', '<p>secret draft</p>', 'draft', 'en') returning id`
    const [page] = await db`insert into pages (title, slug, locale) values ('Careers', 'careers', 'en') returning id`
    Object.assign(IDS, { leads: lead.id, articles: article.id, pages: page.id }, (await seedFinance()).ids)
  })

  it('opens the password-change page, which has no portal chrome, only for a signed-in administrator', async () => {
    const html = await c.text('/admin/reset-password')
    expect(html).toContain('Choose a new password'); expect(html).toContain('name="password"'); expect(html).toContain('name="confirm"')
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1)
    expect((await new Client().get('/admin/reset-password')).status).toBe(307)
  })

  it('opens every admin page that exists and gets the full portal chrome', async () => {
    for (const r of PROTECTED.filter((x) => !FILES.has(x) && !STANDALONE.has(x)).map(url)) {
      const res = await c.get(r)
      expect(res.status, r).toBe(200)
      expect(res.headers.get('cache-control'), r).toContain('no-store')
      expect(res.headers.get('x-robots-tag'), r).toContain('noindex')
      const html = await res.text()
      expect((html.match(/<h1[ >]/g) ?? []).length, `${r} h1`).toBe(1)
      for (const t of ['Sales', 'Finance', 'Documents', 'Website', 'System']) expect(html, `${r} category ${t}`).toContain(t)
      expect(html, r).toContain('boss@http.example.invalid')
    }
  })

  it('offers the company NPWP (seeded with the registered number) and the default quotation terms in the site settings', async () => {
    const html = await c.text('/admin/settings')
    expect(html).toContain('NPWP (tax ID), printed on documents'); expect(html).toContain('1000 0000 1178 2812')
    expect(html).toContain('Quotations: default terms of payment'); expect(html).toContain('Quotations: default terms and conditions')
  })

  it('starts a new quotation from the default terms in the site settings, and requires both', async () => {
    await db`insert into settings (key, value) values ('quotation_payment_terms', 'DEFAULT-PAYMENT-TERMS'), ('quotation_terms', E'1. DEFAULT clause one\n2. DEFAULT clause two') on conflict (key) do update set value = excluded.value`
    try {
      const html = await c.text('/admin/quotations/new')
      expect(html).toContain('DEFAULT-PAYMENT-TERMS'); expect(html).toContain('1. DEFAULT clause one'); expect(html).toContain('2. DEFAULT clause two')
      expect(html).toMatch(/name="payment_terms"[^>]*required/); expect(html).toMatch(/name="terms_conditions"[^>]*required/)
    } finally {
      await db`delete from settings where key in ('quotation_payment_terms', 'quotation_terms')`
    }
    const blank = await c.text('/admin/quotations/new')
    expect(blank).not.toContain('DEFAULT-PAYMENT-TERMS')
  })

  it('shows every menu entry in the sidebar of every page and none of them is a dead link', async () => {
    const html = await c.text('/admin')
    for (const cat of ADMIN_MENU) for (const l of cat.links) expect(html, l.href).toContain(`href="${l.href}"`)
    const seen = new Set<string>()
    for (const r of PROTECTED.filter((x) => !FILES.has(x)).map(url)) {
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

  it('loses access at once when the session is ended, the role changes or the account is deactivated', async () => {
    const mk = async (email: string) => { const a = await account(email, 'admin'); const session = await signInCookies(a.email, a.password); return { a, session, c: clientWith(session) } }
    const out = await mk('stale@http.example.invalid')
    expect((await out.c.get('/admin')).status).toBe(200)
    await revokeSession(out.session)
    expect((await out.c.get('/admin')).status).toBe(307)              // Supabase Auth no longer knows the session -> sign in again
    const demoted = await mk('demoted@http.example.invalid')
    await db`update users set role = 'viewer' where id = ${demoted.a.id}`
    expect((await demoted.c.get('/admin/leads')).status).toBe(307)           // still signed in to Supabase, but no longer an administrator
    expect((await demoted.c.get('/admin/leads.csv')).status).toBe(403)
    const off = await mk('off@http.example.invalid')
    await db`update users set active = false where id = ${off.a.id}`
    expect((await off.c.get('/admin/leads')).status).toBe(307)
    expect((await off.c.get('/admin/leads')).headers.get('location')).toContain('/admin/login')
  })

  it('answers 404, never a server error, for ids that are not real record numbers', async () => {
    const bad = ['99999999999999999999', '2147483648', '-1', '0', '1e3', 'abc', '%00', '1.5']
    for (const section of ['leads', 'articles', 'pages', 'customers', 'quotations', 'invoices', 'receipts', 'prepayment-receipts', 'documents']) {
      for (const id of bad) expect((await c.get(`/admin/${section}/${id}`)).status, `/admin/${section}/${id}`).toBe(404)
    }
    for (const p of ['/admin/invoices/99999999999/pdf', '/admin/quotations/-5/pdf', '/admin/receipts/abc/pdf', '/admin/prepayment-receipts/abc/pdf', '/admin/documents/abc/pdf', '/admin/documents/-3/edit', '/admin/prepayment-receipts/99999999999/pdf', '/admin/quotation-approvals/99999999999/file', '/en/preview/article/99999999999', '/id/preview/page/abc'])
      expect((await c.get(p)).status, p).toBe(404)
  })

  it('rejects a forged or tampered session cookie', async () => {
    const real = await signInCookies(u.email, u.password)
    expect((await clientWith(real).get('/admin')).status).toBe(200)
    for (const [kind, session] of Object.entries(forgedSessions(real))) expect((await clientWith(session).get('/admin')).status, kind).toBe(307)
    for (const raw of ['', 'garbage', 'sb-127-auth-token=x']) {
      const t = new Client()
      if (raw) t.cookies.set(raw.includes('=') ? raw.split('=')[0] : 'sb-127-auth-token', raw.includes('=') ? raw.split('=')[1] : raw)
      expect((await t.get('/admin')).status, raw).toBe(307)
    }
  })
})
