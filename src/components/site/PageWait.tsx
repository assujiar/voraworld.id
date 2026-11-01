'use client'
import { useParams } from 'next/navigation'
import { PageLoader } from '@/components/feedback/VoraLoader'

/**
 * What a public page shows while its data is on the way: the VORA logo arriving, with a thin line running under it. It comes in after a moment (see `.vl-page` in feedback.css), so a page
 * that is quick never flashes it. The header stays where it is; only the page area is replaced.
 *
 * It is used by the pages of fixed content (About, Solutions, Network, FAQ, Contact), through a `loading.tsx` next to each. It is deliberately NOT put on the whole site: a page behind a
 * loading boundary starts to be sent before it is known whether it exists, so an address that does not exist would be answered 200 instead of 404. The pages that can say "not found"
 * (the catch-all pages, an article, a service, a verification link) therefore keep waiting for their data before they answer.
 */
export default function PageWait() {
  const locale = useParams<{ locale?: string }>()?.locale
  return <PageLoader variant="logo" label={locale === 'id' ? 'Memuat halaman…' : 'Loading the page…'} />
}
