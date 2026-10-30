import { expect, test } from '@playwright/test'
import { db, openContext, scalar, signIn, trackProblems } from './helpers'

/** Drafts are kept while they are written; a published article is never touched; a draft changed elsewhere is not overwritten. */
test('a draft article is autosaved, a stale draft is not overwritten, a published one is left alone', async ({ browser }) => {
  test.setTimeout(120_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true, benign: /409|Failed to load resource/ })
  await signIn(page)
  const sql = db()
  const [draft] = await sql`insert into articles (title, slug, excerpt, body, status, locale, category) values ('Autosave draft', 'autosave-draft', 'x', '<p>one</p>', 'draft', 'en', 'Guides') returning id`
  const [live] = await sql`insert into articles (title, slug, excerpt, body, status, locale, category, published_at) values ('Autosave live', 'autosave-live', 'x', '<p>live</p>', 'published', 'en', 'Guides', now()) returning id`

  await test.step('typing in a draft saves it a few seconds later, and says so', async () => {
    await page.goto(`/admin/articles/${draft.id}`, { waitUntil: 'networkidle' })
    const status = page.locator('[data-autosave]')
    await expect(status).toHaveAttribute('data-autosave', 'clean')
    await page.fill('input[name=title]', 'Autosave draft, edited')
    await expect(status).toHaveAttribute('data-autosave', 'dirty')
    await expect(status).toHaveAttribute('data-autosave', 'saved', { timeout: 15_000 })
    await expect(status).toContainText('Belum dipublikasikan')
    expect(await scalar(`select title from articles where id = ${draft.id}`)).toBe('Autosave draft, edited')
    expect(await scalar(`select status from articles where id = ${draft.id}`)).toBe('draft')
    await page.fill('input[name=title]', 'Autosave draft, edited twice')                         // the version it returned is used for the next save
    await expect(status).toHaveAttribute('data-autosave', 'saved', { timeout: 15_000 })
    await expect(async () => expect(await scalar(`select title from articles where id = ${draft.id}`)).toBe('Autosave draft, edited twice')).toPass({ timeout: 10_000 })
  })

  await test.step('a draft saved elsewhere meanwhile is not overwritten', async () => {
    await sql`update articles set title = 'Changed by someone else', updated_at = now() + interval '1 second' where id = ${draft.id}`
    await page.fill('input[name=title]', 'My late edit')
    await expect(page.locator('[data-autosave]')).toHaveAttribute('data-autosave', 'conflict', { timeout: 15_000 })
    await expect(page.locator('[data-autosave]')).toContainText('diubah di tempat lain')
    expect(await scalar(`select title from articles where id = ${draft.id}`)).toBe('Changed by someone else')
  })

  await test.step('a published article has no autosave, and the endpoint refuses it', async () => {
    await page.goto(`/admin/articles/${live.id}`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-autosave]')).toHaveCount(0)
    const res = await page.request.post('/admin/api/autosave/article', { data: { id: live.id, base: new Date().toISOString(), title: 'Overwritten?' } })
    expect(res.status()).toBe(409)
    expect(await scalar(`select title from articles where id = ${live.id}`)).toBe('Autosave live')
  })
  expect(problems.filter((p) => !/409|Failed to load resource/.test(p))).toEqual([])
  await context.close()
})
