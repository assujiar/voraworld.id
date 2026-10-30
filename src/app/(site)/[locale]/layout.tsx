import type { Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/components/site/Header'
import { Footer } from '@/components/site/Footer'
import { isLocale, makeT } from '@/content'
import { jsonLd } from '@/lib/metadata'
import { absoluteUrl, getNav, getSettings } from '@/server/site'

// Content is editable in the admin, so pages are rendered per request.
export const dynamic = 'force-dynamic'
export const maxDuration = 30      // form submissions queue and send email
export const viewport: Viewport = { themeColor: '#101720', width: 'device-width', initialScale: 1 }
export const metadata = { icons: { icon: [{ url: '/static/assets/vora-a-icon-primary.svg', type: 'image/svg+xml' }] } }

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = makeT(locale)
  const [nav, settings] = await Promise.all([getNav(locale), getSettings()])
  // Organisation data comes only from administrator-entered settings: nothing is invented.
  const organization: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Organization', name: 'VORA', legalName: settings.legal_name || 'PT Satu Arah International', url: absoluteUrl('') }
  if (settings.email) organization.email = settings.email
  if (settings.address) organization.address = { '@type': 'PostalAddress', streetAddress: settings.address }
  return (
    <html lang={locale}>
      <head>
        <link rel="preload" href="/static/fonts/archivo-latin-wdth.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/static/css/site.css" />
        <link rel="stylesheet" href="/static/css/vora.css?v=8" />
        <link rel="stylesheet" href="/static/css/feedback.css?v=4" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} />
      </head>
      <body className="v-body">
        <a className="v-skip" href="#main">{t('Skip to content', 'Langsung ke konten')}</a>
        <Header locale={locale} nav={nav} />
        <main id="main">{children}</main>
        <Footer locale={locale} settings={settings} />
      </body>
    </html>
  )
}
