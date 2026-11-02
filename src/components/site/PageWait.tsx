'use client'
import { useParams } from 'next/navigation'
import { PageLoader } from '@/components/feedback/VoraLoader'

/**
 * What a public page shows while its data is on the way: the VORA logo arriving, with a thin line running under it. It comes in after a moment (see `.vl-page` in feedback.css), so a page
 * that is quick never flashes it. The header stays where it is; only the page area is replaced.
 *
 * It is used by the pages that cannot answer "not found" or send a visitor somewhere else, through a `loading.tsx` next to each: the home page, the fixed pages (About, Solutions, Network,
 * FAQ, Contact, Privacy, Terms, Request a quote) and the lists of services and of articles (these three sit in a route group, so that the pages below them are not covered). It is
 * deliberately NOT put on the whole site: a page behind a loading boundary starts to be sent before it is known whether it exists or where it should go, so an address that does not exist
 * would be answered 200 instead of 404, and an old address would be sent on by a script instead of a real 301. The pages that can say either (the catch-all pages with their redirects,
 * an article, a service) therefore keep waiting for their data before they answer. The document pages are different, and have their own (DocsWait): for them "not found" is a result.
 */
export default function PageWait() {
  const locale = useParams<{ locale?: string }>()?.locale
  return <PageLoader variant="logo" label={locale === 'id' ? 'Memuat halaman…' : 'Loading the page…'} />
}
