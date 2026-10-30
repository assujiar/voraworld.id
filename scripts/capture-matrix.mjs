// Renders every public route in both languages at four real viewport widths and writes a manifest.
//   node scripts/capture-matrix.mjs --base http://localhost:3100 --out <dir> --label before [--routes /en,/id/faq] [--shots top,mid,footer]
// The viewport is set on the browser context and `window.innerWidth` is READ BACK for every page: a page whose width differs is recorded as a failure,
// never relabelled. Nothing is written to the site: the script only issues GET requests.
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const base = arg('base', 'http://localhost:3100').replace(/\/+$/, '')
const out = arg('out', 'captures'), label = arg('label', 'run')
const shots = arg('shots', 'top,mid,footer').split(',')
const only = arg('routes', '')
const SIZES = [[1920, 1080], [1440, 900], [390, 844], [360, 800]]
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' } })()

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text()
let routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).filter((p) => /^\/(en|id)(\/|$)/.test(p))
routes = [...new Set(routes)]
if (only) routes = only.split(',')
mkdirSync(join(out, label), { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const rows = [['route', 'locale', 'requested_viewport', 'measured_innerWidth', 'shot', 'state', 'commit', 'file', 'sha256', 'overflow_px', 'result']]
for (const [w, h] of SIZES) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  for (const route of routes) {
    const locale = route.split('/')[1]
    let measured = 0, overflow = 0, failure = ''
    try {
      const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 })
      if (!res || res.status() >= 400) failure = `HTTP ${res?.status()}`
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(1400)                                   // entry animations settle before anything is judged
      measured = await page.evaluate(() => window.innerWidth)
      overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const total = await page.evaluate(() => document.documentElement.scrollHeight)
      for (const shot of shots) {
        const y = shot === 'top' ? 0 : shot === 'mid' ? Math.max(0, Math.round(total / 2 - h / 2)) : Math.max(0, total - h)
        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
        await page.waitForTimeout(shot === 'top' ? 150 : 700)             // lazy images and reveal transitions
        const file = `${route.replace(/^\//, '').replaceAll('/', '--') || 'root'}__${w}x${h}__${shot}.jpg`
        const buf = await page.screenshot({ type: 'jpeg', quality: 62 })
        writeFileSync(join(out, label, file), buf)
        const ok = !failure && measured === w
        rows.push([route, locale, `${w}x${h}`, measured, shot, 'settled', commit, file, createHash('sha256').update(buf).digest('hex'), overflow, ok ? (overflow > 1 ? 'OVERFLOW' : 'ok') : `FAIL ${failure || 'width mismatch'}`])
      }
    } catch (e) {
      rows.push([route, locale, `${w}x${h}`, measured, '-', '-', commit, '-', '-', overflow, `ERROR ${String(e.message).slice(0, 80)}`])
    }
  }
  await context.close()
}
await browser.close()
writeFileSync(join(out, label, 'manifest.csv'), rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n')
console.log(`captured ${rows.length - 1} rows; failures: ${rows.filter((r) => /FAIL|ERROR/.test(r[10])).length}; overflow: ${rows.filter((r) => r[10] === 'OVERFLOW').length}`)
