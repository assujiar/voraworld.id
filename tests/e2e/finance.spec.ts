import { expect, test } from '@playwright/test'
import { BASE_URL, openContext, overflow, scalar, signIn, trackProblems } from './helpers'

/**
 * The whole money workflow in a real browser, against the real Server Actions of a production build:
 * customer -> bank accounts -> invoice (a refused form keeps what was typed) -> issue -> payment claim -> confirmation ->
 * e-meterai stamp -> second payment settles the invoice -> quotation + customer approval -> QR pages -> phone widths.
 */
test('the finance workflow, from customer to stamped receipt and signed quotation', async ({ browser }) => {
  test.setTimeout(420_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true })
  const notice = () => page.locator('.alert').first()
  const status = () => page.locator('h3 .status').first()
  let customerId = '', invoiceId = '', receiptId = '', quotationId = ''

  await signIn(page)

  await test.step('customer', async () => {
    await page.goto('/admin/customers/new')
    await page.fill('input[name=name]', 'PT Browser Customer')
    await page.fill('input[name=email]', 'billing@browser.example')
    await page.fill('textarea[name=address]', 'Jl. Browser 7\nJakarta')
    await page.click('button:has-text("Save customer")')
    await page.waitForURL(/\/admin\/customers\/\d+/)
    await expect(notice()).toContainText('Customer saved')
    await expect(page.locator('body')).toContainText(/\bC[0-9A-F]{10}\b/)         // the permanent owner code
    customerId = page.url().match(/customers\/(\d+)/)![1]
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
    await expect(page.locator('.alert:has-text("Bank account saved")')).toBeVisible()
    await expect(page.locator('.status:has-text("PREFERRED")')).toHaveCount(1)
  })

  await test.step('a refused invoice form keeps everything that was typed', async () => {
    await page.goto('/admin/invoices/new')
    await page.selectOption('select[name=customer_id]', customerId)
    await expect(page.locator('input[name=bank_account_ids]')).toHaveCount(2)                 // both IDR accounts are offered
    await page.fill('textarea[name=items]', 'Ocean freight | 1 | 20000000 | shipment\nCustoms | 2 | 500000 | job')
    await page.fill('input[name=tax_percent]', '150')
    await page.fill('input[name=po_number]', 'PO-BROWSER-1')
    await page.check('input[name=bank_account_ids] >> nth=1')
    await page.click('button:has-text("Create invoice")')
    await expect(page.locator('.alert[role=alert]')).toContainText('Tax percentage out of range')
    await expect(page.locator('textarea[name=items]')).toHaveValue(/Customs \| 2 \| 500000/)
    await expect(page.locator('input[name=po_number]')).toHaveValue('PO-BROWSER-1')
    await expect(page.locator('input[name=bank_account_ids] >> nth=1')).toBeChecked()
    expect(page.url().endsWith('/admin/invoices/new')).toBe(true)
    await page.fill('input[name=tax_percent]', '11')
    await page.click('button:has-text("Create invoice")')
    await page.waitForURL(/\/admin\/invoices\/\d+/)
    await expect(notice()).toContainText('Invoice draft created')
    invoiceId = page.url().match(/invoices\/(\d+)/)![1]
    await expect(page.locator('body')).toContainText('Bank Browser Two')                      // the chosen account is on the invoice
  })

  let total = 0
  await test.step('issue, email refused until SMTP is on, payment claim leaves the balance alone', async () => {
    await page.click('button:has-text("Issue invoice")')
    await expect(page.locator('.alert:has-text("Invoice state updated")')).toBeVisible()
    await expect(status()).toContainText('issued')
    await page.click('button:has-text("Email invoice PDF")')
    await expect(page.locator('.alert[role=alert]')).toContainText('Enable SMTP')
    total = Number(await scalar(`select total_minor from invoices where id=${invoiceId}`))
    const pay = page.locator('form:has(input[name=amount])')
    await pay.locator('input[name=amount]').fill('6000000')
    await pay.locator('select[name=receiving_bank_id]').selectOption({ index: 1 })
    await pay.locator('input[name=reference]').fill('TRX-BROWSER-1')
    await pay.locator('button:has-text("Save payment")').click()
    await expect(page.locator('.alert:has-text("waiting for bank confirmation")')).toBeVisible()
    expect(await scalar(`select outstanding_minor from invoices where id=${invoiceId}`)).toBe(String(total))
    await expect(page.locator('body')).toContainText('pending_confirmation')
    await page.fill('input[name=amount]', '999999999999')
    await page.click('button:has-text("Save payment")')
    await expect(page.locator('.alert[role=alert]')).toContainText('exceeds the unreserved')
    await expect(page.locator('input[name=amount]')).toHaveValue('999999999999')               // what was typed is still there
  })

  await test.step('cleared funds above IDR 5,000,000 lead to a receipt that waits for its e-meterai', async () => {
    const confirm = page.locator('form:has(input[name=funds_cleared])')
    await confirm.locator('button').click()                                                   // the checkbox is `required`: the browser blocks it
    expect(await scalar('select status from payments order by id limit 1')).toBe('pending_confirmation')
    await confirm.locator('input[name=funds_cleared]').check()
    await confirm.locator('button').click()
    await page.waitForURL(/\/admin\/receipts\/\d+/)
    await expect(notice()).toContainText('needs a manual e-meterai')
    receiptId = page.url().match(/receipts\/(\d+)/)![1]
    await expect(page.locator('body')).toContainText(/pending stamp/i)
  })

  await test.step('the stamped PDF is checked, stored privately and released', async () => {
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
    await confirm.locator('button').click()
    await expect(page.locator('.alert:has-text("Funds confirmed")')).toBeVisible()
    await page.goto(`/admin/invoices/${invoiceId}`)
    await expect(status()).toContainText('paid')
    expect(await scalar(`select outstanding_minor from invoices where id=${invoiceId}`)).toBe('0')
    await page.goto('/admin/receipts')
    await expect(page.locator('tbody tr')).toHaveCount(2)
  })

  await test.step('quotation: approval needs SMTP, then a private link, a signed upload and a manual review', async () => {
    await page.goto('/admin/quotations/new')
    await page.selectOption('select[name=recipient]', `customer:${customerId}`)
    await page.fill('textarea[name=items]', 'Air freight | 100 | 25000 | kg')
    await page.fill('input[name=valid_until]', '2999-01-01')
    await page.click('button:has-text("Save quotation draft")')
    await page.waitForURL(/\/admin\/quotations\/\d+/)
    quotationId = page.url().match(/quotations\/(\d+)/)![1]
    await page.click('button:has-text("Issue quotation")')
    await expect(page.locator('.alert:has-text("Quotation state updated")')).toBeVisible()
    await page.click('button:has-text("Send quotation for customer approval")')
    await expect(page.locator('.alert[role=alert]')).toContainText('Configure SMTP')

    await page.goto('/admin/mail')
    await page.fill('input[name=host]', 'smtp.example.invalid')
    await page.fill('input[name=username]', 'u')
    await page.fill('input[name=password]', 'secret-pass')
    await page.check('input[name=enabled]')
    await page.click('button:has-text("Save SMTP settings")')
    await expect(page.locator('.alert:has-text("SMTP configuration saved")')).toBeVisible()
    expect((await page.content()).includes('secret-pass')).toBe(false)                         // the password is never shown again
    for (const rule of ['quotation_approval_request', 'quotation_approved_admin']) {
      await page.locator('tr', { has: page.locator('td', { hasText: new RegExp('^' + rule + '$') }) }).locator('button:has-text("Enable")').click()
      await expect.poll(() => scalar(`select enabled from email_rules where key = '${rule}'`)).toBe('true')
    }

    await page.goto(`/admin/quotations/${quotationId}`)
    await page.click('button:has-text("Send quotation for customer approval")')
    await expect(notice()).toContainText('Approval email queued')
    const html = await scalar("select html from email_jobs where event='quotation_approval_request' order by id desc limit 1")
    const link = html.match(/href="([^"]*quotation-approval\/[^"]+)"/)?.[1]
    expect(link, 'the email carries the private link').toBeTruthy()

    const customer = await openContext(browser, 390, 900)
    const cp = customer.page
    trackProblems(cp, 'customer', problems, { strict4xx: true })
    await cp.goto(link!.replace(/^https?:\/\/[^/]+/, BASE_URL).replace(/&amp;/g, '&'))
    await expect(cp.locator('body')).toContainText('Review and approve quotation')
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
    await expect(status()).toContainText('awaiting_approval')                                  // the upload alone approves nothing
    await page.click('button:has-text("Approve")')                                             // the review tick is missing: the server refuses
    await expect(page.locator('.alert[role=alert]')).toContainText('reviewed manually')
    await page.check('input[name=signature_and_stamp_verified]')
    await page.click('button:has-text("Approve")')
    await expect(page.locator('.alert:has-text("quotation status updated")')).toBeVisible()
    await expect(status()).toContainText('approved')
    const approvalId = await scalar('select id from quotation_approvals limit 1')
    const signed = await page.request.get(`/admin/quotation-approvals/${approvalId}/file`)
    expect(signed.status()).toBe(200)
    expect((await signed.body()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  await test.step('the QR pages answer anonymously and fit a phone', async () => {
    const visitor = await openContext(browser, 390, 800)
    trackProblems(visitor.page, 'verify', problems, { strict4xx: true })
    for (const [kind, id] of [['invoice', invoiceId], ['receipt', receiptId], ['quotation', quotationId]]) {
      const token = await scalar(`select token from document_verification_tokens where kind='${kind}' and document_id=${id}`)
      await visitor.page.goto(`/verify/${token}`)
      await expect(visitor.page.locator('body')).toContainText('AUTHENTIC')
      expect(await overflow(visitor.page), `${kind} verification page`).toBeLessThanOrEqual(1)
    }
    await visitor.context.close()
  })

  await test.step('every finance page fits a phone', async () => {
    const phone = await openContext(browser, 390, 900)
    trackProblems(phone.page, 'mobile', problems, { strict4xx: true })
    await signIn(phone.page)
    for (const p of ['/admin/customers', `/admin/customers/${customerId}`, '/admin/bank-accounts', '/admin/quotations', `/admin/quotations/${quotationId}`, '/admin/quotations/new',
      '/admin/invoices', `/admin/invoices/${invoiceId}`, '/admin/invoices/new', '/admin/receipts', `/admin/receipts/${receiptId}`]) {
      await phone.page.goto(p, { waitUntil: 'networkidle' })
      expect(await overflow(phone.page), p).toBeLessThanOrEqual(1)
    }
    await phone.context.close()
  })

  expect(problems, 'no console errors, failed requests or 5xx answers').toEqual([])
  await context.close()
})
