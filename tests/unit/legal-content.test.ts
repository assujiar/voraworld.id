import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LegalPage, legalText } from '@/components/site/LegalPage'

const state = vi.hoisted(() => ({ settings: {} as Record<string, string> }))
vi.mock('@/server/site', () => ({ getSettings: async () => state.settings }))
beforeEach(() => { state.settings = { email: 'info@voraworld.id' } })

describe('owner-supplied legal content and locale resolution', () => {
  it.each(['privacy', 'terms'] as const)('%s provides corresponding native documents with the same effective date on a clean install', async kind => {
    const en = await legalText('en', kind), id = await legalText('id', kind)
    expect(en.fallback || id.fallback).toBe(false)
    expect(en.html).toContain('Effective date: 30 October 2026')
    expect(id.html).toContain('Tanggal berlaku: 30 Oktober 2026')
    const tags = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}(?:>| )`, 'g'))].length
    expect(tags(en.html, 'h2')).toBe(kind === 'privacy' ? 11 : 14)
    for (const tag of ['h2', 'h3', 'p', 'li', 'ul']) expect(tags(id.html, tag)).toBe(tags(en.html, tag))
    const html = renderToStaticMarkup(await LegalPage({locale: 'id', kind}))
    expect(html).toContain('lang="id"')
    expect(html).toContain('mailto:info@voraworld.id')
    expect(html).not.toContain('Draf untuk ditinjau')
    expect(html).not.toContain('sedang difinalisasi')
    expect(html).toContain('Bringing the World Within Reach.')
  })
  it.each([['en','privacy'], ['id','privacy'], ['en','terms'], ['id','terms']] as const)('%s %s preserves existing CMS content', async (locale, kind) => {
    const key = locale === 'en' ? kind : `${kind}_id`
    state.settings[key] = '<h2>Approved company text</h2><p>Keep the existing policy.</p>'
    expect(await legalText(locale, kind)).toMatchObject({html: state.settings[key], fallback: false})
  })
  it.each(['privacy', 'terms'] as const)('%s uses the supplied native Indonesian document when its CMS field is missing', async kind => {
    state.settings[kind] = '<p>Existing English company policy.</p>'
    const result = await legalText('id', kind)
    expect(result.html).toContain('Tanggal berlaku: 30 Oktober 2026')
    expect(result.html).not.toContain('Existing English company policy.')
    if (kind === 'privacy') {
      expect(result.html).toContain('Berbagi lokasi bersifat opsional.')
      expect(result.html).toContain('Kami tidak menjual data pribadi')
    } else {
      expect(result.html).toContain('tidak merupakan tanda tangan elektronik tersertifikasi')
      expect(result.html).toContain('href="/id/privacy"')
      expect(result.html).not.toContain('href="/en/privacy"')
    }
  })
  it('treats empty rich text as missing and sanitizes CMS content', async () => {
    state.settings.privacy_id = '<p>&nbsp;<br></p><script>alert(1)</script>'
    expect((await legalText('id', 'privacy')).html).toContain('01 / Tentang Kami')
    state.settings.privacy_id = '<p>Published content.</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>'
    const result = await legalText('id', 'privacy')
    expect(result.html).toContain('Published content.')
    expect(result.html).not.toContain('<script')
    expect(result.html).not.toContain('javascript:')
  })
})
