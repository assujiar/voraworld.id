import { expect, test, type Browser } from '@playwright/test'
import sharp from 'sharp'
import { BASE_URL, openContext, scalar, signIn, trackProblems } from './helpers'

/**
 * A delivery note written in the browser, issued, and recorded on a driver's phone: the driver scans the QR address, the receiver gives their
 * name and signs on that screen, the driver adds a photo and (if they allow it) shares their location. The admin then sees the evidence,
 * the consignee's view works, a wrong proof can be rejected and the same QR address can be used again.
 */
const photo = () => sharp({ create: { width: 640, height: 480, channels: 3, background: '#7a8c6e' } }).jpeg({ quality: 70 }).toBuffer()

async function phone(browser: Browser, allowLocation: boolean) {
  const context = await browser.newContext({
    baseURL: BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ...(allowLocation ? { geolocation: { latitude: -6.2088, longitude: 106.8456, accuracy: 20 }, permissions: ['geolocation'] } : {}),
  })
  return { context, page: await context.newPage() }
}

/** The form was accepted: the thank-you appears. If it does not, the refusal the form showed is the failure. */
async function received(page: import('@playwright/test').Page) {
  try {
    await expect(page.locator('div[role=status]')).toContainText('The delivery of')
  } catch (e) {
    throw new Error(`the form was refused: ${(await page.locator('.alert[role=alert]').allInnerTexts()).join(' / ') || 'no message'}\n${e}`)
  }
}

async function sign(page: import('@playwright/test').Page, name: string) {
  await page.waitForLoadState('networkidle')                                      // the page is interactive: strokes before that would be lost
  await page.fill('#courierName', 'Asep Kurniawan')                               // the driver, who holds the phone
  await page.fill('#courierPhone', '0812 1111 2222')
  await page.fill('#receiverName', name)                                           // the receiver, who signs on the driver's phone
  await page.fill('#receiverPosition', 'Warehouse head')
  await page.fill('#receiverPhone', '+62 812 3456 789')
  await page.locator('canvas').scrollIntoViewIfNeeded()                          // the mouse works in viewport coordinates
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + 30, box.y + 40)
  await page.mouse.down()
  for (let i = 1; i <= 24; i++) await page.mouse.move(box.x + 30 + i * 9, box.y + 40 + Math.sin(i / 2) * 30)
  await page.mouse.up()
  await page.setInputFiles('#photos', { name: 'goods.jpg', mimeType: 'image/jpeg', buffer: await photo() })
  await expect(page.locator('img[alt="Photo 1"]')).toBeVisible()
}

