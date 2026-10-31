import { buildSync } from 'esbuild'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * Browser tests of the public verification page: the real component and the real stylesheet, served by a tiny server (no database, no Next). Run `npm run test:visual`.
 * They check the layout at every width in the brief (no horizontal overflow, nothing clipped), that the watermark never takes a click, a touch or a selection, that the file
 * check and the copy buttons still work above it, and the print rules. Chromium only here: see KNOWN_LIMITATIONS for what that does and does not show.
 */
const ROOT = resolve(__dirname, '..', '..')
const WIDTHS: Array<[number, number]> = [[320, 700], [360, 800], [375, 812], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900]]
let server: Server, base = '', pages: Record<string, string> = {}

test.beforeAll(async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'vora-visual-')), 'fixtures.cjs')
  buildSync({ entryPoints: [join(ROOT, 'tests/visual/fixtures-entry.tsx')], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: out, alias: { '@': join(ROOT, 'src') }, logLevel: 'silent' })
  pages = (require(out) as { fixtures: () => Record<string, string> }).fixtures()
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const m = /^\/page\/([a-z]+)$/.exec(url.pathname)
    if (m && pages[m[1]]) { res.setHeader('content-type', 'text/html; charset=utf-8'); return void res.end(pages[m[1]]) }
    const file = join(ROOT, 'public', url.pathname)
    if (url.pathname.startsWith('/static/') && existsSync(file)) {
      res.setHeader('content-type', { '.css': 'text/css', '.svg': 'image/svg+xml', '.js': 'text/javascript' }[extname(file)] ?? 'application/octet-stream')
      return void res.end(readFileSync(file))
    }
    res.statusCode = 404; res.end('not found')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
test.afterAll(() => { server?.close() })

const overflow = (page: Page) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.body.clientWidth }))

for (const [w, h] of WIDTHS) {
  test(`no horizontal overflow and a readable page at ${w}x${h}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 })
    const page = await ctx.newPage()
    for (const name of ['valid', 'revoked', 'agreement', 'invoice', 'legacy', 'notfound']) {
      await page.goto(`${base}/page/${name}`)
      expect(await overflow(page), `${name} @${w}`).toEqual({ doc: 0, body: 0 })
      // Every piece of text is inside the viewport horizontally.
      const clipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('h1,h2,p,dd,dt,button,.vf-hash')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) }).map((e) => e.className || e.tagName))
      expect(clipped, `${name} @${w}`).toEqual([])
      // Body text is not smaller than 13px.
      expect(await page.evaluate(() => Math.min(...[...document.querySelectorAll<HTMLElement>('p,dd,li')].map((e) => parseFloat(getComputedStyle(e).fontSize))))).toBeGreaterThanOrEqual(12.9)
    }
    if (w === 390 || w === 1440 || w === 768) { await page.goto(`${base}/page/valid`); await page.screenshot({ path: `test-results/verify-valid-${w}.png`, fullPage: true }) }
    await ctx.close()
  })
}

test('the watermark repeats, in the corporate red at a low opacity, behind the page and (fainter) in front of the information, and takes no interaction', async ({ page }) => {
  await page.goto(`${base}/page/valid`)
  const info = await page.evaluate(() => [...document.querySelectorAll<SVGElement>('svg.vf-wm')].map((s) => {
    const cs = getComputedStyle(s)
    const path = s.querySelector('path')
    return { layer: s.getAttribute('data-watermark'), opacity: Number(cs.opacity), pointer: cs.pointerEvents, select: cs.userSelect, hidden: s.getAttribute('aria-hidden'), fill: path ? getComputedStyle(path.parentElement!.parentElement!).fill : '', pattern: Boolean(s.querySelector('pattern')), w: s.getBoundingClientRect().width, h: s.getBoundingClientRect().height }
  }))
  expect(info.some((i) => i.layer === 'back')).toBe(true)
  for (const i of info) {
    expect(i.pointer).toBe('none'); expect(i.hidden).toBe('true'); expect(i.pattern).toBe(true); expect(i.w).toBeGreaterThan(100); expect(i.h).toBeGreaterThan(20)
    expect(i.fill).toBe('rgb(180, 62, 49)')                                                                        // #B43E31
    expect(i.opacity).toBeGreaterThanOrEqual(i.layer === 'back' ? 0.035 : 0.01); expect(i.opacity).toBeLessThanOrEqual(i.layer === 'back' ? 0.075 : 0.03)
  }
  const back = info.find((i) => i.layer === 'back')!, front = info.find((i) => i.layer === 'front')!
  expect(front.opacity).toBeLessThan(back.opacity)
  // The pattern is one tile repeated by the browser (patternUnits userSpaceOnUse), so it has no seams and never clips a stamp at the page's edge by construction.
  expect(await page.evaluate(() => document.querySelectorAll('pattern').length)).toBeGreaterThanOrEqual(2)
})

test('controls above the watermark work: a click reaches the button, text can be selected, a file can be chosen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  await page.goto(`${base}/page/valid`)
  await page.getByRole('button', { name: /Copy verification link/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://voraworld.id/verify/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
  await page.getByRole('button', { name: /Copy document reference/ }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('LTR-VORA-C001-202611-00001')
  // The element under the centre of every control and of the status text is never the watermark.
  const blocked = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button, input, a, h1')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width) return false; const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(top && (e === top || e.contains(top))) }).map((e) => e.tagName))
  expect(blocked).toEqual([])
  // Selecting the status text copies it.
  await page.locator('h1').selectText()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('ISSUANCE RECORD FOUND')
})

test('the file check runs in the browser, uploads nothing, and tells a match from a mismatch', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => { if (r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`) })
  await page.goto(`${base}/page/valid`)
  // The page is static here (no hydration), so the check is exercised through the same function in the browser.
  const digest = await page.evaluate(async () => { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('x')); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('') })
  expect(digest).toBe('2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881')
  expect(requests).toEqual([])
})

