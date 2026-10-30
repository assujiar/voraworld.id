import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from './helpers/db'
import { login, logout } from '@/actions/auth'
import { addFaqAction, addNavigationAction, addSectionAction, deleteNavigationAction, restoreArticleAction, restorePageAction, saveArticleAction, savePageAction, saveSectionAction, updateFaqAction, uploadMediaAction } from '@/actions/content'
import { replyLeadAction, updateLeadAction } from '@/actions/crm'
import { addCoverageAction, addRedirectAction, dispatchMailAction, retryMailJobAction, saveMailConfigAction, saveMailTemplateAction, saveSettingsAction, setMailRuleAction, testMailAction, toggleCoverageAction } from '@/actions/settings'
import { act, createUser, hasSessionCookie, provision, q, sessionFor } from './helpers/actions'
import { setSender } from '@/server/mail/transport'
import { saveMailConfig } from '@/server/mail/config'
import { EVENTS } from '@/server/mail/events'

process.env.MAIL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64')
process.env.VORA_LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'vora-media-'))
let admin: string

// A real 1x1 PNG (valid CRCs) and corrupted copies.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
const pngFile = (bytes: Uint8Array = PNG, name = 'pic.png') => new File([bytes as BlobPart], name, { type: 'image/png' })

beforeAll(async () => { admin = await sessionFor(await createUser('admin@content.invalid', 'admin')) })

describe('sign-in and sign-out', () => {
  it('sets the session cookie and lands on the dashboard or the page the user asked for', async () => {
    const u = await createUser('login-action@invalid.example', 'admin', 'Correct-horse-battery-9')
    await provision(u)
    const r = await act(login, { email: u.email, password: 'Correct-horse-battery-9' }, { headers: { 'x-real-ip': '10.9.0.1' } })
    expect(r.redirect).toBe('/admin')
    expect(hasSessionCookie()).toBe(true)
    const r2 = await act(login, { email: u.email, password: 'Correct-horse-battery-9', next: '/admin/invoices?x=1' }, { headers: { 'x-real-ip': '10.9.0.1' } })
    expect(r2.redirect).toBe('/admin/invoices?x=1')
  })
  it('never redirects to another site after sign-in', async () => {
    const u = await createUser('open-redirect@invalid.example', 'admin', 'Correct-horse-battery-9')
    await provision(u)
    for (const next of ['https://evil.example', '//evil.example', '/\\evil', '/admin/../../evil', 'javascript:alert(1)', '/admin@evil.example']) {
      const r = await act(login, { email: u.email, password: 'Correct-horse-battery-9', next }, { headers: { 'x-real-ip': '10.9.0.2' } })
      expect(r.redirect === '/admin' || r.redirect?.startsWith('/admin') && !r.redirect.includes('//'), `${next} -> ${r.redirect}`).toBe(true)
      expect(r.redirect).not.toMatch(/evil|javascript/)
    }
  })
  it('shows one generic message for wrong password and unknown account, and locks out after repeated failures', async () => {
    const u = await createUser('lockout-action@invalid.example', 'admin', 'Correct-horse-battery-9')
    await provision(u)
    const a = await act(login, { email: u.email, password: 'wrong' }, { headers: { 'x-real-ip': '10.9.0.3' } })
    const b = await act(login, { email: 'ghost@invalid.example', password: 'wrong' }, { headers: { 'x-real-ip': '10.9.0.3' } })
    expect(q(a.redirect).get('error')).toBe('Invalid login details')
    expect(q(b.redirect).get('error')).toBe('Invalid login details')
    for (let i = 0; i < 4; i++) await act(login, { email: u.email, password: 'wrong' }, { headers: { 'x-real-ip': `10.9.1.${i}` } })
    const locked = await act(login, { email: u.email, password: 'Correct-horse-battery-9' }, { headers: { 'x-real-ip': '10.9.2.1' } })
    expect(q(locked.redirect).get('error')).toBe('Too many failed attempts. Try again later.')
    expect(hasSessionCookie()).toBe(false)
  })
  it('signs out by clearing the cookie', async () => {
    const mine = await sessionFor(await createUser('logout-action@invalid.example', 'admin'))
    const other = await sessionFor(await createUser('logout-action@invalid.example', 'admin'))   // a second browser of the same account
    const r = await act(logout, {}, { as: mine })
    expect(r.redirect).toBe('/admin/login')
    expect(hasSessionCookie()).toBe(false)
    expect((await act(saveSettingsAction, {}, { as: mine })).redirect, 'the signed-out session is dead').toBe('/admin/login')
    expect((await act(saveSettingsAction, {}, { as: other })).redirect, 'the other browser stays signed in').not.toBe('/admin/login')
  })
})

