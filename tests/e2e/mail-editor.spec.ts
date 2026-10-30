import { expect, test } from '@playwright/test'
import { openContext, scalar, signIn, trackProblems } from './helpers'

/** The email template editor: a preview made by the server (with its loading state), the variables of that email, and what the safety filter keeps. */
test('the email template editor previews, lists its variables and saves', async ({ browser }) => {
  test.setTimeout(120_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  // Playwright's own queries into the sandboxed preview frame are what the browser reports as blocked scripts; the page sends none (checked on the API answer below).
  trackProblems(page, 'admin', problems, { strict4xx: true, benign: /Blocked script execution in 'about:srcdoc'/ })
  await signIn(page)
  await page.goto('/admin/mail', { waitUntil: 'networkidle' })

  const panel = page.locator('details:has(summary[data-key=invoice_customer])')
  await panel.locator('summary').click()
  await expect(panel.locator('.tpl-vars .tpl-var').first()).toBeVisible()
  await expect(panel.locator('.tpl-vars')).toContainText('$customer_name')
  const frame = panel.frameLocator('iframe')
  await expect(frame.locator('body')).toContainText('Dear PT Contoh Maju')                       // sample data stands in for the variables
  await expect(panel.locator('.tpl-preview__subject')).toContainText('VORA invoice INV-VORA')

  await test.step('typing shows that the preview is updating, then the new text; unsafe markup is gone', async () => {
    const area = panel.locator('textarea')
    await area.fill('<p>Hello $customer_name $typo_variable</p><script>alert(1)</script><p style="position:fixed">kept text</p>')
    await expect(panel.locator('.tpl-editor__preview')).toContainText('Memperbarui')
    await expect(frame.locator('body')).toContainText('Hello PT Contoh Maju')
    await expect(frame.locator('script')).toHaveCount(0)
    await expect(frame.locator('p[style*="fixed"]')).toHaveCount(0)
    await expect(panel.locator('.note')).toContainText('$typo_variable')                       // a variable nobody fills is flagged before it reaches a customer
    await expect(panel.locator('p.mini[role=status]')).toContainText('belum disimpan')
  })

  await test.step('the preview answer itself holds no script', async () => {
    const res = await page.request.post('/admin/api/mail/preview', { data: { subject: 'S', html: '<p onclick="x()">a</p><script>alert(1)</script><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">b</a>' } })
    const body = await res.json()
    expect(body.html).not.toMatch(/<script|<iframe|onclick|javascript:/i)
    expect(body.html).toContain('a')
  })

  await test.step('clicking a variable puts it at the cursor', async () => {
    const area = panel.locator('textarea')
    await area.fill('AB')
    await area.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(1, 1) })
    await panel.locator('.tpl-var', { hasText: '$customer_name' }).click()
    await expect(area).toHaveValue('A$customer_nameB')
  })

  await test.step('saving stores the filtered template; sending an example without SMTP says why', async () => {
    await panel.locator('textarea').fill('<p>Dear $customer_name,</p><script>x()</script><p>Body text</p>')
    await panel.locator('button:has-text("Save template")').click()
    await expect(page.locator('.alert, .toast, [role=status]').filter({ hasText: 'Email template saved' }).first()).toBeVisible()
    const saved = await scalar(`select html from email_templates where key = 'invoice_customer'`)
    expect(saved).toContain('Body text')
    expect(saved).not.toContain('<script')
    await page.locator('details:has(summary[data-key=invoice_customer]) summary').click()            // the page was reloaded by the save: the panel is closed again
    await page.locator('details:has(summary[data-key=invoice_customer]) button:has-text("Send example to the administrator")').click()
    await expect(page.locator('.alert, .toast, [role=status]').filter({ hasText: /SMTP/ }).first()).toBeVisible()
  })
  expect(problems.filter((p) => !/Failed to load resource/.test(p))).toEqual([])
  await context.close()
})
