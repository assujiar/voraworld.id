import { expect, test } from '@playwright/test'
import { openContext, scalar, signIn, trackProblems } from './helpers'

/**
 * What a person sees while the application works: the button names the action and refuses a second click, a refused form keeps what was typed and
 * says it was not saved, a destructive action asks first, and a lost connection ends in a state the person can recover from.
 */
test('processing feedback: pending label, one submission, kept data, a question before deleting, a lost connection', async ({ browser }) => {
  test.setTimeout(180_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true, benign: /Failed to load resource|net::ERR/ })
  await signIn(page)

  await test.step('saving a customer says what it is doing, and a second click does not save twice', async () => {
    await page.goto('/admin/customers/new', { waitUntil: 'networkidle' })
    await page.fill('input[name=name]', 'PT Feedback Customer')
    await expect(page.locator('.form-status')).toHaveText('Perubahan belum disimpan')                  // edited, not saved
    let posts = 0
    await page.route('**/admin/customers/new', async (route) => {
      if (route.request().method() === 'POST') { posts++; await new Promise((r) => setTimeout(r, 1800)) }   // a slow server
      await route.continue()
    })
    const save = page.locator('button:has-text("Save customer")')
    await save.click({ noWaitAfter: true })
    const busy = page.locator('button.is-busy')
    await expect(busy).toContainText('Menyimpan Customer…')
    await expect(busy).toHaveAttribute('aria-busy', 'true')
    await expect(busy).toBeDisabled()
    await busy.click({ force: true, noWaitAfter: true, timeout: 2000 }).catch(() => undefined)        // a second click on the busy button
    await page.waitForURL(/\/admin\/customers\/\d+/)
    await expect(page.locator('.toast-ok')).toContainText('Customer saved')
    expect(posts).toBe(1)
    expect(await scalar("select count(*) from customers where name = 'PT Feedback Customer'")).toBe('1')
    await page.unroute('**/admin/customers/new')
  })

  await test.step('a refused form says it was not saved and keeps everything that was typed', async () => {
    await page.goto('/admin/customers/new', { waitUntil: 'networkidle' })
    await page.fill('input[name=name]', 'PT Feedback Customer')
    await page.fill('input[name=email]', 'feedback@example.invalid')
    await page.fill('input[name=pic_name]', 'Typed Person')
    await page.click('button:has-text("Save customer")')
    await expect(page.locator('.alert[role=alert]')).toContainText('A similar customer already exists')
    await expect(page.locator('.form-status')).toContainText('Gagal menyimpan perubahan')
    await expect(page.locator('input[name=pic_name]')).toHaveValue('Typed Person')
    await expect(page.locator('input[name=email]')).toHaveValue('feedback@example.invalid')
    await expect(page.locator('button:has-text("Save customer")')).toBeEnabled()                        // not stuck: it can be tried again
  })

  await test.step('a destructive action asks first and does nothing until it is confirmed', async () => {
    await page.goto('/admin/faq', { waitUntil: 'networkidle' })
    const before = await scalar('select count(*) from faqs')
    await page.locator('button:has-text("Delete")').first().click()
    await expect(page.locator('dialog[open]')).toContainText('Hapus data ini?')
    expect(await scalar('select count(*) from faqs')).toBe(before)
    await page.locator('dialog[open] button:has-text("Kembali")').click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    expect(await scalar('select count(*) from faqs')).toBe(before)
  })

  await test.step('a lost connection ends in a state the person can recover from', async () => {
    await page.goto('/admin/customers/new', { waitUntil: 'networkidle' })
    await page.fill('input[name=name]', 'PT Offline Customer')
    await page.fill('input[name=pic_name]', 'Kept Person')
    await page.route('**/admin/customers/new', (route) => (route.request().method() === 'POST' ? route.abort('connectionfailed') : route.continue()))
    await page.click('button:has-text("Save customer")', { noWaitAfter: true })
    await expect(page.locator('button.is-busy')).toHaveCount(0, { timeout: 15_000 })                    // the loader ends
    expect(await scalar("select count(*) from customers where name = 'PT Offline Customer'")).toBe('0')   // and nothing is claimed saved
    await expect(page.locator('.toast-ok')).toHaveCount(0)
    await expect(page.locator('.alert[role=alert]')).toContainText('hasilnya belum pasti')               // said plainly: the outcome is not known
    await page.unroute('**/admin/customers/new')
    const inputs = await page.locator('input[name=name]').count()
    if (inputs) {
      await expect(page.locator('input[name=name]')).toHaveValue('PT Offline Customer')                // the typed data is still there
      await expect(page.locator('input[name=pic_name]')).toHaveValue('Kept Person')
      await page.click('button:has-text("Save customer")')                                               // and the same click works once the connection is back
      await page.waitForURL(/\/admin\/customers\/\d+/)
    }
  })
  expect(problems, 'no unexpected console errors or 5xx answers').toEqual([])
  await context.close()
})
