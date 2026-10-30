import { expect, test } from '@playwright/test'
import { BASE_URL, RESET_EMAIL, RESET_PASSWORD, openContext, signIn, trackProblems } from './helpers'

/**
 * Sign-in and password reset through Supabase Auth, in a real browser against the production server:
 * a wrong password, the HttpOnly session, a protected page after sign-out, "forgot password" → the email → the emailed link → a new password.
 * The mail server is a sink that keeps what Supabase Auth sent; everything else is the real thing.
 */
const AUTH_URL = process.env.E2E_AUTH_URL!
/**
 * Follows the emailed link the way the browser would: Supabase Auth checks the one-time token and answers with a redirect to the application.
 * The application builds that address from the https origin printed on documents; this test server speaks http, so the browser is sent there.
 */
async function openEmailedLink(page: import('@playwright/test').Page, link: string) {
  const hop = await fetch(link, { redirect: 'manual' })
  const to = hop.headers.get('location') ?? ''
  expect(to, 'Supabase Auth redirects to the application').toMatch(/^https:\/\/localhost:\d+\/admin\/auth\/callback/)
  await page.goto(to.replace(/^https:\/\/localhost:\d+/, BASE_URL))
}
const mailsTo = async (to: string) => ((await (await fetch(`${AUTH_URL}/__mails`)).json()) as Array<{ to: string; subject: string; body: string }>).filter((m) => m.to === to)

test('signing in, signing out, and choosing a new password from the emailed link', async ({ browser }) => {
  test.setTimeout(180_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser, 1280, 900)
  trackProblems(page, 'auth', problems, { strict4xx: true })
  const isSession = (c: { name: string }) => /^sb-.*-auth-token/.test(c.name)

  await test.step('a visitor who is not signed in cannot open the portal and is sent to the sign-in page', async () => {
    await page.goto('/admin/invoices')
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Finvoices/)
    await expect(page.locator('h1')).toHaveText('Sign in')
  })

  await test.step('the sign-in page links to the reset page, which asks only for an email address', async () => {
    await page.click('a:has-text("Forgot your password?")')
    await expect(page).toHaveURL(/\/admin\/forgot-password$/)
    await expect(page.locator('input[name=email]')).toBeVisible()
    await expect(page.locator('input[name=password]')).toHaveCount(0)
  })

  const NEW_PASSWORD = 'A-new-passphrase-for-the-reset-admin-2026'
  await test.step('"forgot password" gives the same answer for an administrator and for a stranger, and emails only the administrator', async () => {
    for (const email of ['nobody@example.invalid', RESET_EMAIL]) {
      await page.goto('/admin/forgot-password')
      await page.fill('input[name=email]', email)
      await Promise.all([page.waitForURL(/\/admin\/login\?notice=/), page.click('form button.button')])
      await expect(page.locator('.alert[role=status]')).toContainText('If that address belongs to an administrator, a reset link has been sent.')
    }
    await expect.poll(async () => (await mailsTo(RESET_EMAIL)).length, { timeout: 15_000 }).toBeGreaterThan(0)
    expect(await mailsTo('nobody@example.invalid')).toHaveLength(0)
  })

  await test.step('the emailed link signs the administrator in once, and a new password replaces the old one', async () => {
    const mail = (await mailsTo(RESET_EMAIL)).at(-1)!
    const link = /href="([^"]+)"/.exec(mail.body)![1].replace(/&amp;/g, '&')
    await openEmailedLink(page, link)
    await expect(page).toHaveURL(/\/admin\/reset-password$/)
    await expect(page.locator('h1')).toHaveText('Choose a new password')
    expect((await context.cookies()).filter(isSession).length, 'the link signed the administrator in').toBeGreaterThan(0)

    await page.fill('input[name=password]', 'too-short')
    await page.fill('input[name=confirm]', 'too-short')
    await page.evaluate(() => document.querySelectorAll('input').forEach((i) => i.removeAttribute('minlength')))        // let the server, not the browser, refuse
    await page.click('form button.button')
    await expect(page.locator('.alert[role=alert]')).toContainText('at least 14 characters')

    await page.fill('input[name=password]', NEW_PASSWORD)
    await page.fill('input[name=confirm]', NEW_PASSWORD + 'x')
    await page.click('form button.button')
    await expect(page.locator('.alert[role=alert]')).toContainText('do not match')

    await page.fill('input[name=password]', NEW_PASSWORD)
    await page.fill('input[name=confirm]', NEW_PASSWORD)
    await Promise.all([page.waitForURL((u) => u.pathname === '/admin'), page.click('form button.button')])
    await expect(page.locator('.admin-sidebar')).toBeVisible()
  })

  await test.step('the same emailed link does not work a second time', async () => {
    const fresh = await openContext(browser, 1280, 900)
    const mail = (await mailsTo(RESET_EMAIL)).at(-1)!
    const link = /href="([^"]+)"/.exec(mail.body)![1].replace(/&amp;/g, '&')
    await openEmailedLink(fresh.page, link)
    await expect(fresh.page).toHaveURL(/\/admin\/login/)
    await expect(fresh.page.locator('.alert[role=alert]')).toContainText(/expired|already used|Request a new one/)
    expect((await fresh.context.cookies()).filter(isSession)).toEqual([])
    await fresh.context.close()
  })

  await test.step('the old password is refused and the new one works; the session cookies are HttpOnly and go away on sign-out', async () => {
    const second = await openContext(browser, 1280, 900)
    await second.page.goto('/admin/login')
    await second.page.fill('input[name=email]', RESET_EMAIL)
    await second.page.fill('input[name=password]', RESET_PASSWORD)
    await second.page.click('form button.button')
    await second.page.waitForURL(/error=/)
    await expect(second.page.locator('.alert[role=alert]')).toContainText('Invalid login details')
    expect((await second.context.cookies()).filter(isSession)).toEqual([])

    await signIn(second.page, RESET_EMAIL, NEW_PASSWORD)
    const cookies = (await second.context.cookies()).filter(isSession)
    expect(cookies.length).toBeGreaterThan(0)
    for (const c of cookies) expect({ httpOnly: c.httpOnly, sameSite: c.sameSite }, c.name).toEqual({ httpOnly: true, sameSite: 'Lax' })
    expect(await second.page.evaluate(() => document.cookie)).not.toMatch(/sb-/)                       // not readable by a script on the page

    await Promise.all([second.page.waitForURL('**/admin/login'), second.page.click('.logout-button')])
    expect((await second.context.cookies()).filter(isSession)).toEqual([])
    await second.page.goto('/admin/leads')
    await expect(second.page).toHaveURL(/\/admin\/login\?next=/)
    await second.context.close()
  })

  await context.close()
  expect(problems, problems.join('\n')).toEqual([])
})
