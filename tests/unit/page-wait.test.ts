import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The logo wait for slow data (components/site/PageWait.tsx) and where it may be used. */
const site = (p: string) => `src/app/(site)/[locale]/${p}`

describe('the wait for a public page', () => {
  it('shows the logo loader on the home page, the pages of fixed content and the lists, which cannot answer "not found" or send a visitor on', () => {
    for (const where of ['(home)', 'about', 'solutions', 'network', 'faq', 'contact', 'privacy', 'terms', 'request-quote', 'services/(index)', 'insights/(index)']) {
      const file = site(`${where}/loading.tsx`)
      expect(existsSync(file), file).toBe(true)
      expect(readFileSync(file, 'utf8')).toContain('@/components/site/PageWait')
      expect(existsSync(site(`${where}/page.tsx`)), `${where} has its page beside the loader`).toBe(true)
    }
    expect(readFileSync('src/components/site/PageWait.tsx', 'utf8')).toContain('PageLoader')
  })

  it('is not put on the whole language, nor on a section with a page that can answer 404 or redirect, because such a page would answer 200 and an old address would be sent on by a script', () => {
    for (const file of [site('loading.tsx'), site('services/loading.tsx'), site('insights/loading.tsx'), site('[...slug]/loading.tsx'), site('services/[group]/loading.tsx'), site('insights/[slug]/loading.tsx')]) expect(existsSync(file), file).toBe(false)
    // The pages that redirect or answer 404 still do so by themselves.
    expect(readFileSync(site('[...slug]/page.tsx'), 'utf8')).toMatch(/permanentRedirect|notFound/)
    expect(readFileSync(site('services/[group]/page.tsx'), 'utf8')).toMatch(/permanentRedirect/)
  })

  it('shows it on the document pages too, where "not found" is a result and says so, in both languages, with no look of a real document', () => {
    expect(readFileSync('src/app/(docs)/loading.tsx', 'utf8')).toContain('@/components/site/DocsWait')
    for (const file of ['src/app/(docs)/not-found.tsx', 'src/app/(docs)/verify/[token]/not-found.tsx']) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).toMatch(/NOT FOUND|NO VERIFICATION RECORD FOUND/); expect(text, file).toMatch(/TIDAK DITEMUKAN/)
      expect(text, file).toMatch(/Do not rely|Nothing on this page/)                  // the disclaimer: it is not a document
    }
  })

  it('sends the frame of the page before the database answers: the menu and the footer are read inside their own Suspense', () => {
    const layout = readFileSync(site('layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/await getNav|await getSettings|Promise\.all\(\[getNav/)
    expect(layout).toContain('<SiteHeader'); expect(layout).toContain('<SiteFooter')
  })
})
