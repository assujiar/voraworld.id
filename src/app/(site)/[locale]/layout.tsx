import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ICONS, MANIFEST } from '@/lib/favicons'
import { NavProgress } from '@/components/feedback/NavProgress'
import { PublicInteractions } from '@/components/site/PublicInteractions'
import { VoraAgent } from '@/components/site/VoraAgent'
import { PublicMotion } from '@/components/atelier/PublicMotion'
import { Header } from '@/components/site/Header'
import { OrganizationData, SiteFooter, SiteHeader } from '@/components/site/Chrome'
import { isLocale, makeT } from '@/content'
import { onVercel } from '@/server/env'
import { getSettings } from '@/server/site'
import { verificationMetadata } from '@/server/site-verification'

// Content is editable in the admin, so pages are rendered per request.
export const dynamic = 'force-dynamic'
export const maxDuration = 30      // form submissions queue and send email
export const viewport: Viewport = { themeColor: '#101720', width: 'device-width', initialScale: 1 }
// Search Console / Bing ownership tokens come from Site Settings, so they can be added without a deployment.
export async function generateMetadata(): Promise<Metadata> {
  const verification = verificationMetadata(await getSettings())
  return { icons: ICONS, manifest: MANIFEST, ...(verification ? { verification } : {}) }
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = makeT(locale)
  return (
    <html lang={locale}>
      <head>
        <link rel="preload" href="/static/fonts/archivo-latin-wdth.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/static/css/site.css" />
        <link rel="stylesheet" href="/static/css/vora.css?v=15" />
        <link rel="stylesheet" href="/static/css/atelier.css?v=3" />
        <link rel="stylesheet" href="/static/css/hybrid.css?v=1" />
        <link rel="stylesheet" href="/static/css/assets.css?v=2" />
        <link rel="stylesheet" href="/static/css/illustrations.css?v=1" />
        <link rel="stylesheet" href="/static/css/feedback.css?v=12" />
        <link rel="stylesheet" href="/static/css/public-motion.css?v=3" />
        <link rel="stylesheet" href="/static/css/public-ux.css?v=3" />
        <link rel="stylesheet" href="/static/css/agent.css?v=2" />
        {/* Vercel Web Analytics: cookieless visitor counts, served from this origin (so the CSP needs no new host). It only records once
            Web Analytics is enabled for the project in the Vercel dashboard; elsewhere (local, tests) the script does not exist, so it is left out. */}
        {onVercel() && <>
          <script dangerouslySetInnerHTML={{ __html: 'window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};' }} />
          <script defer src="/_vercel/insights/script.js" />
        </>}
      </head>
      <body className="v-body">
        <Suspense fallback={null}><NavProgress /><PublicMotion /><PublicInteractions /></Suspense>
        <a className="v-skip" href="#main">{t('Skip to content', 'Langsung ke konten')}</a>
        {/* The frame is sent at once; what needs the database streams in behind it (see components/site/Chrome.tsx). Until the menu is there the header shows the brand without it. */}
        <Suspense fallback={<Header locale={locale} nav={[]} />}><SiteHeader locale={locale} /></Suspense>
        <main id="main">{children}</main>
        <Suspense fallback={null}><SiteFooter locale={locale} /></Suspense>
        <Suspense fallback={null}><OrganizationData /></Suspense>
        <VoraAgent locale={locale} />
      </body>
    </html>
  )
}
