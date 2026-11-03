import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FooterLogo } from '@/components/site/FooterLogo'
import { BrandFrame, STUDY_NUMBER } from '@/motion/studies'

const paths = (svg: string) => [...svg.matchAll(/<path[^>]* d="([^"]+)"/g)].map(match => match[1])
describe('approved automatic brand studies', () => {
  it('sends the complete original reverse wordmark before JavaScript runs', () => {
    const html = renderToStaticMarkup(createElement(FooterLogo))
    const official = readFileSync('public/static/assets/vora-reverse.svg', 'utf8')
    const expected = paths(official)
    expect(expected.length).toBeGreaterThan(0)
    for (const path of expected) expect(html).toContain(path)
    expect(html).toContain('data-brand-study="01"')
    expect(html).toContain('aria-label="VORA"')
    expect(html).not.toContain('vora-brand-motion__player')
    expect(html).not.toContain('v-footer__signal')
  })
  it('keeps the official geometry in every settled wordmark reveal', () => {
    const expected = paths(readFileSync('public/static/assets/vora-primary.svg', 'utf8'))
    for (const study of ['trace', 'origin', 'editorial'] as const) {
      const html = renderToStaticMarkup(createElement(BrandFrame, { study, frame: 150 }))
      for (const path of expected) expect(html).toContain(path)
      expect(html).toContain('#101720')
      expect(html).toContain('#B43E31')
    }
    const mark = renderToStaticMarkup(createElement(BrandFrame, { study: 'origin', mark: true, frame: 270 }))
    for (const path of paths(readFileSync('public/static/assets/vora-a-icon-primary.svg', 'utf8'))) expect(mark).toContain(path)
  })
  it('exposes only the four user-approved reference studies', () => {
    expect(Object.values(STUDY_NUMBER)).toEqual(['01', '02', '04', '06'])
  })
})
