import { expect, test, type Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, openContext, overflow, trackProblems } from './helpers'

/** Page-load audits: every public page in both languages at six widths, and the admin portal at three. */
const PUBLIC_WIDTHS = [360, 390, 768, 1024, 1440, 1920]
const PUBLIC_PATHS = ['', '/about', '/services', '/services/international-freight-forwarding/air-import', '/services/project-cargo', '/solutions', '/network', '/faq', '/insights', '/contact', '/request-quote']

const ADMIN_WIDTHS = [390, 768, 1440]
const ADMIN_PAGES = [
  '/admin', '/admin/leads', '/admin/leads/1', '/admin/articles', '/admin/articles/new', '/admin/articles/1', '/admin/pages', '/admin/pages/new', '/admin/pages/1',
  '/admin/media', '/admin/faq', '/admin/coverage', '/admin/navigation', '/admin/seo', '/admin/settings', '/admin/mail', '/admin/audit',
  '/admin/customers', '/admin/customers/new', '/admin/quotations', '/admin/quotations/new', '/admin/invoices', '/admin/invoices/new', '/admin/receipts', '/admin/bank-accounts',
]

/** What is wrong with the page as rendered: sideways scrolling, images that did not load, heading structure, language, cursor. */
async function inspect(page: Page) {
  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
    h1: document.querySelectorAll('h1').length,
    lang: document.documentElement.lang,
    cursor: getComputedStyle(document.body).cursor,
  }))
}

for (const locale of ['en', 'id'] as const) {
  for (const width of PUBLIC_WIDTHS) {
    test(`public site, ${locale} at ${width}px: no overflow, broken image, console error or heading problem`, async ({ browser }) => {
      const { context, page } = await openContext(browser, width, 900)
      const errors: string[] = []
      trackProblems(page, `${locale}@${width}`, errors, { strict4xx: true })
      page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`))
      const problems: string[] = []
      for (const path of PUBLIC_PATHS) {
        await page.goto(`/${locale}${path}`, { waitUntil: 'networkidle' })
        // Scroll through the page so lazy images load before they are judged.
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)) } window.scrollTo(0, 0) })
        await page.waitForTimeout(150)
        const m = await inspect(page)
        const tag = `${locale}${path}@${width}`
        if (m.overflow > 1) problems.push(`${tag} horizontal overflow ${m.overflow}px`)
        if (m.broken.length) problems.push(`${tag} broken images ${m.broken.join(',')}`)
        if (m.h1 !== 1) problems.push(`${tag} has ${m.h1} h1 elements`)
        if (m.lang !== locale) problems.push(`${tag} lang="${m.lang}"`)
        if (m.cursor !== 'auto' && m.cursor !== 'default') problems.push(`${tag} custom cursor "${m.cursor}"`)
      }
      if (width <= 780) {
        await page.goto(`/${locale}`)
        await page.click('.mobile-nav summary')
        if (!(await page.isVisible('.mobile-menu a[href$="/request-quote"]'))) problems.push(`${locale}@${width}: the mobile menu did not open`)
      }
      expect([...problems, ...errors]).toEqual([])
      await context.close()
    })
  }
}

for (const width of ADMIN_WIDTHS) {
  test(`admin portal at ${width}px: sign-in, every page, grouped menu, sign-out`, async ({ browser }) => {
    const { context, page } = await openContext(browser, width, 900)
    const errors: string[] = []
    trackProblems(page, `admin@${width}`, errors, { strict4xx: true })
    const problems: string[] = []

    // A wrong password gives one generic message and no session.
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.fill('input[name=email]', ADMIN_EMAIL)
    await page.fill('input[name=password]', 'wrong-password-123')
    await page.click('form button.button')
    await page.waitForURL(/error=/)
    await expect(page.locator('.alert[role=alert]')).toContainText('Invalid login details')
    expect((await context.cookies()).find((c) => c.name === 'vora_session'), 'no session after a wrong password').toBeUndefined()

    await page.fill('input[name=email]', ADMIN_EMAIL)
    await page.fill('input[name=password]', ADMIN_PASSWORD)
    await Promise.all([page.waitForURL((u) => u.pathname === '/admin'), page.click('form button.button')])
    const session = (await context.cookies()).find((c) => c.name === 'vora_session')
    expect(session, 'a session cookie is set').toBeTruthy()
    expect({ httpOnly: session!.httpOnly, sameSite: session!.sameSite }).toEqual({ httpOnly: true, sameSite: 'Lax' })

    for (const path of ADMIN_PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      const m = await inspect(page)
      if (m.overflow > 1) problems.push(`${path}@${width} overflow ${m.overflow}px`)
      if (m.h1 !== 1) problems.push(`${path}@${width} has ${m.h1} h1 elements`)
      if (m.broken.length) problems.push(`${path}@${width} broken images ${m.broken.join(',')}`)
    }

    // The menu is grouped; on phones and small tablets it sits behind a button.
    await page.goto('/admin', { waitUntil: 'networkidle' })
    if (width <= 780) {
      await page.click('.admin-sidebar summary.sidebar-toggle')
      await expect(page.locator('.logout-button')).toBeVisible()
    }
    expect(await page.locator('.admin-sidebar details.menu-group > summary').allTextContents()).toEqual(['Sales', 'Finance', 'Website', 'System'])

    await Promise.all([page.waitForURL('**/admin/login'), page.click('.logout-button')])
    await page.goto('/admin', { waitUntil: 'networkidle' })
    expect(page.url(), 'signed out for good').toMatch(/admin\/login/)
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    expect([...problems, ...errors]).toEqual([])
    await context.close()
  })
}
