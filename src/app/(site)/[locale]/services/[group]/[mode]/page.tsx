import { notFound } from 'next/navigation'
import { ServicePage } from '@/components/site/ServicePage'
import { isLocale, serviceGroups, serviceModes } from '@/content'
import { pageMetadata } from '@/lib/metadata'

type P = { params: Promise<{ locale: string; group: string; mode: string }> }
const valid = (group: string, mode: string) => Boolean(serviceModes[group]?.[mode])

export async function generateMetadata({ params }: P) {
  const { locale, group, mode } = await params
  if (!isLocale(locale) || !valid(group, mode)) return {}
  const m = serviceModes[group][mode][locale]
  return pageMetadata({ locale, path: `/services/${group}/${mode}`, title: `${m[0]} | VORA Freight & Logistics`, description: m[1] })
}

export default async function ServiceMode({ params }: P) {
  const { locale, group, mode } = await params
  if (!isLocale(locale) || !serviceGroups[group] || !valid(group, mode)) notFound()
  return <ServicePage locale={locale} group={group} mode={mode} />
}
