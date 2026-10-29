import { LegalPage } from '@/components/site/LegalPage'
import { seoDescription } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getSettings } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const text = ((await getSettings()).privacy ?? '').trim()
  return pageMetadata({ locale, path: '/privacy', title: locale === 'en' ? 'Privacy Notice | VORA' : 'Pemberitahuan Privasi | VORA', description: seoDescription[locale], noindex: !text })
}

export default async function Privacy({ params }: LocaleParams) {
  return <LegalPage locale={await localeOf(params)} kind="privacy" />
}
