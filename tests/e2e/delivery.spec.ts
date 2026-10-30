import { expect, test } from '@playwright/test'
import { BASE_URL, fillItems, openContext, phone, received, scalar, seedValidatedQuotation, sign, signIn, trackProblems, confirmAsked } from './helpers'

/**
 * A delivery note written in the browser, issued, and recorded on a driver's phone: the driver scans the QR address, the receiver gives their
 * name and signs on that screen, the driver adds a photo and the phone's location is recorded (it must be on). The admin then sees the evidence,
 * the consignee's view works, a wrong proof can be rejected and the same QR address can be used again.
 */
test('a delivery note is issued, signed for on a phone, and its proof is checked', async ({ browser }) => {
  test.setTimeout(240_000)
  const problems: string[] = []
  const { context: adminContext, page: admin } = await openContext(browser)
  trackProblems(admin, 'admin', problems, { strict4xx: true })
  await signIn(admin)

  let id = '', link = '', number = ''
  await test.step('a draft is written, a refusal keeps what was typed, and it is issued', async () => {
    const seeded = await seedValidatedQuotation('PT Delivery Customer')
    await admin.goto('/admin/deliveries/new')                                                                         // one screen: the customer, then their validated quotations
    await admin.waitForLoadState('networkidle')
    await expect(admin.locator('select[name=quotation]')).toBeDisabled()                                              // nothing to choose before a customer is
    await expect(admin.locator('button:has-text("Continue")')).toBeDisabled()
    await admin.selectOption('select[name=customer]', seeded.customerId)
    await expect(admin.locator('select[name=quotation]')).toBeEnabled()                                                // the list was read for that customer
    await admin.selectOption('select[name=quotation]', seeded.quotationId)
    await admin.click('button:has-text("Continue")')
    await expect(admin.locator('body')).toContainText(`under quotation ${seeded.number}`)
    await expect(admin.locator('input[name=origin]')).toHaveValue('Jakarta')                                          // prefilled from the quotation
    await admin.fill('input[name=consignee_name]', 'PT Penerima Jaya')
    await admin.fill('input[name=consignee_email]', 'gudang@penerima.example')
    await admin.fill('input[name=destination]', 'Bekasi')
    await admin.click('button:has-text("Save draft")')                                                               // no items yet
    await expect(admin.locator('.alert[role=alert]')).toContainText('at least one item')
    await expect(admin.locator('input[name=consignee_name]')).toHaveValue('PT Penerima Jaya')
    await fillItems(admin, ['description', 'quantity', 'unit', 'remarks'], [['Cartons of spare parts', '24', 'ctn', 'fragile'], ['Pallet of cables', '2', 'pcs', '']], 'Add cargo item')
    await admin.click('button:has-text("Save draft")')
    await admin.waitForURL(/\/admin\/deliveries\/\d+(\?|$)/)
    id = admin.url().match(/deliveries\/(\d+)/)![1]
    number = (await admin.locator('h3').first().innerText()).split(/\s/)[0]
    expect(number).toMatch(/^DLV-VORA-C[0-9A-F]{10}-\d{6}-\d{5}$/)
    await expect(admin.locator('h3 .status')).toContainText(/draft/i)
    expect((await admin.request.get(`/admin/deliveries/${id}/pdf`)).headers()['content-type']).toBe('application/pdf')
    await admin.click('button:has-text("Issue delivery note")')
    await expect(admin.locator('h3 .status')).toContainText(/issued/i)
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
    await expect(page.locator('body')).toContainText('Location on')                  // asked for as soon as the page opened
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
    await expect(admin.locator('h3 .status').first()).toContainText(/delivered/i)
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

  await test.step('a wrong proof is rejected; a phone with location off cannot record the delivery until it is on', async () => {
    await admin.fill('input[name=reason]', 'Signed by the wrong person')
    await admin.click('button:has-text("Reject proof")')
    await confirmAsked(admin)
    await expect(admin.locator('.alert').first()).toContainText('QR code can be used again')
    await expect(admin.locator('h3 .status').first()).toContainText(/issued/i)
    const { context, page } = await phone(browser, false)
    trackProblems(page, 'phone2', problems, { strict4xx: true, benign: /geolocation|Geolocation|permission/i })
    await page.goto(link)
    await expect(page.locator('body')).toContainText(/blocked for this page|could not be read/)
    await sign(page, 'Rina Wijaya')
    await page.click('button:has-text("Send proof of delivery")')
    await expect(page.locator('.alert[role=alert]')).toContainText('Turn on the location')           // refused on the phone itself
    expect(await scalar(`select count(*) from delivery_proofs where delivery_id = ${id} and status = 'submitted'`)).toBe('0')
    await context.grantPermissions(['geolocation'])                                                   // the driver switches the location on
    await context.setGeolocation({ latitude: -6.9175, longitude: 107.6191, accuracy: 15 })
    await page.click('button:has-text("Send proof of delivery")')
    await received(page)
    expect(await scalar(`select location_status from delivery_proofs where delivery_id = ${id} and status = 'submitted'`)).toBe('captured')
    expect(Number(await scalar(`select longitude from delivery_proofs where delivery_id = ${id} and status = 'submitted'`))).toBeCloseTo(107.6191, 3)
    expect(await scalar(`select count(*) from delivery_proofs where delivery_id = ${id}`)).toBe('2')
    await context.close()
    await admin.goto(`/admin/deliveries/${id}`)
    await expect(admin.locator('body')).toContainText('Rejected')
  })

  expect(problems).toEqual([])
  await adminContext.close()
})
