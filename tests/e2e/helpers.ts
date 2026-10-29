import type { Browser, Page } from '@playwright/test'
import postgres from 'postgres'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './credentials'

export { ADMIN_EMAIL, ADMIN_PASSWORD }
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
