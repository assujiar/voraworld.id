import type { Metadata } from 'next'
import { absoluteUrl } from '@/server/site'
import type { Locale } from '@/content'

interface Options { locale: Locale; path: string; title: string; description: string; type?: 'website' | 'article'; noindex?: boolean }

/** Title, description, canonical, hreflang alternates, Open Graph and robots for one public page. */
export function pageMetadata({ locale, path, title, description, type = 'website', noindex = false }: Options): Metadata {
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '')
  const at = (l: Locale) => absoluteUrl(`/${l}${clean === '/' ? '' : clean}`)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: at(locale), languages: { en: at('en'), id: at('id') } },
    openGraph: { title, description, type, url: at(locale) },
    twitter: { card: 'summary_large_image' },
    robots: noindex ? { index: false, follow: false } : undefined,
  }
}

/** JSON for a <script type="application/ld+json">: `<` is escaped so content can never close the tag. */
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')