describe('articles', () => {
  const base = { title: 'Port congestion update', slug: '', excerpt: 'Short', body: '<p>Hello <b>world</b></p><script>alert(1)</script>', category: 'News', tags: 'a,b', locale: 'en', author: 'Ana', seo_title: '', seo_description: '', _back: '/admin/articles/new' }
  it('starts as a draft, sanitises HTML, derives the slug, and audits', async () => {
    const r = await act(saveArticleAction, base, { as: admin })
    expect(r.redirect).toMatch(/^\/admin\/articles\/\d+\?notice=/)
    const [a] = await sql`select * from articles where title = 'Port congestion update'`
    expect(a).toMatchObject({ status: 'draft', slug: 'port-congestion-update', locale: 'en', publishedAt: null })
    expect(a.body).toBe('<p>Hello <b>world</b></p>')
    expect((await sql`select count(*)::int as n from audit_logs where object_type = 'article' and object_id = ${a.id}`)[0].n).toBe(1)
  })
  it('publishes, unpublishes, keeps a revision per edit and can restore one', async () => {
    const [{ id }] = await sql`select id from articles where title = 'Port congestion update'`
    await act(saveArticleAction, { ...base, record: String(id), body: '<p>Second version</p>', action: 'publish' }, { as: admin })
    let [a] = await sql`select * from articles where id = ${id}`
    expect(a).toMatchObject({ status: 'published', body: '<p>Second version</p>' }); expect(a.publishedAt).toBeInstanceOf(Date)
    await act(saveArticleAction, { ...base, record: String(id), body: '<p>Third version</p>', action: 'unpublish' }, { as: admin })
    ;[a] = await sql`select * from articles where id = ${id}`
    expect(a.status).toBe('draft')
    const revs = await sql`select id, snapshot from revisions where resource = 'article' and resource_id = ${id} order by id`
    expect(revs).toHaveLength(2)
    expect(await act(restoreArticleAction, { record: String(id), revision: String(revs[0].id) }, { as: admin })).toMatchObject({ redirect: expect.stringContaining('Revision%20restored') })
    ;[a] = await sql`select * from articles where id = ${id}`
    expect(a.body).toBe('<p>Hello <b>world</b></p>')
    expect(await sql`select id from revisions where resource_id = ${id}`).toHaveLength(3)
  })
  it('rejects duplicate slugs, missing titles and unknown articles with a message', async () => {
    expect(q((await act(saveArticleAction, { ...base, title: 'Other', slug: 'port-congestion-update' }, { as: admin })).redirect).get('error')).toBe('Article slug already in use')
    expect(q((await act(saveArticleAction, { ...base, title: '' }, { as: admin })).redirect).get('error')).toBe('Article title and slug required')
    expect(q((await act(saveArticleAction, { ...base, record: '999999' }, { as: admin })).redirect).get('error')).toBe('Article not found')
    expect(await sql`select id from articles where title = 'Other'`).toHaveLength(0)
  })
  it('only accepts known locales', async () => {
    await act(saveArticleAction, { ...base, title: 'Locale check', locale: 'fr' }, { as: admin })
    expect((await sql`select locale from articles where title = 'Locale check'`)[0].locale).toBe('en')
  })
})

