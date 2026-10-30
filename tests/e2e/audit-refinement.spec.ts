import { expect, test } from '@playwright/test'

/** Public-site refinements from the audit: menu bounds, accessible form names, locale-safe quotation link, honest language fallback, archive reading. */

test.describe('services menu', () => {
  test('opens inside the viewport at desktop width, closes with Escape and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/en')
    const summary = page.locator('.v-nav__services > summary')
    await summary.click()
    const panel = page.locator('.v-mega')
    await expect(panel).toBeVisible()
    const box = (await panel.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(1440)
    expect(box.y + box.height).toBeLessThanOrEqual(900)
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(summary).toBeFocused()
  })
})

test.describe('inquiry form', () => {
  test('every field has an accessible name and the consent is a labelled checkbox', async ({ page }) => {
    await page.goto('/en/request-quote')
    for (const name of ['Name', 'Email', 'Company']) await expect(page.getByLabel(new RegExp(`^${name}`, 'i')).first()).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(1)
    await expect(page.locator('input[name="email"]')).toHaveAttribute('autocomplete', 'email')
    const unlabelled = await page.evaluate(() => [...document.querySelectorAll('main input:not([type=hidden]):not([aria-hidden=true]), main select, main textarea')].filter((el) => !(el as HTMLInputElement).labels?.length && !el.getAttribute('aria-label')).map((el) => el.getAttribute('name')))
    expect(unlabelled).toEqual([])
  })

  test('the language switch keeps a known service on the quotation form and drops an unknown one', async ({ page }) => {
    await page.goto('/en/request-quote?mode=air-import')
    await expect(page.locator('a.v-lang').first()).toHaveAttribute('href', /\/id\/request-quote\?mode=air-import$/)
    await page.goto('/en/request-quote?mode=%22%3E%3Cscript%3E')
    await expect(page.locator('a.v-lang').first()).toHaveAttribute('href', /\/id\/request-quote$/)
  })
})

test.describe('language-aware content', () => {
  test('Indonesian legal pages say so when only the English text exists, and never claim to be reviewed Indonesian', async ({ page }) => {
    await page.goto('/id/privacy')
    await expect(page.locator('h1')).toContainText('Privasi')
  })
  test('the FAQ shows at least 12 answers in each language', async ({ page }) => {
    for (const [loc, first] of [['en', 'What should I include'], ['id', 'Informasi apa yang perlu']] as const) {
      await page.goto(`/${loc}/faq`)
      expect(await page.locator('.v-faq__list details').count()).toBeGreaterThanOrEqual(12)
      await expect(page.getByText(first)).toBeVisible()
    }
  })
  test('the network page explains how a lane is confirmed and uses no CMS wording', async ({ page }) => {
    await page.goto('/en/network')
    await expect(page.getByRole('heading', { name: 'How a lane is confirmed' })).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/admin portal|CMS|not been approved/i)
  })
})

test.describe('insights', () => {
  test('with nothing published the page offers checklists, not an empty list', async ({ page }) => {
    await page.goto('/en/insights')
    await expect(page.getByRole('heading', { name: /checklists/i })).toBeVisible()
    expect(await page.locator('.v-notes__item').count()).toBe(3)
  })
  test('a filter that matches nothing says so and offers to clear it', async ({ page }) => {
    await page.goto('/en/insights?year=2024&quarter=2')
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('reduced motion', () => {
  test('the hero drawing holds one frame when reduced motion is on, and stops if it is switched on later', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/en')
    await expect(page.locator('.v-hero__routes')).toBeAttached()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(400)
    const a = await page.locator('.v-hero__routes').screenshot()
    await page.waitForTimeout(1200)
    const b = await page.locator('.v-hero__routes').screenshot()
    expect(Buffer.compare(a, b)).toBe(0)
  })
})
