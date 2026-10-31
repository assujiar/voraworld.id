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
    await expect(page.locator('h3 .status').first()).toContainText(/issued/i)
    const pdf = await page.request.get(`/admin/documents/${agreementId}/pdf`)
    expect(pdf.status()).toBe(200)
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  const original = await partnerPdf()
  await test.step('a PDF from another party is uploaded, previewed, sealed and released', async () => {
    await page.goto('/admin/documents/new?type=seal&lang=id', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toContainText('A PDF that already carries a cryptographic signature is refused')   // the one limit, said before anything is done
    await page.fill('input[name=source_title]', 'Certificate of Origin'); await page.fill('input[name=source_issuer]', 'Kamar Dagang Contoh')
    await page.fill('input[name=source_reference]', 'COO-2026-0042')
    await page.fill('input[name=signatory_name]', 'Siti Rahma'); await page.fill('input[name=signatory_title]', 'Direktur')
    await page.click('button:has-text("Save draft")', { noWaitAfter: true })
    await expect(page.locator('input[name=source_pdf]:invalid')).toHaveCount(1)                            // no file yet: the browser stops the form
    await page.setInputFiles('input[name=source_pdf]', { name: 'coo.pdf', mimeType: 'application/pdf', buffer: original })
    // The seal is dragged onto the page, which is drawn here from the chosen file.
    const stage = page.locator('.seal-stage'); const box = page.locator('.seal-box')
    await expect(stage.locator('canvas')).toBeVisible()
    await expect(page.locator('.seal-pager')).toContainText('Page 2 of 2')                                 // "last page" is the default, so the last page is shown
    await stage.scrollIntoViewIfNeeded()                                                                    // as a person scrolls down to the page
    const before = (await box.boundingBox())!
    const page0 = (await stage.boundingBox())!
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(page0.x + page0.width * 0.35, page0.y + page0.height * 0.45, { steps: 8 })
    await page.mouse.up()
    const dropped = (await box.boundingBox())!
    const fx = (dropped.x - page0.x) / page0.width, fy = (dropped.y - page0.y) / page0.height
    expect(fx).toBeGreaterThan(0.1); expect(fx).toBeLessThan(0.45); expect(fy).toBeGreaterThan(0.3); expect(fy).toBeLessThan(0.55)          // it moved off the corner, to where the mouse was released
    await expect(page.locator('input[name=corner]')).toHaveValue('custom')
    expect(Math.abs(Number(await page.locator('input[name=pos_x]').inputValue()) - fx)).toBeLessThan(0.01)         // and the form carries exactly that position
    expect(Math.abs(Number(await page.locator('input[name=pos_y]').inputValue()) - fy)).toBeLessThan(0.01)
    await box.focus(); await page.keyboard.press('ArrowRight')                                             // the arrow keys move it too
    expect(Number(await page.locator('input[name=pos_x]').inputValue())).toBeGreaterThan(fx)
    await page.click('button:has-text("Previous page")')
    await expect(page.locator('.seal-pager')).toContainText('no mark on this page')
    await page.click('button:has-text("Next page")')
    const pos = { x: Number(await page.locator('input[name=pos_x]').inputValue()), y: Number(await page.locator('input[name=pos_y]').inputValue()) }
    await page.click('button:has-text("Save draft")', { noWaitAfter: true })
    await expect(page.locator('.alert[role=alert]')).toContainText('Confirm where the VORA mark goes')      // nothing is saved until the placement is confirmed
    await page.click('[data-testid=seal-confirm]')
    await expect(page.locator('[data-testid=seal-status]')).toContainText('Confirmed')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/documents\/\d+/)
    sealId = page.url().match(/documents\/(\d+)/)![1]
    expect(await scalar(`select fields->'values'->>'corner' from documents where id = ${sealId}`)).toBe('custom')
    expect(Math.abs(Number(await scalar(`select fields->'values'->>'pos_x' from documents where id = ${sealId}`)) - pos.x)).toBeLessThan(0.0002)
    await expect(page.locator('body')).toContainText(sha(original))                                         // the fingerprint of what arrived
    const preview = await page.request.get(`/admin/documents/${sealId}/pdf`)
    expect(preview.status()).toBe(200)
    expect((await preview.body()).subarray(0, 5).toString()).toBe('%PDF-')
    expect(await page.request.get(`/admin/documents/${sealId}/source`).then((r) => r.body())).toEqual(original)   // the original is available unchanged
    await page.click('button:has-text("Issue document")')
    await expect(page.locator('h3 .status').first()).toContainText(/issued/i)
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
    await expect(body).toContainText('ISSUANCE RECORD FOUND')
    await expect(body).toContainText('Certificate of Origin')
    await expect(body).toContainText('Kamar Dagang Contoh')
    await expect(body).not.toContainText('Siti Rahma')                                                      // an intended signatory is a note, not a signing: nobody has signed
    await expect(body).toContainText('No personal signature recorded')
    await expect(body).toContainText(sealedHash); await expect(body).toContainText(sha(original))
    const check = visitor.page.locator('#file-check')
    await check.setInputFiles({ name: 'sealed.pdf', mimeType: 'application/pdf', buffer: Buffer.from(sealedBytes) })
    await expect(visitor.page.locator('[role=status]').last()).toContainText('matches the exact file recorded by VORA')
    await check.setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: original })
    await expect(visitor.page.locator('[role=status]').last()).toContainText('matches the original PDF received before')
    await check.setInputFiles({ name: 'other.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from(sealedBytes), Buffer.from(' ')]) })
    await expect(visitor.page.locator('[role=status]').last()).toContainText('does not match the registered document')
    expect(uploads, 'the file is compared in the browser and never sent').toEqual([])
    expect(await visitor.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    await visitor.context.close()
  })

  await test.step('voiding the seal withdraws the file and the verification', async () => {
    await page.goto(`/admin/documents/${sealId}`)
    await page.click('button:has-text("Void")')
    await confirmAsked(page)
    await expect(page.locator('h3 .status').first()).toContainText(/void/i)
    expect((await page.request.get(`/admin/documents/${sealId}/pdf`)).status()).toBe(409)
    const token = await scalar(`select token from document_verification_tokens where kind='document' and document_id=${sealId}`)
    const visitor = await openContext(browser)
    await visitor.page.goto(`${BASE_URL}/verify/${token}`)
    await expect(visitor.page.locator('body')).toContainText('REVOKED')
    await expect(visitor.page.locator('#file-check')).toHaveCount(0)
    await visitor.context.close()
  })

  expect(problems, 'no console errors, failed requests or 5xx answers').toEqual([])
  await context.close()
})