describe('pages and sections', () => {
  let pageId: number
  const page = { title: 'Careers', slug: '', locale: 'en', description: 'Join us', seo_title: '', _back: '/admin/pages/new' }
  it('creates a draft page that visitors cannot see until it is published', async () => {
    await act(savePageAction, page, { as: admin })
    ;[{ id: pageId }] = (await sql`select id from pages where slug = 'careers'`) as unknown as [{ id: number }]
    const [p] = await sql`select status, published_snapshot from pages where id = ${pageId}`
    expect(p).toMatchObject({ status: 'draft', publishedSnapshot: null })
  })
  it('adds, edits, reorders and deletes sections, then publishes a frozen snapshot', async () => {
    await act(addSectionAction, { record: String(pageId) }, { as: admin })
    await act(addSectionAction, { record: String(pageId) }, { as: admin })
    let secs = await sql`select id, position from sections where page_id = ${pageId} order by position, id`
    expect(secs).toHaveLength(2)
    const [first, second] = secs.map((s) => s.id as number)
    const edit = { record: String(first), title: 'We are hiring', body: 'Roles open', kind: 'hero', layout: 'stack', surface: 'ink', visible: '1', button_label: 'Apply', button_href: '/en/contact', image: '/static/assets/vora-visual-59.webp' }
    await act(saveSectionAction, edit, { as: admin })
    expect((await sql`select * from sections where id = ${first}`)[0]).toMatchObject({ title: 'We are hiring', kind: 'hero', layout: 'stack', surface: 'ink', visible: true })
    await act(saveSectionAction, { ...edit, record: String(second), title: 'Second', kind: 'nonsense', layout: 'weird', surface: 'purple' }, { as: admin })
    expect((await sql`select kind, layout, surface from sections where id = ${second}`)[0]).toEqual({ kind: 'editorial', layout: 'split', surface: 'paper' })
    await act(saveSectionAction, { record: String(second), move: 'up' }, { as: admin })
    secs = await sql`select id from sections where page_id = ${pageId} order by position, id`
    expect(secs.map((s) => s.id)).toEqual([second, first])
    // drafts are invisible: nothing published yet
    expect((await sql`select published_snapshot from pages where id = ${pageId}`)[0].publishedSnapshot).toBeNull()
    await act(savePageAction, { ...page, record: String(pageId), action: 'publish' }, { as: admin })
    const [p] = await sql`select status, published_snapshot from pages where id = ${pageId}`
    expect(p.status).toBe('published')
    const snap = p.publishedSnapshot as { sections: Array<{ title: string; button_href: string }> }
    expect(snap.sections.map((s) => s.title)).toEqual(['Second', 'We are hiring'])
    // later draft edits do not leak into the published snapshot
    await act(saveSectionAction, { ...edit, title: 'Changed after publishing' }, { as: admin })
    expect(((await sql`select published_snapshot from pages where id = ${pageId}`)[0].publishedSnapshot as typeof snap).sections[1].title).toBe('We are hiring')
    await act(saveSectionAction, { record: String(second), delete: '1' }, { as: admin })
    expect(await sql`select id from sections where page_id = ${pageId}`).toHaveLength(1)
  })
  it('keeps a revision on each publish and can restore the previous one', async () => {
    await act(savePageAction, { ...page, record: String(pageId), action: 'publish' }, { as: admin })
    const revs = await sql`select id from revisions where resource = 'page' and resource_id = ${pageId} order by id`
    expect(revs.length).toBe(2)
    const r = await act(restorePageAction, { record: String(pageId), revision: String(revs[1].id) }, { as: admin })
    expect(r.redirect).toContain('restored')
    const empty = await sql`insert into revisions (resource, resource_id, snapshot) values ('page', ${pageId}, '{}'::json) returning id`
    expect(q((await act(restorePageAction, { record: String(pageId), revision: String(empty[0].id) }, { as: admin })).redirect).get('error')).toBe('Previous revision is empty')
  })
  it('refuses unsafe images, reserved slugs and duplicate slugs', async () => {
    const [{ id: sid }] = await sql`select id from sections where page_id = ${pageId} limit 1`
    for (const image of ['javascript:alert(1)', 'http://insecure.example/x.png', '//evil.example/x.png', 'data:image/png;base64,AA']) {
      expect(q((await act(saveSectionAction, { record: String(sid), title: 'x', image }, { as: admin })).redirect).get('error'), image).toBe('Invalid image source')
    }
    for (const slug of ['admin', 'preview', 'static', 'verify']) expect(q((await act(savePageAction, { ...page, title: 'Reserved', slug }, { as: admin })).redirect).get('error'), slug).toBe('That slug is reserved')
    expect(q((await act(savePageAction, { ...page, title: 'Careers again', slug: 'careers' }, { as: admin })).redirect).get('error')).toBe('Page slug already exists')
  })
})

