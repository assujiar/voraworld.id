import { InquiryPage } from '@/components/site/InquiryPage'
import { seoDescription, seoTitles } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'

type P = LocaleParams & { searchParams: Promise<{ sent?: string; error?: string }> }

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/contact', title: seoTitles[locale].contact, description: seoDescription[locale] })
}

export default async function Contact({ params, searchParams }: P) {
  return <InquiryPage locale={await localeOf(params)} kind="contact" sp={await searchParams} />
}
