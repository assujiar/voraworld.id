import { expect, test } from '@playwright/test'
import { BASE_URL, fillItems, openContext, overflow, phone, received, scalar, sign, signIn, trackProblems, confirmAsked } from './helpers'

/**
 * PATH B, the whole commercial workflow in a real browser against the Server Actions of a production build, with NO LEAD anywhere:
 * customer entered by hand -> quotation -> customer signs -> VORA validates -> delivery note -> proof of delivery on a phone ->
 * invoice (a refused form keeps what was typed) -> one email with both PDFs -> payment claim -> "Konfirmasi Dana Diterima" ->
 * e-meterai -> official receipt and its email -> QR pages -> phone widths.
 */
test('Path B: customer, quotation, validation, delivery, invoice, payment and receipt, without a lead', async ({ browser }) => {
  test.setTimeout(420_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true })
  const notice = () => page.locator('.alert').first()
  const status = () => page.locator('h3 .status').first()
  let customerId = '', invoiceId = '', receiptId = '', quotationId = '', prepaymentId = '', deliveryId = ''
  const leadsBefore = await scalar('select count(*) from leads')

  await signIn(page)

  await test.step('customer', async () => {
    await page.goto('/admin/customers/new')
    await page.fill('input[name=name]', 'PT Browser Customer')
    await page.fill('input[name=email]', 'billing@browser.example')
    await page.fill('textarea[name=address]', 'Jl. Browser 7\nJakarta')
    await page.fill('input[name=phone]', '+62 21 5550 100')
    await page.fill('input[name=pic_name]', 'Siti Rahma')
    await page.fill('input[name=pic_position]', 'Finance Director')
    await page.fill('input[name=pic_email]', 'siti@browser.example')
    await page.fill('input[name=pic_phone]', '+62 812 7000 1234')
    await page.click('button:has-text("Save customer")')
    await page.waitForURL(/\/admin\/customers\/\d+/)
    await expect(notice()).toContainText('Customer saved')
    await expect(page.locator('body')).toContainText(/\bC[0-9A-F]{10}\b/)         // the permanent owner code
    customerId = page.url().match(/customers\/(\d+)/)![1]
    await expect(page.locator('body')).toContainText('No lead is linked')          // entered directly, and that is complete
    for (const label of ['Buat Quotation', 'Lihat Quotations', 'Lihat Delivery Notes', 'Lihat Invoices', 'Lihat Pembayaran', 'Lihat Dokumen Terkait']) {
      await expect(page.locator(`.inline-actions a:has-text("${label}")`).first()).toBeVisible()
    }
  })

  await test.step('a customer who looks like an existing one is not saved silently; the directory finds a customer by contact person and phone', async () => {
    await page.goto('/admin/customers/new')
    await page.fill('input[name=name]', 'PT Browser Customer')
    await page.fill('input[name=email]', 'billing@browser.example')
    await page.click('button:has-text("Save customer")')
    await expect(page.locator('.alert[role=alert]')).toContainText('A similar customer already exists')
    expect(await scalar("select count(*) from customers where lower(name) = 'pt browser customer'")).toBe('1')
    for (const q of ['Siti Rahma', '7000 1234', 'siti@browser.example']) {
      await page.goto(`/admin/customers?q=${encodeURIComponent(q)}`)
      await expect(page.locator('table').first()).toContainText('PT Browser Customer')
    }
  })

  await test.step('bank accounts: the first one becomes preferred, there is only ever one', async () => {
    await page.goto('/admin/bank-accounts')
    await page.fill('input[name=bank_name]', 'Bank Browser')
    await page.fill('input[name=account_number]', '5550001234')
    await page.fill('input[name=account_holder]', 'PT Satu Arah International')
    await page.click('button:has-text("Add account")')
    await expect(page.locator('.alert:has-text("Bank account saved")')).toBeVisible()
    await expect(page.locator('body')).toContainText('PREFERRED')
    await page.fill('input[name=bank_name] >> nth=0', 'Bank Browser Two')                // the add form is the first form on the page
    await page.fill('input[name=account_number] >> nth=0', '5550009999')
    await page.fill('input[name=account_holder] >> nth=0', 'PT Satu Arah International')
    await page.click('button:has-text("Add account")')
    await expect(page.locator('body')).toContainText('Bank Browser Two')                    // the first notice is still on screen until the page reloads: wait for the second account itself
    await expect(page.locator('.status:has-text("PREFERRED")')).toHaveCount(1)
  })

  await test.step('SMTP and the email rules this workflow uses are switched on', async () => {
    await page.goto('/admin/mail')
    await page.fill('input[name=host]', 'smtp.example.invalid')
    await page.fill('input[name=username]', 'u')
    await page.fill('input[name=password]', 'secret-pass')
    await page.check('input[name=enabled]')
    await page.click('button:has-text("Save SMTP settings")')
    await expect(page.locator('.alert:has-text("SMTP configuration saved")')).toBeVisible()
    expect((await page.content()).includes('secret-pass')).toBe(false)                         // the password is never shown again
    for (const rule of ['quotation_approval_request', 'quotation_customer_approved_admin', 'quotation_validated_customer', 'invoice_customer', 'receipt_customer']) {
      await page.locator(`tr[data-key="${rule}"] button:has-text("Enable")`).click()
      await expect.poll(() => scalar(`select enabled from email_rules where key = '${rule}'`)).toBe('true')
    }
  })

  await test.step('quotation made straight from the customer: Buat Quotation, a structured table, no lead', async () => {
    await page.goto(`/admin/customers/${customerId}`)
    await page.click('a:has-text("Buat Quotation")')
    await page.waitForURL(/\/admin\/quotations\/new\?customer=\d+/)
    await expect(page.locator('body')).toContainText('no lead (entered directly)')
    await expect(page.locator('input[name=pic_name]')).toHaveValue('Siti Rahma')               // the customer's contact fills the quotation
    await fillItems(page, ['description', 'quantity', 'unit', 'price'], [['Air freight', '100', 'kg', '250000'], ['Customs clearance', '1', 'job', '500000']], 'Add charge')
    await page.fill('input[name=valid_until]', '2999-01-01')
    await page.fill('input[name=origin]', 'Jakarta'); await page.fill('input[name=destination]', 'Singapore')
    await page.fill('textarea[name=payment_terms]', '')
    await page.click('button:has-text("Save quotation draft")')
    await expect(page.locator('textarea[name=payment_terms]:invalid')).toHaveCount(1)          // both terms are required: the browser stops an empty form
    await page.fill('textarea[name=payment_terms]', '50% on approval, the balance within 14 days of the invoice date.')
    await page.fill('textarea[name=terms_conditions]', '1. Rates exclude duties and taxes.\n2. Services follow the VORA booking conditions.')
    await page.click('button:has-text("Save quotation draft")')
    await page.waitForURL(/\/admin\/quotations\/\d+/)
    await expect(notice()).toContainText('Quotation draft created')
    await expect(page.locator('body')).toContainText('Customs clearance')
    await expect(page.locator('body')).toContainText('50% on approval, the balance within 14 days')
    quotationId = page.url().match(/quotations\/(\d+)/)![1]
    expect(await scalar(`select coalesce(lead_id::text, 'none') || ':' || customer_id from quotations where id = ${quotationId}`)).toBe(`none:${customerId}`)
    await expect(status()).toContainText('Draft')
  })

  await test.step('issue it; the customer signs on a phone; an upload approves nothing until VORA validates it', async () => {
    await page.click('button:has-text("Issue quotation")')
    await expect(page.locator('.alert:has-text("Quotation state updated")')).toBeVisible()
    await expect(status()).toContainText('Issued')
    await page.click('button:has-text("Send quotation for customer approval")')
    await expect(notice()).toContainText('Approval email queued')
    await expect(status()).toContainText('Awaiting customer approval')
    const html = await scalar("select html from email_jobs where event='quotation_approval_request' order by id desc limit 1")
    const link = html.match(/href="([^"]*quotation-approval\/[^"]+)"/)?.[1]
    expect(link, 'the email carries the private link').toBeTruthy()

    const customer = await openContext(browser, 390, 900)
    const cp = customer.page
    trackProblems(cp, 'customer', problems, { strict4xx: true })
    await cp.goto(link!.replace(/^https?:\/\/[^/]+/, BASE_URL).replace(/&amp;/g, '&'))
    await expect(cp.locator('body')).toContainText('Review and approve the Price Agreement Letter')
    await expect(cp.locator('body')).toContainText('What your signature accepts')              // the terms are shown before anything is signed
    await expect(cp.locator('body')).toContainText('50% on approval, the balance within 14 days')
    await expect(cp.locator('body')).toContainText('2. Services follow the VORA booking conditions.')
    expect(await overflow(cp)).toBeLessThanOrEqual(1)                                          // fits a phone
    const quotePdf = await cp.request.get(cp.url() + '/pdf')
    expect(quotePdf.status()).toBe(200)
    await cp.fill('input[name=signer_name]', 'Siti Rahma')
    await cp.fill('input[name=signer_title]', 'Finance Director')
    await cp.setInputFiles('input[name=signed_pdf]', { name: 'wrong.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4'.padEnd(400, ' ')) })
    await cp.check('input[name=ack]')
    await cp.click('button:has-text("Submit for VORA review")')
    await expect(cp.locator('.alert[role=alert]')).toContainText(/exact VORA quotation number|damaged|PDF/)
    await cp.setInputFiles('input[name=signed_pdf]', { name: 'signed.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await quotePdf.body()) })
    await cp.fill('input[name=signer_name]', 'Siti Rahma')
    await cp.fill('input[name=signer_title]', 'Finance Director')
    await cp.check('input[name=ack]')
    await cp.click('button:has-text("Submit for VORA review")')
    await expect(cp.locator('.alert:has-text("Document received")')).toBeVisible()
    await expect(cp.locator('input[name=signer_name]')).toHaveCount(0)                         // the form disappears after submission
    await customer.context.close()

    await page.goto(`/admin/quotations/${quotationId}`)
    await expect(status()).toContainText('Approved by customer')                              // approved by the customer is NOT validated
    expect(await scalar(`select status from quotations where id = ${quotationId}`)).toBe('customer_approved')
    await expect(page.locator('body')).not.toContainText('New delivery note')                 // nothing can be delivered or billed yet
    await expect.poll(() => scalar("select count(*) from email_jobs where event = 'quotation_customer_approved_admin'")).toBe('1')   // the admin is told about the upload
    expect(await scalar("select count(*) from email_jobs where event = 'quotation_validated_customer'")).toBe('0')                    // the customer is not told about a validation that has not happened
    await page.click('button:has-text("Validate Quotation")')                                  // the review tick is missing: the server refuses
    await expect(page.locator('.alert[role=alert]')).toContainText('reviewed manually')
    await page.check('input[name=signature_and_stamp_verified]')
    await page.click('button:has-text("Validate Quotation")')
    await expect(page.locator('.alert:has-text("Quotation validated")')).toBeVisible()
    await expect(status()).toContainText('Validated')
    await expect.poll(() => scalar("select count(*) from email_jobs where event = 'quotation_validated_customer'")).toBe('1')          // now the customer is told
    const approvalId = await scalar('select id from quotation_approvals limit 1')
    const signed = await page.request.get(`/admin/quotation-approvals/${approvalId}/file`)
    expect(signed.status()).toBe(200)
    expect((await signed.body()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  await test.step('a delivery note from the validated quotation; the driver records the proof on a phone', async () => {
    await page.click('a:has-text("New delivery note")')
    await page.waitForURL(/\/admin\/deliveries\/new\?customer=\d+&quotation=\d+/)
    await expect(page.locator('input[name=origin]')).toHaveValue('Jakarta')                    // prefilled from the quotation
    await expect(page.locator('input[name=consignee_name]')).toHaveValue('PT Browser Customer')
    await fillItems(page, ['description', 'quantity', 'unit', 'remarks'], [['Cartons of spare parts', '24', 'ctn', 'fragile']], 'Add cargo item')
    await page.click('button:has-text("Save draft")')
    await page.waitForURL(/\/admin\/deliveries\/\d+(\?|$)/)
    deliveryId = page.url().match(/deliveries\/(\d+)/)![1]
    expect(await scalar(`select customer_id || ':' || quotation_id from deliveries where id = ${deliveryId}`)).toBe(`${customerId}:${quotationId}`)
    await page.click('button:has-text("Issue delivery note")')
    await expect(page.locator('h3 .status')).toContainText('issued')
    const pod = (await page.locator('a[href^="/pod/"]').first().getAttribute('href'))!
    const driver = await phone(browser, true)
    trackProblems(driver.page, 'driver', problems, { strict4xx: true })
    await driver.page.goto(pod)
    await sign(driver.page, 'Siti Aminah')
    await driver.page.click('button:has-text("Send proof of delivery")')
    await received(driver.page)
    await driver.context.close()
    await page.goto(`/admin/deliveries/${deliveryId}`)
    await expect(page.locator('h3 .status').first()).toContainText('delivered')
  })

  await test.step('a refused invoice form keeps everything that was typed', async () => {
    await page.goto(`/admin/quotations/${quotationId}`)
    await page.click('a:has-text("New invoice")')                                              // customer and quotation are carried over; now the delivery notes
    await page.waitForURL(/\/admin\/invoices\/new\?customer=\d+&quotation=\d+/)
    await expect(page.locator('input[name=delivery]')).toBeChecked()
    await page.click('button:has-text("Continue")')
    await expect(page.locator('input[name=bank_account_ids]')).toHaveCount(2)                 // both IDR accounts are offered
    await expect(page.locator('input[name=item_description]').first()).toHaveValue('Air freight')   // the charges start from the quotation
    await page.waitForLoadState('networkidle')
    await page.fill('input[name=tax_percent]', '150')
    await page.fill('input[name=po_number]', 'PO-BROWSER-1')
    await page.locator('input[name=item_description]').nth(1).fill('Customs clearance (edited)')
    await page.check('input[name=bank_account_ids] >> nth=1')
    await page.click('button:has-text("Create invoice")')
    await expect(page.locator('.alert[role=alert]')).toContainText('Tax percentage out of range')
    await expect(page.locator('input[name=item_description]').nth(1)).toHaveValue('Customs clearance (edited)')   // the typed rows are back
    await expect(page.locator('input[name=po_number]')).toHaveValue('PO-BROWSER-1')
    await expect(page.locator('input[name=bank_account_ids] >> nth=1')).toBeChecked()
    await page.fill('input[name=tax_percent]', '11')
    await page.click('button:has-text("Create invoice")')
    await page.waitForURL(/\/admin\/invoices\/\d+/)
    await expect(notice()).toContainText('Invoice draft created')
    invoiceId = page.url().match(/invoices\/(\d+)/)![1]
    await expect(page.locator('body')).toContainText('Bank Browser Two')                      // the chosen account is on the invoice
    expect(await scalar(`select quotation_id || ':' || customer_id from invoices where id = ${invoiceId}`)).toBe(`${quotationId}:${customerId}`)
    expect(await scalar(`select count(*) from invoice_delivery_notes where invoice_id = ${invoiceId} and delivery_id = ${deliveryId} and released_at is null`)).toBe('1')
    await expect(page.locator(`a[href="/admin/quotations/${quotationId}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="/admin/deliveries/${deliveryId}"]`).first()).toBeVisible()
  })

  let total = 0
  await test.step('issue; the package is refused while the pre-payment receipt waits for its e-meterai; a payment claim leaves the balance alone', async () => {
    await page.click('button:has-text("Issue invoice")')
    await expect(page.locator('.alert:has-text("Invoice state updated")')).toBeVisible()
    await expect(status()).toContainText('Issued')
    await page.click('button:has-text("Kirim Invoice & Pre-Payment Receipt")')
    await expect(page.locator('.alert[role=alert]')).toContainText('waiting for its e-meterai')   // blocked as a whole: nothing was sent
    expect(await scalar("select count(*) from email_jobs where event = 'invoice_customer'")).toBe('0')
    total = Number(await scalar(`select total_minor from invoices where id=${invoiceId}`))
    const pay = page.locator('form:has(input[name=amount])')
    await pay.locator('input[name=amount]').fill('6000000')
    await pay.locator('select[name=receiving_bank_id]').selectOption({ index: 1 })
    await pay.locator('input[name=reference]').fill('TRX-BROWSER-1')
    await pay.locator('button:has-text("Save payment")').click()
    await expect(page.locator('.alert:has-text("waiting for bank confirmation")')).toBeVisible()
    expect(await scalar(`select outstanding_minor from invoices where id=${invoiceId}`)).toBe(String(total))
    await expect(page.locator('body')).toContainText('Menunggu Konfirmasi Pembayaran')
    await page.fill('input[name=amount]', '999999999999')
    await page.click('button:has-text("Save payment")')
    await expect(page.locator('.alert[role=alert]')).toContainText('exceeds the unreserved')
    await expect(page.locator('input[name=amount]')).toHaveValue('999999999999')               // what was typed is still there
  })

  await test.step('the pre-payment receipt waits for its e-meterai, then is checked, stored and released; then ONE email carries both PDFs', async () => {
    await page.goto(`/admin/invoices/${invoiceId}`)
    const panel = page.locator('.admin-panel:has(> h4:has-text("Pre-payment receipt"))')
    await expect(panel).toContainText(/PPR-VORA-C[0-9A-F]{10}-\d{6}-\d{5}/)
    await expect(panel).toContainText('pending stamp'); await expect(panel).toContainText('needs a manual e-meterai')
    await panel.locator('a[href^="/admin/prepayment-receipts/"]:not([href$="/pdf"])').click()
    await page.waitForURL(/\/admin\/prepayment-receipts\/\d+$/)
    prepaymentId = page.url().match(/prepayment-receipts\/(\d+)/)![1]
    const draft = await page.request.get(`/admin/prepayment-receipts/${prepaymentId}/pdf`)
    expect(draft.status()).toBe(200)
    const bytes = await draft.body()
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    await page.fill('input[name=stamp_provider_reference]', 'PERURI-BROWSER-PRE-01')
    await page.setInputFiles('input[name=stamped_pdf]', { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 not really a pdf'.padEnd(400)) })
    await page.check('input[name=approved]')
    await page.click('button:has-text("Save final stamped pre-payment receipt")')
    await expect(page.locator('.alert[role=alert]')).toContainText(/Only PDF documents|Invalid or damaged|must retain/)
    await page.setInputFiles('input[name=stamped_pdf]', { name: 'stamped.pdf', mimeType: 'application/pdf', buffer: bytes })
    await page.check('input[name=approved]')
    await page.fill('input[name=stamp_provider_reference]', 'PERURI-BROWSER-PRE-01')
    await page.click('button:has-text("Save final stamped pre-payment receipt")')
    await expect(page.locator('.alert:has-text("Stamped pre-payment receipt stored")')).toBeVisible()
    expect(await scalar(`select status from prepayment_receipts where id=${prepaymentId}`)).toBe('issued')
    const released = await page.request.get(`/admin/prepayment-receipts/${prepaymentId}/pdf`)
    expect(Buffer.from(await released.body()).equals(Buffer.from(bytes))).toBe(true)

    await page.goto(`/admin/invoices/${invoiceId}`)
    await page.click('button:has-text("Kirim Invoice & Pre-Payment Receipt")')
    await expect(notice()).toContainText('queued as one email with two PDFs')
    expect(await scalar("select count(*) from email_jobs where event = 'invoice_customer'")).toBe('1')
    expect(await scalar("select count(*) from email_job_attachments a join email_jobs j on j.id = a.job_id where j.event = 'invoice_customer'")).toBe('2')
    expect(await scalar("select string_agg(a.kind, ',' order by a.position) from email_job_attachments a join email_jobs j on j.id = a.job_id where j.event = 'invoice_customer'")).toBe('invoice,prepayment')
  })

  await test.step('cleared funds above IDR 5,000,000 lead to a receipt that waits for its e-meterai', async () => {
    await page.goto(`/admin/invoices/${invoiceId}`)
    const confirm = page.locator('form:has(input[name=funds_cleared])')
    await confirm.locator('button:not(.confirm-yes):has-text("Konfirmasi Dana Diterima")').click()               // the checkbox is `required`: the browser blocks it
    expect(await scalar('select status from payments order by id limit 1')).toBe('pending_confirmation')
    await confirm.locator('input[name=funds_cleared]').check()
    await confirm.locator('button:not(.confirm-yes):has-text("Konfirmasi Dana Diterima")').click()
    await expect(page.locator('dialog[open]')).toContainText('Konfirmasi dana sudah diterima?')       // the question comes first; nothing has been confirmed yet
    expect(await scalar('select status from payments order by id limit 1')).toBe('pending_confirmation')
    await confirmAsked(page)
    await page.waitForURL(/\/admin\/receipts\/\d+/)
    await expect(notice()).toContainText('needs a manual e-meterai')
    receiptId = page.url().match(/receipts\/(\d+)/)![1]
    await expect(page.locator('body')).toContainText(/pending stamp/i)
    expect(await scalar("select count(*) from email_jobs where event = 'receipt_customer'")).toBe('0')    // no receipt email before the receipt is released
  })

  await test.step('the stamped PDF is checked, stored privately and released; the receipt email is queued once and can be sent again', async () => {
    const draft = await page.request.get(`/admin/receipts/${receiptId}/pdf`)
    expect(draft.status()).toBe(200)
    const bytes = await draft.body()
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    await page.fill('input[name=stamp_provider_reference]', 'PERURI-BROWSER-01')
    await page.setInputFiles('input[name=stamped_pdf]', { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 not really a pdf'.padEnd(400)) })
    await page.check('input[name=approved]')
    await page.click('button:has-text("Save final stamped receipt")')
    await expect(page.locator('.alert[role=alert]')).toContainText(/Only PDF documents|Invalid or damaged|must retain/)   // a fake PDF is refused
    await page.setInputFiles('input[name=stamped_pdf]', { name: 'stamped.pdf', mimeType: 'application/pdf', buffer: bytes })
    await page.check('input[name=approved]')
    await page.fill('input[name=stamp_provider_reference]', 'PERURI-BROWSER-01')
    await page.click('button:has-text("Save final stamped receipt")')
    await expect(page.locator('.alert:has-text("Stamped receipt stored")')).toBeVisible()
    expect(await scalar(`select status from receipts where id=${receiptId}`)).toBe('issued')
    await expect(page.locator('body')).toContainText(/sha256|SHA-256/)
    const released = await page.request.get(`/admin/receipts/${receiptId}/pdf`)
    expect(Buffer.from(await released.body()).equals(Buffer.from(bytes))).toBe(true)         // the released file is exactly the stored stamped file
    const receiptNumber = await scalar(`select number from receipts where id=${receiptId}`)
    expect(await scalar("select count(*) from email_jobs where event = 'receipt_customer'")).toBe('1')
    expect(await scalar("select subject from email_jobs where event = 'receipt_customer'")).toBe(`VORA | Payment Receipt ${receiptNumber}`)
    await page.click('button:has-text("Send the receipt to the customer again")')
    await expect(notice()).toContainText('queued again')
    expect(await scalar("select count(*) from email_jobs where event = 'receipt_customer'")).toBe('2')
  })

  await test.step('a second payment settles the invoice', async () => {
    await page.goto(`/admin/invoices/${invoiceId}`)
    const remaining = Number(await scalar(`select outstanding_minor from invoices where id=${invoiceId}`))
    const pay = page.locator('form:has(input[name=amount])')
    await pay.locator('input[name=amount]').fill(String(remaining))
    await pay.locator('input[name=method]').fill('cash')
    await pay.locator('button:has-text("Save payment")').click()
    await expect(page.locator('.alert:has-text("waiting for bank confirmation")')).toBeVisible()
    const confirm = page.locator('form:has(input[name=funds_cleared])').first()
    await confirm.locator('input[name=funds_cleared]').check()
    await confirm.locator('button:not(.confirm-yes):has-text("Konfirmasi Dana Diterima")').click()
    await confirmAsked(page)
    await page.waitForLoadState('networkidle')
    await page.goto(`/admin/invoices/${invoiceId}`)
    await expect(status()).toContainText('Paid')
    expect(await scalar(`select outstanding_minor from invoices where id=${invoiceId}`)).toBe('0')
    await page.goto('/admin/receipts')
    await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(2)               // the payment receipts; the pre-payment receipts are in the table below
    await expect(page.locator('table').nth(1).locator('tbody tr')).toHaveCount(1)
  })

  await test.step('no lead was created or needed anywhere on this path', async () => {
    expect(await scalar('select count(*) from leads')).toBe(leadsBefore)
    expect(await scalar(`select count(*) from leads where customer_id = ${customerId}`)).toBe('0')
  })

  await test.step('the QR pages answer anonymously and fit a phone', async () => {
    const visitor = await openContext(browser, 390, 800)
    trackProblems(visitor.page, 'verify', problems, { strict4xx: true })
    for (const [kind, id] of [['invoice', invoiceId], ['receipt', receiptId], ['quotation', quotationId], ['prepayment', prepaymentId]]) {
      const token = await scalar(`select token from document_verification_tokens where kind='${kind}' and document_id=${id}`)
      await visitor.page.goto(`/verify/${token}`)
      await expect(visitor.page.locator('body')).toContainText('AUTHENTIC')
      expect(await overflow(visitor.page), `${kind} verification page`).toBeLessThanOrEqual(1)
    }
    await visitor.context.close()
  })

  await test.step('every commercial page fits a phone', async () => {
    const phoneView = await openContext(browser, 390, 900)
    trackProblems(phoneView.page, 'mobile', problems, { strict4xx: true })
    await signIn(phoneView.page)
    for (const p of ['/admin/customers', `/admin/customers/${customerId}`, '/admin/bank-accounts', '/admin/quotations', `/admin/quotations/${quotationId}`, `/admin/quotations/new?customer=${customerId}`,
      '/admin/deliveries', `/admin/deliveries/${deliveryId}`, `/admin/deliveries/new?customer=${customerId}&quotation=${quotationId}`,
      '/admin/invoices', `/admin/invoices/${invoiceId}`, `/admin/invoices/new?customer=${customerId}&quotation=${quotationId}`, '/admin/receipts', `/admin/receipts/${receiptId}`, `/admin/prepayment-receipts/${prepaymentId}`]) {
      await phoneView.page.goto(p, { waitUntil: 'networkidle' })
      expect(await overflow(phoneView.page), p).toBeLessThanOrEqual(1)
    }
    await phoneView.context.close()
  })

  expect(problems, 'no console errors, failed requests or 5xx answers').toEqual([])
  await context.close()
})
