import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageLoader, VoraLoader } from '@/components/feedback/VoraLoader'
import { LOGO_ART, MARK_ART } from '@/content/vora-motion-art'

/** The loading motion moves the approved logo; it must never carry a redrawn one. */
const dOf = (file: string, fill: string) => {
  const svg = readFileSync(`public/static/assets/${file}`, 'utf8')
  return [...svg.matchAll(/<path([^>]*?)d="([^"]*)"([^>]*)>/g)].find((m) => (m[1] + m[3]).toUpperCase().includes(fill))![2]
}

describe('the VORA loading motion', () => {
  it('uses the path data of the approved logo and A icon, unchanged', () => {
    expect(LOGO_ART.ink.d).toBe(dOf('vora-primary.svg', '#101720')); expect(LOGO_ART.red.d).toBe(dOf('vora-primary.svg', '#B43E31'))
    expect(MARK_ART.ink.d).toBe(dOf('vora-a-icon-primary.svg', '#101720')); expect(MARK_ART.red.d).toBe(dOf('vora-a-icon-primary.svg', '#B43E31'))
  })
  it('draws the logo and the icon in the brand colours, with a label and nothing for a screen reader to read twice', () => {
    for (const variant of ['logo', 'mark'] as const) {
      const h = renderToStaticMarkup(<VoraLoader variant={variant} label="Memuat…" />)
      expect(h).toContain(`vl-${variant}`); expect(h).toContain('aria-label="Memuat…"'); expect(h).toContain('aria-hidden="true"')
      expect(h).toContain('fill="#101720"'); expect(h).toContain('fill="#B43E31"')
      expect(h).toContain('class="vl-red"'); expect(h).toContain('class="vl-ink"')
    }
  })
  it('gives every instance its own clip ids, so that two on one page do not share them', () => {
    const ids = (h: string) => [...h.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
    const a = ids(renderToStaticMarkup(<><VoraLoader /><VoraLoader variant="mark" /></>))
    expect(new Set(a).size).toBe(a.length)
  })
  it('stands still for people who ask for less motion, and shows a page loader only after a moment', () => {
    const css = readFileSync('public/static/css/feedback.css', 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\.vl \*\{animation:none!important\}/)
    expect(css).toMatch(/\.vl-page\{[^}]*animation:vl-appear \.25s \.2s both/)                     // hidden for the first 200 ms: a quick page never flashes it
    const h = renderToStaticMarkup(<PageLoader />)
    expect(h).toContain('vl-page'); expect(h).toContain('role="status"'); expect(h).toContain('Memuat halaman…')
  })
})
