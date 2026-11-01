import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The logo wait for slow data (components/site/PageWait.tsx) and where it may be used. */
const site = (p: string) => `src/app/(site)/[locale]/${p}`

describe('the wait for a public page', () => {
  it('shows the logo loader on the pages of fixed content', () => {
    for (const page of ['about', 'solutions', 'network', 'faq', 'contact']) {
      const file = site(`${page}/loading.tsx`)
      expect(existsSync(file), file).toBe(true)
      expect(readFileSync(file, 'utf8')).toContain('@/components/site/PageWait')
    }
    expect(readFileSync('src/components/site/PageWait.tsx', 'utf8')).toContain('PageLoader')
  })

  it('is not put on a whole section or the whole site, because a page behind a loading boundary answers 200 before it knows whether it exists', () => {
    // A boundary at the language level, at the root of the document pages, or on a section that has a dynamic page below it would turn a missing address into 200.
    for (const file of [site('loading.tsx'), 'src/app/(docs)/loading.tsx', site('services/loading.tsx'), site('insights/loading.tsx'), site('[...slug]/loading.tsx')]) expect(existsSync(file), file).toBe(false)
  })

  it('sends the frame of the page before the database answers: the menu and the footer are read inside their own Suspense', () => {
    const layout = readFileSync(site('layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/await getNav|await getSettings|Promise\.all\(\[getNav/)
    expect(layout).toContain('<SiteHeader'); expect(layout).toContain('<SiteFooter')
  })
})
