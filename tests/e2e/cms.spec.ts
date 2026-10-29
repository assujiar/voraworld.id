import { expect, test } from '@playwright/test'
import { PNG, openContext, scalar, signIn, trackProblems } from './helpers'

/**
 * Every named submit button of the content portal, clicked in a real browser. Unit tests cannot see this class of bug:
 * a form control called "id" once made React drop the clicked button, so Publish, Issue and Void silently lost their action.
 */
test('the content portal: articles, pages, FAQ, navigation, coverage, redirects, settings, media, leads, SMTP', async ({ browser }) => {
  test.setTimeout(420_000)
  const problems: string[] = []
  // The stand-in storage lives on 127.0.0.1 (not *.supabase.co), so the CSP rightly blocks its images: not a defect.
  const benign = /127\.0\.0\.1|Content Security Policy|Failed to load resource/
  const admin = await openContext(browser)
  const visitor = await openContext(browser, 1280, 900)
  const page = admin.page
  const anon = visitor.page
  trackProblems(page, 'admin', problems, { benign })
  trackProblems(anon, 'public', problems, { benign })

  const banner = async () => (await page.locator('.alert').allTextContents()).join(' | ')
  const said = (re: RegExp, timeout = 10_000) => expect.poll(banner, { timeout }).toMatch(re)
  /** A page is interactive once its scripts have run; the rich-text editor in particular needs that before typing. */
  const settle = async () => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(500) }
  const publicStatus = async (url: string) => (await anon.goto(url, { waitUntil: 'domcontentloaded' }))!.status()

  await signIn(page)

  await test.step('articles: draft -> publish -> unpublish through the named buttons', async () => {
    await page.goto('/admin/articles/new')
    await settle()
    await page.fill('input[name=title]', 'Browser Test Article')
    await page.fill('textarea[name=excerpt]', 'An excerpt from the browser')
    await page.click('[role=textbox]')
    await page.keyboard.type('Written in the rich editor.')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/articles\/\d+/)
    const articleId = page.url().match(/articles\/(\d+)/)![1]
    expect(await scalar(`select status from articles where id=${articleId}`)).toBe('draft')
    expect(await scalar(`select body from articles where id=${articleId}`)).toContain('Written in the rich editor')
    expect(await publicStatus('/en/insights/browser-test-article'), 'a draft is not public').toBe(404)

    await page.goto(`/admin/articles/${articleId}`)
    await settle()
    await page.click('button:has-text("HTML source")')
    await page.fill('textarea.rich-html', '<h2>Heading</h2><p>Safe text</p><script>window.pwned=1</script><img src=x onerror=alert(1)>')
    await page.click('button:has-text("Publish")')
    await expect.poll(() => scalar(`select status from articles where id=${articleId}`)).toBe('published')
    const body = await scalar(`select body from articles where id=${articleId}`)
    expect(body, 'HTML from the source box is sanitised').not.toMatch(/script|onerror/i)
    expect(body).toContain('Safe text')
    expect(await publicStatus('/en/insights/browser-test-article')).toBe(200)
    await expect(anon.locator('body')).toContainText('Safe text')
    expect(await anon.evaluate(() => (window as unknown as { pwned?: number }).pwned), 'no script ran on the public page').toBeUndefined()

    await settle()
    await page.click('button:has-text("Unpublish")')
    await expect.poll(() => scalar(`select status from articles where id=${articleId}`)).toBe('draft')
    expect(await publicStatus('/en/insights/browser-test-article')).toBe(404)
    expect(Number(await scalar(`select count(*) from revisions where resource='article' and resource_id=${articleId}`)), 'every edit kept a revision').toBeGreaterThanOrEqual(2)
    await settle()
    await page.locator('button:has-text("Restore revision")').first().click()
    await said(/Revision restored/)
  })

  await test.step('pages and sections: add, edit, reorder (Enter saves, never moves), delete, publish', async () => {
    await page.goto('/admin/pages/new')
    await page.fill('input[name=title]', 'Careers Browser')
    await page.fill('textarea[name=description]', 'Join the team')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/pages\/\d+/)
    const pageId = page.url().match(/pages\/(\d+)/)![1]
    await settle()
    for (let i = 1; i <= 3; i++) {
      await page.click('button:has-text("Add editorial section")')
      await expect.poll(async () => Number(await scalar(`select count(*) from sections where page_id=${pageId}`)), { message: `section ${i} added` }).toBe(i)
      await settle()
    }
    const titles = () => scalar(`select string_agg(title, ',' order by position, id) from sections where page_id=${pageId}`)
    const form = (n: number) => page.locator('.layout-preview form').nth(n)
    const want = async (expected: string, msg: string) => { await expect.poll(titles, { message: msg }).toBe(expected); await settle() }
    const saved = ['New editorial block', 'New editorial block', 'New editorial block']
    for (const [n, t] of [[0, 'Alpha'], [1, 'Bravo'], [2, 'Charlie']] as const) {
      await form(n).locator('input[name=title]').fill(t)
      saved[n] = t
      await form(n).locator('button:has-text("Save section")').click()
      await want(saved.join(','), `the Save button stored "${t}"`)
    }
    await form(1).locator('input[name=title]').fill('Bravo edited')
    await form(1).locator('input[name=title]').press('Enter')
    await want('Alpha,Bravo edited,Charlie', 'Enter in a field SAVES the section (it does not move it)')
    await form(2).locator('button:has-text("↑ Up")').click()
    await want('Alpha,Charlie,Bravo edited', '↑ Up moved Charlie')
    await form(0).locator('button:has-text("↓ Down")').click()
    await want('Charlie,Alpha,Bravo edited', '↓ Down moved Alpha')
    await form(1).locator('button:has-text("Delete")').click()
    await want('Charlie,Bravo edited', 'Delete removed the section')

    await page.click('button:has-text("Publish page")')
    await expect.poll(() => scalar(`select status from pages where id=${pageId}`)).toBe('published')
    expect(await publicStatus('/en/careers-browser')).toBe(200)
    await expect(anon.locator('body')).toContainText('Charlie')
    await settle()
    await form(0).locator('input[name=title]').fill('Changed after publishing')
    await form(0).locator('button:has-text("Save section")').click()
    await want('Changed after publishing,Bravo edited', 'a draft edit is saved')
    await anon.goto('/en/careers-browser')
    await expect(anon.locator('body')).not.toContainText('Changed after publishing')             // draft edits stay private until publish
    await page.click('button:has-text("Unpublish")')
    await expect.poll(() => scalar(`select status from pages where id=${pageId}`)).toBe('draft')
    expect(await publicStatus('/en/careers-browser')).toBe(404)
  })

  await test.step('FAQ, navigation, coverage, redirects, settings', async () => {
    await page.goto('/admin/faq')
    await settle()
    await page.fill('input[name=question] >> nth=0', 'Do you ship to Medan?')
    await page.fill('textarea[name=answer] >> nth=0', 'Yes, by sea and air.')
    await page.click('button:has-text("Add FAQ")')
    await expect.poll(() => scalar("select count(*) from faqs where question='Do you ship to Medan?'")).toBe('1')
    await settle()
    const faq = () => page.locator('form', { has: page.locator('input[name=question][value="Do you ship to Medan?"]') })
    await faq().locator('textarea[name=answer]').fill('Yes, by sea, air and road.')
    await faq().locator('button:has-text("Update")').click()
    await expect.poll(() => scalar("select answer from faqs where question='Do you ship to Medan?'")).toContain('road')
    await settle()
    await faq().locator('button:has-text("Delete")').click()
    await expect.poll(() => scalar("select count(*) from faqs where question='Do you ship to Medan?'")).toBe('0')

    await page.goto('/admin/navigation')
    await settle()
    await page.fill('input[name=label]', 'Careers')
    await page.fill('input[name=href]', '/en/careers-browser')
    await page.click('button:has-text("Add item")')
    await expect.poll(() => scalar("select count(*) from navigation_items where label='Careers'")).toBe('1')
    await settle()
    await page.locator('tr:has-text("Careers") button:has-text("Delete")').click()
    await expect.poll(() => scalar("select count(*) from navigation_items where label='Careers'")).toBe('0')
    await settle()
    await page.fill('input[name=label]', 'Admin')
    await page.fill('input[name=href]', '/admin')
    await page.click('button:has-text("Add item")')
    await said(/admin/i)
    expect(await scalar("select count(*) from navigation_items where href='/admin'"), 'a link into the admin portal is refused').toBe('0')

    await page.goto('/admin/coverage')
    await settle()
    await page.fill('input[name=region]', 'Surabaya')
    await page.check('input[name=active]')
    await page.click('button:has-text("Add coverage")')
    await expect.poll(() => scalar("select active from coverage where region='Surabaya'")).toBe('true')
    await settle()
    await page.locator('tr:has-text("Surabaya") button').click()
    await expect.poll(() => scalar("select active from coverage where region='Surabaya'")).toBe('false')

    await page.goto('/admin/seo')
    await settle()
    await page.fill('input[name=old_path]', '/en/old-page')
    await page.fill('input[name=new_path]', '/en/about')
    await page.click('button:has-text("Create redirect")')
    await expect.poll(() => scalar("select count(*) from seo_redirects where old_path='/en/old-page'")).toBe('1')
    await anon.goto('/en/old-page', { waitUntil: 'domcontentloaded' })
    expect(anon.url().endsWith('/en/about'), `the redirect works for visitors (${anon.url()})`).toBe(true)

    await page.goto('/admin/settings')
    await settle()
    await page.fill('textarea[name=company_description]', 'Edited in the browser')
    await page.fill('input[name=hours]', 'Mon-Fri 09:00-17:00')
    await page.click('button:has-text("Save & publish settings")')
    await expect.poll(() => scalar("select value from settings where key='company_description'")).toContain('Edited in the browser')
  })

  await test.step('media upload checks the bytes, not the file name', async () => {
    await page.goto('/admin/media')
    await settle()
    await page.setInputFiles('input[name=image]', { name: 'pixel.png', mimeType: 'image/png', buffer: PNG })
    await page.fill('input[name=alt]', 'A single pixel')
    await page.click('button:has-text("Upload")')
    await expect.poll(async () => Number(await scalar('select count(*) from media'))).toBe(1)
    await settle()
    await page.setInputFiles('input[name=image]', { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('<?php echo 1; ?>'.padEnd(80)) })
    await page.fill('input[name=alt]', 'bad')
    await page.click('button:has-text("Upload")')
    await said(/PNG, JPEG, WEBP and AVIF/)
    expect(Number(await scalar('select count(*) from media')), 'a fake image is refused').toBe(1)
  })

  await test.step('a visitor sends an RFQ and the admin works the lead', async () => {
    await anon.goto('/en/request-quote')
    await anon.waitForLoadState('networkidle')
    await anon.waitForTimeout(500)
    const f = anon.locator('form').filter({ has: anon.locator('input[name=email]') }).first()
    await f.locator('input[name=name]').fill('Dewi Browser')
    await f.locator('input[name=email]').fill('dewi@browser.example')
    await f.locator('input[name=company]').fill('PT Dewi')
    await f.locator('select[name=mode]').selectOption({ index: 1 })
    await f.locator('input[name=origin]').fill('Jakarta')
    await f.locator('input[name=destination]').fill('Rotterdam')
    await f.locator('textarea[name=message]').fill('Need rates for 2x40HC')
    await f.locator('input[name=consent]').check()
    await f.locator('button').last().click()
    await anon.waitForURL(/sent=1/)
    await expect(anon.locator('body')).toContainText('Inquiry submitted successfully')
    await expect.poll(() => scalar("select count(*) from leads where email='dewi@browser.example'")).toBe('1')

    await page.goto('/admin/leads')
    await page.click('a:has-text("Dewi Browser")')
    await page.waitForURL(/\/admin\/leads\/\d+/)
    await settle()
    await page.selectOption('select[name=status]', 'qualified')
    await page.selectOption('select[name=priority]', 'urgent')
    await page.fill('input[name=assignee]', 'Rina')
    await page.fill('textarea[name=note]', 'Called, wants a quote today')
    await page.click('button:has-text("Save lead")')
    await expect.poll(() => scalar("select status||'/'||priority||'/'||assignee from leads where email='dewi@browser.example'")).toBe('qualified/urgent/Rina')
    await settle()
    await expect(page.locator('body')).toContainText('Called, wants a quote today')              // the note is in the activity timeline
    const csv = await page.request.get('/admin/leads.csv')
    expect(csv.status()).toBe(200)
    expect(await csv.text()).toContain('Dewi Browser')
  })

  await test.step('SMTP: the test email reports its outcome, with the reason when it fails', async () => {
    await page.goto('/admin/mail')
    await settle()
    await page.fill('input[name=host]', 'smtp.example.invalid')
    await page.fill('input[name=username]', 'u')
    await page.fill('input[name=password]', 'secret-pass')
    await page.check('input[name=enabled]')
    await page.click('button:has-text("Save SMTP settings")')
    await said(/SMTP configuration saved/)
    await settle()
    await page.click('button:has-text("Send test email")')
    await said(/Test email sent|SMTP test failed/, 45_000)
  })

  await test.step('sign out ends the session for good', async () => {
    await Promise.all([page.waitForURL('**/admin/login'), page.click('.logout-button')])
    await page.goto('/admin/leads')
    expect(page.url()).toMatch(/admin\/login/)
  })

  expect(problems, 'no console errors or 5xx answers').toEqual([])
  await admin.context.close()
  await visitor.context.close()
})
