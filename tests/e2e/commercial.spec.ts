import { expect, test } from '@playwright/test'
import { db, fillItems, openContext, scalar, signIn, trackProblems } from './helpers'

/**
 * PATH A and PATH C in the browser (Path B, which never touches a lead, is the finance spec): a lead becomes a customer and a quotation is made
 * from it; a second lead is linked to a customer that already exists; a lead that looks like a customer is not merged silently.
 */
test('Path A and Path C: a lead is saved as a customer, or linked to one, and the quotation follows', async ({ browser }) => {
  test.setTimeout(240_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true })
  await signIn(page)
  const notice = () => page.locator('.alert').first()
  const leadId = await scalar("select id from leads where reference = 'RFQ-VORA-L000000AB12-202610-00001'")
  let customerId = '', quotationId = ''

  await test.step('Path A: "Simpan sebagai Customer & Buat Quotation" creates the customer, keeps the lead and opens a quotation prefilled from the inquiry', async () => {
    await page.goto(`/admin/leads/${leadId}`)
    await expect(page.locator('button:has-text("Simpan sebagai Customer")').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.selectOption('select[name=currency]', 'IDR')
    await page.fill('input[name=name]', 'PT Contoh Maju')
    await page.fill('input[name=pic_position]', 'Procurement Manager')
    await page.fill('input[name=pic_phone]', '+62 811 222 3333')
    await page.click('button:has-text("Simpan sebagai Customer & Buat Quotation")')
    await page.waitForURL(/\/admin\/quotations\/new\?customer=\d+&lead=\d+/)
    customerId = page.url().match(/customer=(\d+)/)![1]
    expect(await scalar(`select customer_id from leads where id = ${leadId}`)).toBe(customerId)         // the lead is linked, not replaced
    expect(await scalar(`select count(*) from leads where id = ${leadId}`)).toBe('1')
    await expect(page.locator('body')).toContainText('from lead')
    await expect(page.locator('input[name=origin]')).toHaveValue('Jakarta')                            // the inquiry fills the route, never a price
    await expect(page.locator('input[name=destination]')).toHaveValue('Rotterdam')
    await expect(page.locator('input[name=pic_name]')).toHaveValue('Dewi Lestari')
    await expect(page.locator('input[name=item_price]').first()).toHaveValue('')
    await fillItems(page, ['description', 'quantity', 'unit', 'price'], [['Ocean freight 1x40HC', '1', 'container', '30000000']], 'Add charge')
    await page.fill('input[name=valid_until]', '2999-01-01')
    await page.fill('textarea[name=payment_terms]', 'Within 14 days of the invoice date.')
    await page.fill('textarea[name=terms_conditions]', '1. Rates exclude duties and taxes.')
    await page.click('button:has-text("Save quotation draft")')
    await page.waitForURL(/\/admin\/quotations\/\d+/)
    quotationId = page.url().match(/quotations\/(\d+)/)![1]
    expect(await scalar(`select lead_id || ':' || customer_id from quotations where id = ${quotationId}`)).toBe(`${leadId}:${customerId}`)
    await expect(page.locator('body')).toContainText('from lead')
  })

  await test.step('the lead cannot be converted twice; the customer and the lead point at each other', async () => {
    await page.goto(`/admin/leads/${leadId}`)
    await expect(page.locator('button:has-text("Simpan sebagai Customer")')).toHaveCount(0)
    await expect(page.locator(`a[href="/admin/customers/${customerId}"]`).first()).toBeVisible()
    await expect(page.locator('a:has-text("Buat Quotation")').first()).toBeVisible()
    await page.goto(`/admin/customers/${customerId}`)
    await expect(page.locator('body')).toContainText('Came from 1 lead')
    await expect(page.locator(`a[href="/admin/quotations/${quotationId}"]`).first()).toBeVisible()
    expect(await scalar(`select pic_position from customers where id = ${customerId}`)).toBe('Procurement Manager')
  })

  const lead = async (ref: string, company: string, name: string) => {
    const [row] = await db()`insert into leads (type, name, company, email, phone, message, reference, public_code, status)
      values ('contact', ${name}, ${company}, ${name.toLowerCase().replace(/\s/g, '.') + '@example.invalid'}, '+62 812 9999 0000', 'Hello', ${ref}, ${'L' + ref.slice(-10)}, 'new') returning id`
    return String(row.id)
  }

  await test.step('a lead that looks like an existing customer is not merged silently', async () => {
    const id = await lead('CON-VORA-LAAAAAAAAA1-202610-00001', 'PT Contoh Maju', 'Another Person')
    await page.goto(`/admin/leads/${id}`)
    await expect(page.locator('body')).toContainText('Customers that look like this lead')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Simpan sebagai Customer"):not([name])')
    await expect(page.locator('.alert[role=alert]')).toContainText('A similar customer already exists')
    expect(await scalar("select count(*) from customers where lower(name) = 'pt contoh maju'")).toBe('1')
    expect(await scalar(`select coalesce(customer_id::text, 'none') from leads where id = ${id}`)).toBe('none')
  })

  await test.step('Path C: the same lead is linked to the existing customer instead, and nothing new is created', async () => {
    const id = await lead('CON-VORA-LBBBBBBBBB2-202610-00002', 'Contoh Maju Group', 'Third Person')
    const before = await scalar('select count(*) from customers')
    await page.goto(`/admin/leads/${id}`)
    await page.waitForLoadState('networkidle')
    await page.selectOption('select[name=existing_customer_id]', customerId)
    await page.click('button:has-text("Simpan sebagai Customer"):not([name])')
    await expect(notice()).toContainText('Linked to the existing customer')
    expect(await scalar('select count(*) from customers')).toBe(before)
    expect(await scalar(`select customer_id from leads where id = ${id}`)).toBe(customerId)
    await page.click('a:has-text("Buat Quotation")')                                                  // the second quotation of the same customer
    await page.waitForURL(/\/admin\/quotations\/new\?customer=\d+&lead=\d+/)
    await expect(page.locator('body')).toContainText('PT Contoh Maju')
  })

  expect(problems, 'no console errors, failed requests or 5xx answers').toEqual([])
  await context.close()
})
