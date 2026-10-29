import { notFound, permanentRedirect } from 'next/navigation'
import { ServicePage } from '@/components/site/ServicePage'
import { serviceAliases, serviceGroups, isLocale } from '@/content'
import { pageMetadata } from '@/lib/metadata'

type P = { params: Promise<{ locale: string; group: string }> }

export async function generateMetadata({ params }: P) {
  const { locale, group } = await params
  if (!isLocale(locale) || !serviceGroups[group]) return {}
  const g = serviceGroups[group]
  return pageMetadata({ locale, path: `/services/${group}`, title: `${g[locale].name} | VORA Freight & Logistics`, description: g[locale].intro })
}

export default async function ServiceGroup({ params }: P) {
  const { locale, group } = await params
  if (!isLocale(locale)) notFound()
  if (!serviceGroups[group]) {
    // Legacy URLs such as /services/sea-freight keep working and point at the new taxonomy.
    if (serviceAliases[group]) permanentRedirect(`/${locale}/services/${serviceAliases[group]}`)
    notFound()
  }
  return <ServicePage locale={locale} group={group} />
}