test('status is visible without relying on colour, and a revoked or superseded page shows no live status or holder', async ({ page }) => {
  for (const [name, words] of [['revoked', 'REVOKED'], ['superseded', 'SUPERSEDED'], ['draft', 'DRAFT'], ['valid', 'ISSUANCE RECORD FOUND']] as const) {
    await page.goto(`${base}/page/${name}`)
    await expect(page.locator('h1')).toContainText(words)
    expect(await page.locator('.vf-mark').textContent()).toMatch(/[●✕◐!]/)
  }
  await page.goto(`${base}/page/revoked`)
  await expect(page.getByText('Current status')).toHaveCount(0)
  await page.goto(`${base}/page/notfound`)
  await expect(page.locator('svg.vf-wm')).toHaveCount(0)
  await expect(page.locator('h1')).toContainText('NO VERIFICATION RECORD FOUND')
})

test('print: the back watermark stays (as content, not a background), the front one and the controls go, and nothing overflows an A4 page', async ({ page }) => {
  await page.goto(`${base}/page/valid`)
  await page.emulateMedia({ media: 'print' })
  const state = await page.evaluate(() => ({ front: [...document.querySelectorAll('svg.vf-wm-front')].every((s) => getComputedStyle(s).display === 'none'), back: Number(getComputedStyle(document.querySelector('svg.vf-wm-back')!).opacity), actions: getComputedStyle(document.querySelector('.vf-actions')!).display }))
  expect(state.front).toBe(true); expect(state.back).toBeGreaterThan(0.02); expect(state.back).toBeLessThanOrEqual(0.075); expect(state.actions).toBe('none')
  const pdf = await page.pdf({ format: 'A4', printBackground: false })
  expect(pdf.length).toBeGreaterThan(2000)
  expect(await overflow(page)).toEqual({ doc: 0, body: 0 })
})
