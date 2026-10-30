import { expect, type Browser, type Page } from '@playwright/test'
import sharp from 'sharp'
import postgres from 'postgres'
import { ADMIN_EMAIL, ADMIN_PASSWORD, RESET_EMAIL, RESET_PASSWORD } from './credentials'

export { ADMIN_EMAIL, ADMIN_PASSWORD, RESET_EMAIL, RESET_PASSWORD }
export const PORT = Number(process.env.E2E_PORT || 3310)
export const BASE_URL = `http://localhost:${PORT}`

/** A tiny valid PNG. */
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

let client: postgres.Sql | undefined
/** Read access to the database behind the server under test, to check what a click really stored. */
export function db(): postgres.Sql {
  return (client ??= postgres(process.env.E2E_DATABASE_URL!, { max: 2, onnotice: () => {} }))
}

/** First column of the first row as text ('' when there is none): `await scalar("select status from invoices where id = 1")`. */
export async function scalar(query: string): Promise<string> {
  const rows = await db().unsafe(query)
  const first = rows[0] ? Object.values(rows[0])[0] : ''
  return first === null || first === undefined ? '' : String(first)
}

export async function openContext(browser: Browser, width = 1440, height = 1000) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width, height } })
  return { context, page: await context.newPage() }
}

export async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/admin/login')
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await Promise.all([page.waitForURL((u) => u.pathname === '/admin'), page.click('form button.button')])
}

interface Tracking {
  /** Console messages to ignore. */
  benign?: RegExp
  /** Also report 4xx answers (other than the ones tests provoke on purpose: 401, 404, 409, 410). */
  strict4xx?: boolean
}

/** Collects what a user would call "something broke": console errors, uncaught exceptions, 5xx answers, failed requests. */
export function trackProblems(page: Page, tag: string, into: string[], { benign, strict4xx = false }: Tracking = {}) {
  page.on('console', (m) => { if (m.type() === 'error' && !(benign && benign.test(m.text()))) into.push(`${tag} console: ${m.text()}`) })
  page.on('pageerror', (e) => into.push(`${tag} pageerror: ${e.message}`))
  page.on('response', (r) => {
    const s = r.status()
    if (s >= 500) into.push(`${tag} ${s} ${r.url()}`)
    else if (strict4xx && s >= 400 && ![401, 404, 409, 410].includes(s) && !/_next\/static|favicon/.test(r.url())) into.push(`${tag} ${s} ${r.url()}`)
  })
}

/** Horizontal overflow of the page in pixels (0 when it fits the window). */
export const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

/**
 * Types rows into an items table (`item_<column>` inputs, one per row). The page must be interactive first: the table is a client component and
 * text typed before it hydrates would be lost. Extra rows are added with the table's own button.
 */
export async function fillItems(page: Page, columns: string[], rows: string[][], addLabel: string) {
  await page.waitForLoadState('networkidle')
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await page.click(`button:has-text("${addLabel}")`)
    for (let c = 0; c < columns.length; c++) await page.locator(`input[name=item_${columns[c]}]`).nth(i).fill(rows[i][c] ?? '')
  }
}

/**
 * A customer with a quotation that has already been signed and validated, written straight to the database: for specs whose subject is what comes
 * AFTER the quotation (delivery proof, documents). The commercial flow itself is driven through the browser in finance.spec.ts.
 */
export async function seedValidatedQuotation(name = 'PT Seeded Customer'): Promise<{ customerId: string; quotationId: string; number: string }> {
  const sql = db()
  const [c] = await sql`insert into customers (name, email, currency, terms_days, pic_name, pic_phone) values (${name}, 'seed@customer.example', 'IDR', 14, 'Budi Santoso', '+62 811 0000 111') returning id`
  const [{ code }] = await sql`select vr_public_code('customers', ${c.id as number}) as code`
  const [{ number }] = await sql`select vr_next_number('QUO', ${code as string}, null) as number`
  const [q] = await sql`insert into quotations (number, customer_id, status, currency, issued_at, valid_until, payment_terms, terms_conditions, notes, tax_percent, subtotal_minor, tax_minor, total_minor, origin, destination, customer_approved_at, validated_at)
    values (${number as string}, ${c.id as number}, 'validated', 'IDR', vr_today(), '2999-01-01', 'Within 14 days', 'Standard terms', '', 0, 1000000, 0, 1000000, 'Jakarta', 'Bekasi', now(), now()) returning id`
  await sql`insert into quotation_items (quotation_id, description, unit, quantity, price_minor, amount_minor) values (${q.id as number}, 'Freight', 'shipment', 1, 1000000, 1000000)`
  await sql`select vr_create_verification('quotation', ${q.id as number})`
  return { customerId: String(c.id), quotationId: String(q.id), number: number as string }
}

// ---------------------------------------------------------------------------------------------------------------- the driver's phone
const photo = () => sharp({ create: { width: 640, height: 480, channels: 3, background: '#7a8c6e' } }).jpeg({ quality: 70 }).toBuffer()

export async function phone(browser: Browser, allowLocation: boolean) {
  const context = await browser.newContext({
    baseURL: BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ...(allowLocation ? { geolocation: { latitude: -6.2088, longitude: 106.8456, accuracy: 20 }, permissions: ['geolocation'] } : {}),
  })
  return { context, page: await context.newPage() }
}

/** The form was accepted: the thank-you appears. If it does not, the refusal the form showed is the failure. */
export async function received(page: Page) {
  try {
    await expect(page.locator('div[role=status]')).toContainText('The delivery of')
  } catch (e) {
    throw new Error(`the form was refused: ${(await page.locator('.alert[role=alert]').allInnerTexts()).join(' / ') || 'no message'}\n${e}`)
  }
}

export async function sign(page: Page, name: string) {
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