describe('leads', () => {
  it('updates the pipeline, validates the status and appends notes to the timeline', async () => {
    const [{ id }] = await sql`insert into leads (name, email) values ('Lead One', 'one@x.invalid') returning id`
    const f = { record: String(id), status: 'qualified', priority: 'urgent', assignee: 'Rina', followup: '2026-12-01', note: 'Called the customer' }
    expect((await act(updateLeadAction, f, { as: admin })).redirect).toBe(`/admin/leads/${id}?notice=Lead%20updated`)
    expect((await sql`select * from leads where id = ${id}`)[0]).toMatchObject({ status: 'qualified', priority: 'urgent', assignee: 'Rina', followup: '2026-12-01' })
    expect((await sql`select message from lead_activities where lead_id = ${id}`).map((r) => r.message)).toEqual(['Called the customer'])
    expect(q((await act(updateLeadAction, { ...f, status: 'bogus', _back: `/admin/leads/${id}` }, { as: admin })).redirect).get('error')).toBe('Invalid lead status')
    await act(updateLeadAction, { ...f, priority: 'nonsense', note: '' }, { as: admin })
    expect((await sql`select priority from leads where id = ${id}`)[0].priority).toBe('normal')
    expect(await sql`select id from lead_activities where lead_id = ${id}`).toHaveLength(1)
    expect(q((await act(updateLeadAction, { ...f, record: '999999' }, { as: admin })).redirect).get('error')).toBe('Lead not found')
  })
})

describe('small resources', () => {
  it('FAQs: add, update, delete', async () => {
    await act(addFaqAction, { question: 'How long?', answer: 'Two days' }, { as: admin })
    const [{ id }] = await sql`select id from faqs where question = 'How long?'`
    await act(updateFaqAction, { record: String(id), question: 'How long now?', answer: 'Three days' }, { as: admin })
    expect((await sql`select question, answer from faqs where id = ${id}`)[0]).toEqual({ question: 'How long now?', answer: 'Three days' })
    expect(q((await act(addFaqAction, { question: '', answer: 'x' }, { as: admin })).redirect).get('error')).toBe('Question and answer are required')
    await act(updateFaqAction, { record: String(id), delete: '1' }, { as: admin })
    expect(await sql`select id from faqs where id = ${id}`).toHaveLength(0)
  })
  it('navigation: accepts local paths only and never an admin route', async () => {
    expect((await act(addNavigationAction, { label: 'Careers', href: '/en/careers', position: '10' }, { as: admin })).redirect).toContain('saved')
    for (const href of ['/admin', '/en/admin/leads', '/ID/admin', '//evil.example', 'https://evil.example', '/x\\y', 'relative']) {
      expect(q((await act(addNavigationAction, { label: 'Bad', href, _back: '/admin/navigation' }, { as: admin })).redirect).get('error'), href).toMatch(/Invalid relative path|Internal admin routes/)
    }
    expect(q((await act(addNavigationAction, { label: '', href: '/x' }, { as: admin })).redirect).get('error')).toBe('A label is required')
    const [{ id }] = await sql`select id from navigation_items where label = 'Careers'`
    await act(deleteNavigationAction, { record: String(id) }, { as: admin })
    expect(await sql`select id from navigation_items`).toHaveLength(0)
  })
  it('coverage: publishing sets and clears the verification time', async () => {
    await act(addCoverageAction, { region: 'Jakarta - Singapore', mode: 'Sea' }, { as: admin })
    const [{ id }] = await sql`select id from coverage where region = 'Jakarta - Singapore'`
    expect((await sql`select active, verified_at from coverage where id = ${id}`)[0]).toMatchObject({ active: false, verifiedAt: null })
    await act(toggleCoverageAction, { record: String(id) }, { as: admin })
    expect((await sql`select active, verified_at from coverage where id = ${id}`)[0].verifiedAt).toBeInstanceOf(Date)
    await act(toggleCoverageAction, { record: String(id) }, { as: admin })
    expect((await sql`select active, verified_at from coverage where id = ${id}`)[0]).toMatchObject({ active: false, verifiedAt: null })
  })
  it('redirects: relative paths only, no loops, no duplicates', async () => {
    expect((await act(addRedirectAction, { old_path: '/en/old', new_path: '/en/new' }, { as: admin })).redirect).toContain('Redirect%20created')
    expect(q((await act(addRedirectAction, { old_path: '/en/old', new_path: '/en/other' }, { as: admin })).redirect).get('error')).toBe('Redirect already defined')
    expect(q((await act(addRedirectAction, { old_path: '/a', new_path: '/a' }, { as: admin })).redirect).get('error')).toBe('Redirect loop')
    expect(q((await act(addRedirectAction, { old_path: '/a', new_path: 'https://evil.example' }, { as: admin })).redirect).get('error')).toBe('Invalid relative path')
  })
  it('settings: saves every editable field and trims', async () => {
    await act(saveSettingsAction, { email: '  sales@voraworld.id ', legal_name: 'PT Satu Arah International', privacy: '<p>Privacy</p>' }, { as: admin })
    const s = Object.fromEntries((await sql`select key, value from settings`).map((r) => [r.key, r.value]))
    expect(s).toMatchObject({ email: 'sales@voraworld.id', legal_name: 'PT Satu Arah International', privacy: '<p>Privacy</p>' })
  })
})

