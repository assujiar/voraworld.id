import type { Viewport } from 'next'
import Script from 'next/script'
import { notFound } from 'next/navigation'
import { Header } from '@/components/site/Header'
import { Footer } from '@/components/site/Footer'
import { isLocale, makeT } from '@/content'
import { jsonLd } from '@/lib/metadata'
import { absoluteUrl, getNav, getSettings } from '@/server/site'

// Content is editable in the admin, so pages are rendered per request.
export const dynamic = 'force-dynamic'
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
        <link rel="stylesheet" href="/static/css/site.css" />
        <link rel="stylesheet" href="/static/css/experience.css?v=4" />
        <link rel="stylesheet" href="/static/css/motion.css?v=2" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} />
      </head>
      <body>
        <div className="vora-scroll-progress" aria-hidden="true"><span className="vora-scroll-progress__fill" /></div>
        <a className="skip-link" href="#main">{t('Skip to content', 'Langsung ke konten')}</a>
        <Header locale={locale} nav={nav} />
        <main id="main">{children}</main>
        <Footer locale={locale} settings={settings} />
        <Script src="/static/js/experience.js?v=2" strategy="afterInteractive" />
      </body>
    </html>
  )
}
