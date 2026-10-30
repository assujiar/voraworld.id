import { expect, test } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createHash } from 'node:crypto'
import { BASE_URL, confirmAsked, openContext, scalar, signIn, trackProblems } from './helpers'

/**
 * An agreement written in the portal (its template placeholders block issuing), and a PDF issued by another party that receives VORA's QR seal: the
 * admin sees the fingerprints, anyone who scans the QR sees them on the verification page and can check a file they hold without uploading it.
 */
const sha = (b: Uint8Array | Buffer) => createHash('sha256').update(b).digest('hex')

async function partnerPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 2; i++) doc.addPage([595.28, 841.89]).drawText(`Certificate of Origin, page ${i}`, { x: 150, y: 420, size: 16, font })
  return Buffer.from(await doc.save())
}

test('agreement with editable articles, and a QR seal on a PDF from another party', async ({ browser }) => {
  test.setTimeout(240_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true })
  await signIn(page)
  let agreementId = '', sealId = ''

  await test.step('a cooperation agreement starts from a template of ten articles; placeholders are refused at issue', async () => {
    await page.goto('/admin/documents/new?type=cooperation_agreement&lang=id', { waitUntil: 'networkidle' })
    await expect(page.locator('textarea[name=item_body]')).toHaveCount(10)
    await expect(page.locator('input[name=first_company]')).toHaveValue('PT Satu Arah International')    // party one starts as VORA
    await page.fill('input[name=first_name]', 'Siti Rahma'); await page.fill('input[name=first_position]', 'Direktur')
    await page.fill('input[name=second_company]', 'PT Mitra Dagang'); await page.fill('input[name=second_name]', 'Budi Santoso')
    await page.fill('input[name=second_position]', 'Direktur Utama'); await page.fill('textarea[name=second_address]', 'Jl. Contoh 5, Bekasi')
    await page.locator('input[name=item_title]').nth(1).fill('Cakupan Kerja Sama')                         // an article is edited in the table
    await page.click('button:has-text("Add article")')
    await page.locator('input[name=item_title]').nth(10).fill('Lampiran')
    await page.locator('textarea[name=item_body]').nth(10).fill('Lampiran A memuat daftar tarif.')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/documents\/\d+/)
    agreementId = page.url().match(/documents\/(\d+)/)![1]
    await expect(page.locator('ol li').first()).toContainText('Maksud dan Tujuan')
    await expect(page.locator('ol li')).toHaveCount(11)
    await page.click('button:has-text("Issue document")')
    await expect(page.locator('.alert[role=alert]')).toContainText('brackets')                             // [isi: ...] is still in the text
    expect(await scalar(`select status from documents where id = ${agreementId}`)).toBe('draft')
  })

  await test.step('after the placeholders are completed it is issued and downloads as a PDF', async () => {
    await page.goto(`/admin/documents/${agreementId}/edit`, { waitUntil: 'networkidle' })
    const bodies = page.locator('textarea[name=item_body]')
    for (let i = 0; i < await bodies.count(); i++) {
      const value = await bodies.nth(i).inputValue()
      await bodies.nth(i).fill(value.replace(/\[isi:[^\]]*\]/gi, 'tiga puluh'))
    }
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(new RegExp(`/admin/documents/${agreementId}(\\?|$)`))
    await page.click('button:has-text("Issue document")')
    await expect(page.locator('h3 .status').first()).toContainText('issued')
    const pdf = await page.request.get(`/admin/documents/${agreementId}/pdf`)
    expect(pdf.status()).toBe(200)
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  const original = await partnerPdf()
  await test.step('a PDF from another party is uploaded, previewed, sealed and released', async () => {
    await page.goto('/admin/documents/new?type=seal&lang=id', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toContainText('not a certified electronic signature')              // said before anything is done
    await page.fill('input[name=source_title]', 'Certificate of Origin'); await page.fill('input[name=source_issuer]', 'Kamar Dagang Contoh')
    await page.fill('input[name=source_reference]', 'COO-2026-0042')
    await page.fill('input[name=signatory_name]', 'Siti Rahma'); await page.fill('input[name=signatory_title]', 'Direktur')
    await page.click('button:has-text("Save draft")', { noWaitAfter: true })
    await expect(page.locator('input[name=source_pdf]:invalid')).toHaveCount(1)                            // no file yet: the browser stops the form
    await page.setInputFiles('input[name=source_pdf]', { name: 'coo.pdf', mimeType: 'application/pdf', buffer: original })
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/documents\/\d+/)
    sealId = page.url().match(/documents\/(\d+)/)![1]
    await expect(page.locator('body')).toContainText(sha(original))                                         // the fingerprint of what arrived
    const preview = await page.request.get(`/admin/documents/${sealId}/pdf`)
    expect(preview.status()).toBe(200)
    expect((await preview.body()).subarray(0, 5).toString()).toBe('%PDF-')
    expect(await page.request.get(`/admin/documents/${sealId}/source`).then((r) => r.body())).toEqual(original)   // the original is available unchanged
    await page.click('button:has-text("Issue document")')
    await expect(page.locator('h3 .status').first()).toContainText('issued')
    await expect(page.locator('body')).toContainText('Sealed file: 1 page')
    await expect(page.locator('a:has-text("Download the sealed PDF")')).toBeVisible()
  })

  await test.step('anyone who scans the QR sees the fingerprints and can check a file without uploading it', async () => {
    const token = await scalar(`select token from document_verification_tokens where kind='document' and document_id=${sealId}`)
    const sealedHash = await scalar(`select fields->'seal'->>'sha256' from documents where id=${sealId}`)
    const sealedBytes = await (await page.request.get(`/admin/documents/${sealId}/pdf`)).body()
    expect(sha(sealedBytes)).toBe(sealedHash)
    const visitor = await openContext(browser, 390, 900)
    trackProblems(visitor.page, 'verify', problems, { strict4xx: true })
    const uploads: string[] = []
    visitor.page.on('request', (r) => { if (r.method() === 'POST') uploads.push(r.url()) })
    await visitor.page.goto(`${BASE_URL}/verify/${token}`, { waitUntil: 'networkidle' })
    const body = visitor.page.locator('body')
    await expect(body).toContainText('AUTHENTIC')
    await expect(body).toContainText('Certificate of Origin')
    await expect(body).toContainText('Kamar Dagang Contoh')
    await expect(body).toContainText('Siti Rahma')
    await expect(body).toContainText(sealedHash); await expect(body).toContainText(sha(original))
    await expect(body).toContainText('not a certified electronic signature')
    const check = visitor.page.locator('#file-check')
    await check.setInputFiles({ name: 'sealed.pdf', mimeType: 'application/pdf', buffer: Buffer.from(sealedBytes) })
    await expect(visitor.page.locator('[role=status]').last()).toContainText('exactly the document that VORA sealed')
    await check.setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: original })
    await expect(visitor.page.locator('[role=status]').last()).toContainText('original file as it was before the seal')
    await check.setInputFiles({ name: 'other.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from(sealedBytes), Buffer.from(' ')]) })
    await expect(visitor.page.locator('[role=status]').last()).toContainText('does NOT match')
    expect(uploads, 'the file is compared in the browser and never sent').toEqual([])
    expect(await visitor.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    await visitor.context.close()
  })

  await test.step('voiding the seal withdraws the file and the verification', async () => {
    await page.goto(`/admin/documents/${sealId}`)
    await page.click('button:has-text("Void")')
    await confirmAsked(page)
    await expect(page.locator('h3 .status').first()).toContainText('void')
    expect((await page.request.get(`/admin/documents/${sealId}/pdf`)).status()).toBe(409)
    const token = await scalar(`select token from document_verification_tokens where kind='document' and document_id=${sealId}`)
    const visitor = await openContext(browser)
    await visitor.page.goto(`${BASE_URL}/verify/${token}`)
    await expect(visitor.page.locator('body')).toContainText('VOID')
    await expect(visitor.page.locator('#file-check')).toHaveCount(0)
    await visitor.context.close()
  })

  expect(problems, 'no console errors, failed requests or 5xx answers').toEqual([])
  await context.close()
})
