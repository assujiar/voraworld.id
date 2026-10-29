import { InquiryPage } from '@/components/site/InquiryPage'
import { seoDescription, seoTitles } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'

type P = LocaleParams & { searchParams: Promise<{ sent?: string; mode?: string; error?: string }> }

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/request-quote', title: seoTitles[locale].quote, description: seoDescription[locale] })
}

export default async function RequestQuote({ params, searchParams }: P) {
  return <InquiryPage locale={await localeOf(params)} kind="quote" sp={await searchParams} />
}
