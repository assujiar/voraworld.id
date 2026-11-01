import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import type { Locale } from '@/content'
import { jsonLd } from '@/lib/metadata'
import { absoluteUrl, getNav, getSettings } from '@/server/site'

/**
 * The parts of every public page that need the database: the menu, the footer text and the organisation data. They are separate server components, each inside its own `Suspense` in the
 * layout, so that the page's frame (the head, the styles, the header with the brand and the footer's place) is sent at once and the logo loader can show while the data is on the way.
 * Before this, the layout waited for all of it before sending a single byte, and a slow database showed a blank wait.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  return <Header locale={locale} nav={await getNav(locale)} />
}

export async function SiteFooter({ locale }: { locale: Locale }) {
  return <Footer locale={locale} settings={await getSettings()} />
}

/** Organisation data comes only from administrator-entered settings: nothing is invented. */
export async function OrganizationData() {
  const settings = await getSettings()
  const organization: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Organization', name: 'VORA', legalName: settings.legal_name || 'PT Satu Arah International', url: absoluteUrl('') }
  if (settings.email) organization.email = settings.email
  if (settings.address) organization.address = { '@type': 'PostalAddress', streetAddress: settings.address }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} />
}
