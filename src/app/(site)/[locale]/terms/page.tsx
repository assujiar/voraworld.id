import { LegalPage, legalText } from '@/components/site/LegalPage'
import { seoDescription } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const { html: text, fallback } = await legalText(locale, 'terms')
  return pageMetadata({ locale, path: '/terms', title: locale === 'en' ? 'Terms of Use | VORA' : 'Ketentuan Penggunaan | VORA', description: seoDescription[locale], noindex: !text || fallback })
}

export default async function Terms({ params }: LocaleParams) {
  return <LegalPage locale={await localeOf(params)} kind="terms" />
}