describe('media library', () => {
  const run = (file: File | null, alt = 'A picture') => act(uploadMediaAction, { ...(file ? { image: file } : {}), alt, _back: '/admin/media' }, { as: admin })
  it('stores a valid image with a random name and records it', async () => {
    const r = await run(pngFile())
    expect(r.redirect).toContain('Image%20uploaded')
    const [m] = await sql`select * from media`
    expect(m).toMatchObject({ filename: 'pic.png', mime: 'image/png', alt: 'A picture', size: PNG.length })
    expect(m.storageKey).toMatch(/^[0-9a-f]{36}\.png$/)
    expect(m.url).toBe(`/uploads/${m.storageKey}`)
    expect(existsSync(join(process.env.VORA_LOCAL_STORAGE_DIR!, 'media', m.storageKey as string))).toBe(true)
  })
  it('rejects non-images, corrupt images, oversize files, missing alt text and missing files', async () => {
    const bad = (bytes: Uint8Array, name: string) => run(pngFile(bytes, name))
    expect(q((await bad(new TextEncoder().encode('<script>alert(1)</script>'.padEnd(64)), 'x.png')).redirect).get('error')).toMatch(/PNG, JPEG, WEBP and AVIF/)
    const corrupt = PNG.slice(); corrupt[20] ^= 0xff
    expect(q((await bad(corrupt, 'corrupt.png')).redirect).get('error')).toMatch(/PNG, JPEG, WEBP and AVIF/)
    expect(q((await bad(new Uint8Array(7_100_000), 'big.png')).redirect).get('error')).toBe('File exceeds 7 MB limit')
    expect(q((await run(pngFile(), '')).redirect).get('error')).toBe('Alt text required')
    expect(q((await run(null)).redirect).get('error')).toBe('Choose an image to upload')
    expect(await sql`select id from media`).toHaveLength(1)
    expect(readdirSync(join(process.env.VORA_LOCAL_STORAGE_DIR!, 'media'))).toHaveLength(1)
  })
  it('names the file by its real content, not the claimed extension', async () => {
    await run(pngFile(PNG, '../../etc/passwd.jpg'))
    const [m] = await sql`select filename, storage_key, mime from media order by id desc limit 1`
    expect(m.filename).toBe('passwd.jpg')
    expect(m.storageKey).toMatch(/\.png$/); expect(m.mime).toBe('image/png')
    expect(readFileSync(join(process.env.VORA_LOCAL_STORAGE_DIR!, 'media', m.storageKey as string)).length).toBe(PNG.length)
  })
})

