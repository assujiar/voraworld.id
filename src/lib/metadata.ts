import type { Metadata } from 'next'
import { absoluteUrl } from '@/server/site'
import type { Locale } from '@/content'

interface Options {
  locale: Locale; path: string; title: string; description: string; type?: 'website' | 'article'; noindex?: boolean
  /** Where the other language's version lives when its path differs (an article with a different localized slug). Absent: the same path in the other language. */
  alternates?: Partial<Record<Locale, string>>
  /** Languages that have this page. Absent: both. An article that exists in one language declares only that one. */
  languages?: Locale[]
}

/** Title, description, canonical, hreflang alternates, Open Graph and robots for one public page. */
export function pageMetadata({ locale, path, title, description, type = 'website', noindex = false, alternates, languages }: Options): Metadata {
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '')
  const at = (l: Locale) => absoluteUrl(alternates?.[l] ?? `/${l}${clean === '/' ? '' : clean}`)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: at(locale), languages: Object.fromEntries((languages ?? ['en', 'id']).map((l) => [l, at(l)])) },
    openGraph: { title, description, type, url: at(locale) },
    twitter: { card: 'summary_large_image' },
    robots: noindex ? { index: false, follow: false } : undefined,
  }
}

/** JSON for a <script type="application/ld+json">: `<` is escaped so content can never close the tag. */
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')
