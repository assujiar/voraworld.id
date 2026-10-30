import { expect, test } from '@playwright/test'
import { openContext, overflow, scalar, signIn, trackProblems, confirmAsked } from './helpers'

/**
 * Letters, statements and certificates written in the browser: pick a type and a language, fill in the form (a refused form keeps what
 * was typed), save a draft, edit it, download the marked PDF, issue it and check it on the public verification page.
 */
test('writing, issuing and verifying a statement and a certificate', async ({ browser }) => {
  test.setTimeout(240_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true })
  const notice = () => page.locator('.alert').first()
  await signIn(page)

  let statementId = ''
  await test.step('a statement in Indonesian: the form starts from the type\'s wording, a refusal keeps what was typed', async () => {
    await page.goto('/admin/documents')
    await expect(page.locator('body')).toContainText('Surat Pernyataan')
    await page.selectOption('select[name=type]', 'statement')
    await page.selectOption('select[name=lang]', 'id')
    await page.click('button:has-text("Continue")')
    await page.waitForURL(/\/admin\/documents\/new\?type=statement&lang=id/)
    await expect(page.locator('textarea[name=closing]')).toHaveValue(/Demikian surat pernyataan ini saya buat/)       // the closing sentence is the type's own, in Indonesian
    await page.fill('input[name=declarant_name]', 'Budi Santoso')
    await page.fill('textarea[name=declarant_address]', 'Jl. Melati 5, Jakarta')
    await page.click('button:has-text("Save draft")')                                                                      // the statements are still empty
    await expect(page.locator('.alert[role=alert]')).toContainText('Statements is required')
    await expect(page.locator('input[name=declarant_name]')).toHaveValue('Budi Santoso')
    await expect(page.locator('textarea[name=declarant_address]')).toHaveValue('Jl. Melati 5, Jakarta')
    await page.fill('textarea[name=body]', '1. Bahwa seluruh dokumen yang saya serahkan adalah benar.\n2. Bahwa saya bertanggung jawab atas kebenaran data.')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/documents\/\d+(\?|$)/)
    await expect(notice()).toContainText('Document draft created')
    statementId = page.url().match(/documents\/(\d+)/)![1]
    await expect(page.locator('h3 .status')).toContainText(/draft/i)
    await expect(page.locator('body')).toContainText(/STM-VORA-V[0-9A-F]{10}-\d{6}-\d{5}/)
  })

  await test.step('a draft can be edited and its PDF is marked DRAFT', async () => {
    await page.click('a:has-text("Edit draft")')
    await page.waitForURL(/\/edit$/)
    await page.fill('input[name=declarant_position]', 'Direktur Utama')
    await page.click('button:has-text("Save draft")')
    await expect(notice()).toContainText('Document saved')
    await expect(page.locator('body')).toContainText('Direktur Utama')
    const pdf = await page.request.get(`/admin/documents/${statementId}/pdf`)
    expect(pdf.status()).toBe(200)
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.headers()['content-disposition']).toMatch(/STM-VORA-V[0-9A-F]{10}-\d{6}-\d{5}\.pdf/)
  })

  await test.step('issuing freezes it; the public page confirms it without saying what it says', async () => {
    await page.click('button:has-text("Issue document")')
    await expect(notice()).toContainText('Document state updated')
    await expect(page.locator('h3 .status')).toContainText(/issued/i)
    await expect(page.locator('a:has-text("Edit draft")')).toHaveCount(0)
    const number = await scalar(`select number from documents where id=${statementId}`)
    const token = await scalar(`select token from document_verification_tokens where kind='document' and document_id=${statementId}`)
    const visitor = await openContext(browser, 390, 900)
    trackProblems(visitor.page, 'visitor', problems, { strict4xx: true })
    await visitor.page.goto(`/verify/${token}`)
    const body = visitor.page.locator('body')
    await expect(body).toContainText('AUTHENTIC'); await expect(body).toContainText('Surat Pernyataan'); await expect(body).toContainText(number)
    await expect(body).not.toContainText('Budi Santoso'); await expect(body).not.toContainText('Bahwa seluruh dokumen')
    expect(await overflow(visitor.page)).toBeLessThanOrEqual(1)
    await visitor.context.close()
  })

  let certificateId = ''
  await test.step('a certificate in English names its holder on the public page', async () => {
    await page.goto('/admin/documents')
    await page.selectOption('select[name=type]', 'certificate')
    await page.selectOption('select[name=lang]', 'en')
    await page.click('button:has-text("Continue")')
    await page.waitForURL(/type=certificate&lang=en/)
    await expect(page.locator('input[name=title]')).toHaveValue('CERTIFICATE OF APPRECIATION')
    await page.fill('input[name=recipient_name]', 'Rina Wijaya')
    await page.fill('textarea[name=body]', 'For delivering one hundred shipments on time in 2026.')
    await page.fill('input[name=signatory_name]', 'Siti Rahma')
    await page.fill('input[name=signatory_title]', 'Operations Director')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/documents\/\d+(\?|$)/)
    certificateId = page.url().match(/documents\/(\d+)/)![1]
    await page.click('button:has-text("Issue document")')
    await expect(page.locator('h3 .status')).toContainText(/issued/i)
    const token = await scalar(`select token from document_verification_tokens where kind='document' and document_id=${certificateId}`)
    const visitor = await openContext(browser, 390, 900)
    await visitor.page.goto(`/verify/${token}`)
    await expect(visitor.page.locator('body')).toContainText('Certificate')
    await expect(visitor.page.locator('body')).toContainText('Awarded to:'); await expect(visitor.page.locator('body')).toContainText('Rina Wijaya')
    await visitor.context.close()
  })

  await test.step('voiding stops the QR code from verifying', async () => {
    await page.goto(`/admin/documents/${certificateId}`)
    await page.click('button:has-text("Void")')
    await confirmAsked(page)
    await expect(page.locator('h3 .status')).toContainText(/void/i)
    const token = await scalar(`select token from document_verification_tokens where kind='document' and document_id=${certificateId}`)
    const visitor = await openContext(browser)
    await visitor.page.goto(`/verify/${token}`)
    await expect(visitor.page.locator('body')).toContainText('VOID')
    await expect(visitor.page.locator('body')).not.toContainText('Rina Wijaya')
    await visitor.context.close()
  })

  await test.step('the list finds documents, and every document page fits a phone', async () => {
    await page.goto('/admin/documents?q=STM-VORA')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    const phone = await openContext(browser, 390, 900)
    trackProblems(phone.page, 'mobile', problems, { strict4xx: true })
    await signIn(phone.page)
    for (const p of ['/admin/documents', '/admin/documents/new?type=statement&lang=id', '/admin/documents/new?type=billing_letter&lang=id', `/admin/documents/${statementId}`, `/admin/documents/${statementId}/edit`]) {
      await phone.page.goto(p, { waitUntil: 'networkidle' })
      expect(await overflow(phone.page), p).toBeLessThanOrEqual(1)
    }
    await phone.context.close()
  })

  expect(problems, 'no console errors, failed requests or 5xx answers').toEqual([])
  await context.close()
})
