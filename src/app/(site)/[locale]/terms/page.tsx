import { LegalPage } from '@/components/site/LegalPage'
import { seoDescription } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getSettings } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const text = ((await getSettings()).terms ?? '').trim()
  return pageMetadata({ locale, path: '/terms', title: locale === 'en' ? 'Terms of Use | VORA' : 'Ketentuan Penggunaan | VORA', description: seoDescription[locale], noindex: !text })
}

export default async function Terms({ params }: LocaleParams) {
  return <LegalPage locale={await localeOf(params)} kind="terms" />
}