describe('SMTP administration', () => {
  beforeEach(() => setSender(null))
  const cfg = { host: 'smtp.example.invalid', port: '587', security: 'starttls', from_email: 'info@voraworld.id', admin_email: 'ops@example.invalid', enabled: '1', _back: '/admin/mail' }
  it('saves settings (password encrypted), reports validation errors', async () => {
    expect((await act(saveMailConfigAction, { ...cfg, username: 'u', password: 'secret' }, { as: admin })).redirect).toContain('SMTP%20configuration%20saved')
    const [c] = await sql`select * from mail_config`
    expect(c).toMatchObject({ host: 'smtp.example.invalid', enabled: true }); expect(c.encryptedPassword).not.toContain('secret')
    expect(q((await act(saveMailConfigAction, { ...cfg, host: 'bad host' }, { as: admin })).redirect).get('error')).toBe('Invalid SMTP hostname')
  })
  it('toggles rules and edits templates with sanitising', async () => {
    await act(setMailRuleAction, { key: 'lead_reply', enabled: '1' }, { as: admin })
    expect((await sql`select enabled from email_rules where key = 'lead_reply'`)[0].enabled).toBe(true)
    expect(q((await act(setMailRuleAction, { key: 'nope', enabled: '1' }, { as: admin })).redirect).get('error')).toBe('Not found')
    await act(saveMailTemplateAction, { key: 'lead_reply', subject: 'Hi\r\nBcc: x@y.z', html: '<p>Dear $name</p><script>x</script>' }, { as: admin })
    expect((await sql`select subject, html from email_templates where key = 'lead_reply'`)[0]).toEqual({ subject: 'Hi Bcc: x@y.z', html: '<p>Dear $name</p>' })
    expect(q((await act(saveMailTemplateAction, { key: 'lead_reply', subject: '', html: '' }, { as: admin })).redirect).get('error')).toBe('Subject and body required')
  })
  it('sends a test email, reports a failure with its reason, and processes the queue', async () => {
    const sent: string[] = []
    setSender(async (_c, to, subject) => { sent.push(`${to}|${subject}`) })
    expect((await act(testMailAction, {}, { as: admin })).redirect).toContain('Test%20email%20sent%20to%20ops%40example.invalid')
    expect(sent).toEqual(['ops@example.invalid|VORA SMTP test'])
    setSender(async () => { throw new Error('connection refused') })
    expect(decodeURIComponent(q((await act(testMailAction, {}, { as: admin })).redirect).get('notice')!)).toContain('SMTP test failed - Error: connection refused')
    await sql`insert into email_jobs (event, recipient, subject, html, status, attempts, error) values ('lead_reply', 'c@x.invalid', 'S', '<p>x</p>', 'failed', 5, 'boom')`
    const [{ id }] = await sql`select id from email_jobs`
    setSender(async (_c, to) => { sent.push(to) })
    const r = await act(retryMailJobAction, { record: String(id) }, { as: admin })
    expect(decodeURIComponent(r.redirect!)).toContain('Message re-queued: 1 sent, 0 failed')
    expect((await sql`select status from email_jobs where id = ${id}`)[0].status).toBe('sent')
    expect(q((await act(retryMailJobAction, { record: String(id) }, { as: admin })).redirect).get('error')).toBe('Only failed or waiting messages can be retried')
    expect(decodeURIComponent((await act(dispatchMailAction, {}, { as: admin })).redirect!)).toContain('Mail: 0 sent, 0 failed')
    await sql`update mail_config set enabled = false`
    expect(q((await act(testMailAction, {}, { as: admin })).redirect).get('error')).toBe('Save and enable the SMTP configuration first')
  })
})

