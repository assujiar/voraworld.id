import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Client } from './client'

const CORE = ['', '/about', '/services', '/solutions', '/network', '/insights', '/faq', '/contact', '/request-quote']
const GROUPS: Record<string, string[]> = {
  'international-freight-forwarding': ['air-import', 'sea-import', 'air-export', 'sea-export'],
  'customs-brokerage': [], '3pl-warehousing': [], 'domestic-distribution': ['ftl', 'ltl', 'fcl', 'lcl', 'air-freight'], 'project-cargo': [],
}
const paths = [...CORE, ...Object.entries(GROUPS).flatMap(([g, modes]) => [`/services/${g}`, ...modes.map((m) => `/services/${g}/${m}`)])]
const FORBIDDEN = /tel:|wa\.me|api\.whatsapp|whatsapp|href=["']\/(en\/|id\/)?admin/i
const EMAIL = 'info@voraworld.id'
const ADDRESS = 'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810'
const c = new Client()

describe('public pages', () => {
  it('serve the five service groups and nine sub-services in both languages without phone, WhatsApp or admin links', async () => {
    expect(Object.values(GROUPS).flat()).toHaveLength(9)
    for (const locale of ['en', 'id']) {
      for (const p of paths) {
        const res = await c.get(`/${locale}${p}`)
        expect(res.status, `${locale}${p}`).toBe(200)
        const html = await res.text()
        expect(html, `${locale}${p}`).not.toMatch(FORBIDDEN)
        expect(html).toContain('vora-primary.svg')
        expect(html).toContain(`<html lang="${locale}"`)
        expect((html.match(/<h1[ >]/g) ?? []).length, `${locale}${p} h1`).toBe(1)
      }
    }
  })
  it('publish the approved company details', async () => {
    for (const locale of ['en', 'id']) {
      const html = await c.text(`/${locale}/contact`)
      expect(html).toContain(EMAIL)
      expect(html).toContain(ADDRESS)
      expect(html).toContain('PT Satu Arah International')
    }
  })
  it('translate the interface into Indonesian instead of just switching the label', async () => {
    const contact = await c.text('/id/contact')
    for (const w of ['Hubungi kami', 'Pesan', 'Perusahaan', 'Kirim permintaan', 'pemberitahuan privasi']) expect(contact).toContain(w)
    const home = await c.text('/id')
    for (const w of ['Tentang', 'Layanan', 'Kontak', 'Wawasan', 'Pengiriman berikutnya', 'PENDEKATAN VORA']) expect(home).toContain(w)
    expect(home).toContain('<title>VORA | Membawa Dunia Lebih Dekat</title>')
    for (const p of ['', '/about', '/contact', '/request-quote', '/solutions', '/network', '/faq']) {
      const html = await c.text(`/id${p}`)
      for (const phrase of ['Who we are', 'Get in touch', 'Where are you going next?', 'Select a service', 'Request for quotation', 'Our thinking']) expect(html, `/id${p}: ${phrase}`).not.toContain(phrase)
    }
    expect(await c.text('/id/solutions')).toContain('Manufaktur')
    expect(await c.text('/id/about')).toContain('Tentang VORA')
  })
  it('never mention the admin portal publicly', async () => {
    for (const p of ['/en/insights', '/en/contact', '/id/insights', '/en/privacy']) {
      const html = (await c.text(p)).toLowerCase()
      expect(html).not.toContain('admin portal')
      expect(html).not.toContain('administrator')
    }
  })
})

describe('SEO and routing', () => {
  it('emit canonical, hreflang alternates, Open Graph and Service JSON-LD', async () => {
    const html = await c.text('/en/services/international-freight-forwarding/air-import')
    expect(html).toMatch(/<link rel="canonical" href="http:\/\/localhost:\d+\/en\/services\/international-freight-forwarding\/air-import"/)
    expect(html).toMatch(/hrefLang="id"|hreflang="id"/i)
    expect(html).toMatch(/hrefLang="en"|hreflang="en"/i)
    expect(html).toContain('og:title')
    expect(html).toMatch(/"@type":"Service"/)
    expect(html).toMatch(/"@type":"Organization"/)
    expect(html).not.toContain('<script>alert')
  })
  it('lists every public page in both languages in the sitemap, and disallows private areas in robots.txt', async () => {
    const sitemap = await c.text('/sitemap.xml')
    expect(sitemap).toContain('/en/services/domestic-distribution')
    expect(sitemap).toContain('/id/services/domestic-distribution/ftl')
    expect(sitemap).not.toContain('/privacy')     // empty legal text is not advertised
    const robots = await c.text('/robots.txt')
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /verify')
    expect(robots).toContain('Sitemap:')
  })
  it('redirects: legacy aliases permanently, bare root to English, unknown locale and page are 404', async () => {
    const alias = await c.get('/en/services/sea-freight')
    expect([301, 308]).toContain(alias.status)
    expect(alias.headers.get('location')).toBe('/en/services/international-freight-forwarding/sea-export')
    const root = await c.get('/')
    expect([302, 307]).toContain(root.status)
    expect(new URL(root.headers.get('location')!, c.base).pathname).toBe('/en')
    expect((await c.get('/xx/about')).status).toBe(404)
    expect((await c.get('/en/does-not-exist')).status).toBe(404)
    expect((await c.get('/en/services/nope')).status).toBe(404)
    expect((await c.get('/en/services/air-freight')).status).toBe(308)   // alias, not a 404
  })
})

describe('security headers and caching', () => {
  it('apply on public and private pages', async () => {
    for (const p of ['/en', '/robots.txt', '/admin/login']) {
      const h = (await c.get(p)).headers
      expect(h.get('x-content-type-options')).toBe('nosniff')
      expect(h.get('x-frame-options')).toBe('DENY')
      expect(h.get('strict-transport-security')).toContain('max-age=')
      const csp = h.get('content-security-policy')!
      for (const d of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d)
      expect(csp).not.toMatch(/https?:\/\/(?!\*\.supabase\.co)/)   // no third-party origins
    }
    expect((await c.get('/admin/login')).headers.get('x-robots-tag')).toContain('noindex')
    expect((await c.get('/static/css/site.css')).headers.get('cache-control')).toContain('max-age=86400')
  })
})

describe('brand and interaction rules', () => {
  it('keep the standard cursor, avoid pointer tracking and respect reduced motion', () => {
    const css = readdirSync('public/static/css').map((f) => readFileSync(`public/static/css/${f}`, 'utf8')).join('')
    const js = readdirSync('public/static/js').map((f) => readFileSync(`public/static/js/${f}`, 'utf8')).join('')
    expect(css).not.toMatch(/cursor\s*:\s*(none|url)/)
    expect(js).not.toMatch(/mousemove|pointermove/)
    expect(css + readFileSync('public/static/css/motion.css', 'utf8')).toContain('prefers-reduced-motion')
  })
  it('ship the official brand assets and palette', () => {
    for (const f of ['vora-primary.svg', 'vora-reverse.svg', 'vora-a-icon-primary.svg', 'vora-a-watermark.png', 'design-tokens.json']) expect(readFileSync(`public/static/assets/${f}`).length, f).toBeGreaterThan(100)
    const tokens = readFileSync('public/static/assets/design-tokens.json', 'utf8').toLowerCase()
    expect(tokens).toContain('#b43e31'); expect(tokens).toContain('#101720')
  })
})

describe('admin gate (before login)', () => {
  it('redirects anonymous browsers to the sign-in page and refuses anonymous posts', async () => {
    const page = await c.get('/admin/invoices')
    expect([302, 303, 307]).toContain(page.status)
    expect(page.headers.get('location')).toContain('/admin/login?next=%2Fadmin%2Finvoices')
    const post = await c.request('/admin/invoices', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'x=1' })
    expect(post.status).toBe(401)
    expect((await c.get('/admin/login')).status).toBe(200)
  })
})
