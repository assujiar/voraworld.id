import { describe, expect, it } from 'vitest'
import { isVerifyUrl, withVerificationLinks } from '@/server/mail/verification-links'
import { stripTags } from '@/server/mail/transport'

const ORIGIN = 'https://voraworld.id'
const URL1 = 'https://voraworld.id/verify/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGh'

describe('verification links in email', () => {
  it('adds a clickable link, in both languages, to a message whose template has none', () => {
    const out = withVerificationLinks('<p>Dear customer</p>', [{ label: 'INV-1', url: URL1 }], ORIGIN)
    expect(out).toContain(`<a href="${URL1}">${URL1}</a>`)
    expect(out).toContain('INV-1')
    expect(out).toContain('Periksa keaslian dokumen | Verify this document')
  })

  it('adds nothing when the template already has the link, and never twice', () => {
    const html = `<p>See <a href="${URL1}">here</a></p>`
    expect(withVerificationLinks(html, [{ label: 'x', url: URL1 }], ORIGIN)).toBe(html)
    expect((withVerificationLinks('<p>a</p>', [{ label: 'x', url: URL1 }, { label: 'y', url: URL1 }], ORIGIN).match(/<a href=/g) ?? []).length).toBe(1)
  })

  it('lists one link per document of a package', () => {
    const URL2 = URL1.replace('AbCd', 'ZzZz')
    const out = withVerificationLinks('<p>a</p>', [{ label: 'INV-1', url: URL1 }, { label: 'PRE-1', url: URL2 }], ORIGIN)
    expect(out).toContain(URL1); expect(out).toContain(URL2)
  })

  it('only ever links to the site\'s own verification pages', () => {
    for (const bad of ['https://evil.example/verify/AbCdEfGhIjKl', 'https://voraworld.id.evil.example/verify/AbCdEfGhIjKl', 'https://voraworld.id/admin/AbCdEfGhIjKl', 'https://voraworld.id/verify/short',
      'https://voraworld.id/verify/AbCdEfGhIjKl?next=https://evil.example', 'https://user:pw@voraworld.id/verify/AbCdEfGhIjKl', 'javascript:alert(1)', 'http://voraworld.id/verify/AbCdEfGhIjKl']) {
      expect(isVerifyUrl(bad, ORIGIN), bad).toBe(false)
      expect(withVerificationLinks('<p>a</p>', [{ label: 'x', url: bad }], ORIGIN)).toBe('<p>a</p>')
    }
    expect(isVerifyUrl(URL1, ORIGIN)).toBe(true)
  })

  it('escapes the label, so a document number can not inject markup', () => {
    const out = withVerificationLinks('<p>a</p>', [{ label: '<img src=x onerror=1>', url: URL1 }], ORIGIN)
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })

  it('keeps the address in the plain-text part, where a link can not be clicked once the markup is gone', () => {
    const text = stripTags(withVerificationLinks('<p>Dear customer,</p><p>Thanks.</p>', [{ label: 'INV-1', url: URL1 }], ORIGIN))
    expect(text).toContain(URL1)
    expect(text).toContain('Dear customer,')
    expect(stripTags(`<p>Open <a href="${URL1}">the page</a></p>`)).toBe(`Open the page (${URL1})`)
  })
})