describe('replying to a lead by email', () => {
  beforeEach(async () => { for (const [key, e] of Object.entries(EVENTS)) await sql`update email_templates set subject = ${e.subject}, html = ${e.html} where key = ${key}` })    // earlier tests edited some templates
  const settle = async () => { for (let i = 0; i < 100; i++) { if (!(await sql`select 1 from email_jobs where status in ('queued', 'sending')`).length) return; await new Promise((r) => setTimeout(r, 50)) } }
  let counter = 0
  const reference = () => `RFQ-VORA-L0000000001-202610-${String(++counter).padStart(5, '0')}`
  async function lead() {
    const [{ id }] = await sql`insert into leads (name, email, reference, status) values ('Rina Wijaya', 'rina@customer.invalid', ${reference()}, 'new') returning id`
    return id as number
  }
  it('is refused until SMTP and the lead_reply notification are on, and nothing is queued', async () => {
    await sql`truncate email_jobs, mail_config`; await sql`update email_rules set enabled = false`
    const id = await lead()
    expect(q((await act(replyLeadAction, { record: String(id), message: 'Hello', _back: `/admin/leads/${id}` }, { as: admin })).redirect).get('error')).toMatch(/Enable SMTP and the lead_reply email rule/)
    await saveMailConfig(sql, { host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
    expect(q((await act(replyLeadAction, { record: String(id), message: 'Hello', _back: '/x' }, { as: admin })).redirect).get('error')).toMatch(/lead_reply/)
    expect(await sql`select id from email_jobs`).toHaveLength(0)
  })
  it('queues the message with its line breaks, escapes markup, logs it on the timeline and marks a new lead as contacted', async () => {
    await sql`truncate email_jobs`; await sql`update email_rules set enabled = true where key = 'lead_reply'`
    const sent: Array<{ to: string; subject: string; html: string }> = []
    setSender(async (_c, to, subject, html) => { sent.push({ to, subject, html }) })
    const id = await lead()
    const r = await act(replyLeadAction, { record: String(id), message: 'Dear Rina,\nWe can ship <b>FCL</b> on Friday.\n<script>alert(1)</script>' }, { as: admin })
    expect(decodeURIComponent(r.redirect!)).toContain('Reply queued for sending')
    await settle()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'rina@customer.invalid', subject: expect.stringMatching(/^Regarding your VORA inquiry #RFQ-VORA-L0000000001-202610-0000\d$/) })
    expect(sent[0].html).toContain('Dear Rina,<br />We can ship &lt;b&gt;FCL&lt;/b&gt; on Friday.<br />&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(sent[0].html).not.toMatch(/<script|<b>/)
    expect((await sql`select status from leads where id = ${id}`)[0].status).toBe('contacted')
    expect((await sql`select message from lead_activities where lead_id = ${id}`)[0].message).toMatch(/^Replied by email: Dear Rina,/)
    expect((await sql`select verb from audit_logs where object_type = 'lead' and object_id = ${id} order by id desc limit 1`)[0].verb).toBe('reply')
    // the same text pressed twice within a minute is one email; a different text is another
    await act(replyLeadAction, { record: String(id), message: 'Second' }, { as: admin }); await act(replyLeadAction, { record: String(id), message: 'Second' }, { as: admin }); await settle()
    expect(sent).toHaveLength(2)
    await act(replyLeadAction, { record: String(id), message: 'Third, different' }, { as: admin }); await settle()
    expect(sent).toHaveLength(3)
  })
  it('keeps a lead that is already further along where it is, and refuses an empty reply, no address or an unknown lead', async () => {
    const id = await lead(); await sql`update leads set status = 'qualified' where id = ${id}`
    await act(replyLeadAction, { record: String(id), message: 'Quote attached' }, { as: admin })
    expect((await sql`select status from leads where id = ${id}`)[0].status).toBe('qualified')
    expect(q((await act(replyLeadAction, { record: String(id), message: '  ', _back: '/x' }, { as: admin })).redirect).get('error')).toBe('Write the reply first')
    const [{ id: bare }] = await sql`insert into leads (name, email) values ('No Mail', '') returning id`
    expect(q((await act(replyLeadAction, { record: String(bare), message: 'Hello', _back: '/x' }, { as: admin })).redirect).get('error')).toBe('This lead has no email address')
    expect(q((await act(replyLeadAction, { record: '999999', message: 'Hello', _back: '/x' }, { as: admin })).redirect).get('error')).toBe('Lead not found')
  })
})