test('a delivery note is issued, signed for on a phone, and its proof is checked', async ({ browser }) => {
  test.setTimeout(240_000)
  const problems: string[] = []
  const { context: adminContext, page: admin } = await openContext(browser)
  trackProblems(admin, 'admin', problems, { strict4xx: true })
  await signIn(admin)

  let id = '', link = '', number = ''
  await test.step('a draft is written, a refusal keeps what was typed, and it is issued', async () => {
    await admin.goto('/admin/deliveries/new')
    await admin.fill('input[name=consignee_name]', 'PT Penerima Jaya')
    await admin.fill('input[name=consignee_email]', 'gudang@penerima.example')
    await admin.fill('input[name=destination]', 'Bekasi')
    await admin.click('button:has-text("Save draft")')                                                               // no items yet
    await expect(admin.locator('.alert[role=alert]')).toContainText('at least one item')
    await expect(admin.locator('input[name=consignee_name]')).toHaveValue('PT Penerima Jaya')
    await admin.fill('textarea[name=items]', 'Cartons of spare parts | 24 | ctn | fragile\nPallet of cables | 2')
    await admin.click('button:has-text("Save draft")')
    await admin.waitForURL(/\/admin\/deliveries\/\d+(\?|$)/)
    id = admin.url().match(/deliveries\/(\d+)/)![1]
    number = (await admin.locator('h3').first().innerText()).split(/\s/)[0]
    expect(number).toMatch(/^DLV-VORA-V[0-9A-F]{10}-\d{6}-\d{5}$/)
    await expect(admin.locator('h3 .status')).toContainText('draft')
    expect((await admin.request.get(`/admin/deliveries/${id}/pdf`)).headers()['content-type']).toBe('application/pdf')
    await admin.click('button:has-text("Issue delivery note")')
    await expect(admin.locator('h3 .status')).toContainText('issued')
    link = (await admin.locator('a[href^="/pod/"]').first().getAttribute('href'))!
    expect(link).toMatch(/^\/pod\/[A-Za-z0-9_-]{40,}$/)
  })

  await test.step('on the phone: the page may ask for the location, is not indexed, and refuses an empty form', async () => {
    const { context, page } = await phone(browser, true)
    trackProblems(page, 'phone', problems, { strict4xx: true })
    const res = await page.goto(link)
    expect(res!.headers()['permissions-policy']).toContain('geolocation=(self)')
    expect(res!.headers()['x-robots-tag']).toContain('noindex')
    await expect(page.locator('h1')).toContainText(number)
    await expect(page.locator('body')).toContainText('Cartons of spare parts')
    await page.click('button:has-text("Send proof of delivery")')
    await expect(page.locator('.alert[role=alert]')).toContainText('Sign in the box')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)         // no sideways scrolling on a phone

    await sign(page, 'Siti Aminah')
    await page.click('button:has-text("Share my location")')
    await expect(page.locator('body')).toContainText('Location captured')
    await page.click('button:has-text("Send proof of delivery")')
    await received(page)
    expect(await scalar(`select location_status || ':' || receiver_name from delivery_proofs where delivery_id = ${id}`)).toBe('captured:Siti Aminah')
    expect(Number(await scalar(`select latitude from delivery_proofs where delivery_id = ${id}`))).toBeCloseTo(-6.2088, 3)
    await page.reload()
    await expect(page.locator('body')).toContainText('already been recorded')                                         // the QR code works once
    await context.close()
  })

  let viewLink = ''
  await test.step('the admin sees the evidence; the consignee\'s view and the PDFs work', async () => {
    await admin.goto(`/admin/deliveries/${id}`)
    await expect(admin.locator('h3 .status').first()).toContainText('delivered')
    await expect(admin.locator('body')).toContainText('Siti Aminah')
    await expect(admin.locator('body')).toContainText('Delivered by Asep Kurniawan')
    await expect(admin.locator('body')).toContainText('-6.208800, 106.845600')
    for (const alt of ['Signature', 'Photo 1']) {
      await expect(admin.locator(`img[alt="${alt}"]`)).toBeVisible()
      expect(await admin.locator(`img[alt="${alt}"]`).evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
    }
    expect((await admin.request.get(`/admin/deliveries/${id}/pod-pdf`)).headers()['content-type']).toBe('application/pdf')
    expect((await admin.request.get(`/admin/deliveries/${id}/evidence/signature?proof=999999`)).status()).toBe(404)
    viewLink = (await admin.locator('a[href^="/pod/view/"]').first().getAttribute('href'))!
    const anon = await browser.newContext({ baseURL: BASE_URL })
    const view = await anon.newPage()
    await view.goto(viewLink)
    await expect(view.locator('h1')).toContainText('RECEIVED')
    await expect(view.locator('body')).toContainText('Siti Aminah')
    expect(await view.locator('img[alt="Signature of the receiver"]').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
    expect((await anon.request.get(`/admin/deliveries/${id}/evidence/signature?proof=1`, { maxRedirects: 0 })).status()).not.toBe(200)   // not without signing in
    expect((await anon.request.get(`${viewLink}/evidence/photo-9`)).status()).toBe(404)
    await anon.close()
  })

  await test.step('a wrong proof is rejected, and the same QR address takes a new one, here without sharing the location', async () => {
    await admin.fill('input[name=reason]', 'Signed by the wrong person')
    await admin.click('button:has-text("Reject proof")')
    await expect(admin.locator('.alert').first()).toContainText('QR code can be used again')
    await expect(admin.locator('h3 .status').first()).toContainText('issued')
    const { context, page } = await phone(browser, false)
    trackProblems(page, 'phone2', problems, { strict4xx: true, benign: /geolocation|Geolocation|permission/i })
    await page.goto(link)
    await sign(page, 'Rina Wijaya')
    await page.click('button:has-text("Share my location")')
    await expect(page.locator('body')).toContainText(/not allowed|could not be read/)
    await page.click('button:has-text("Send proof of delivery")')
    await received(page)
    expect(await scalar(`select location_status from delivery_proofs where delivery_id = ${id} and status = 'submitted'`)).toBe('unavailable')
    expect(await scalar(`select count(*) from delivery_proofs where delivery_id = ${id}`)).toBe('2')
    await context.close()
    await admin.goto(`/admin/deliveries/${id}`)
    await expect(admin.locator('body')).toContainText('Location: not shared by the driver')
    await expect(admin.locator('body')).toContainText('Rejected')
  })

  expect(problems).toEqual([])
  await adminContext.close()
})
