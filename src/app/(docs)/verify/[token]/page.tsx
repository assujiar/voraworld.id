import { notFound } from 'next/navigation'
import { VerifyView } from '@/components/verify/VerifyView'
import { publicBaseUrl } from '@/server/env'
import { loadVerification } from '@/server/trust/verification-view'

export const dynamic = 'force-dynamic'

/**
 * What a QR code (or link) on a VORA document opens. It reports separate findings (the record, VORA's issuance attestation, signing evidence, the file's integrity,
 * the live business status) and never one "authentic". It names the document type, reference, issuer, date and status and nothing about the customer or the amounts.
 * The time shown is the server's time of this view; it gives a screenshot some context and proves nothing.
 */
export default async function Verify({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const model = token.length <= 150 ? await loadVerification(token) : null
  if (!model) notFound()
  return <VerifyView model={model} token={token} origin={publicBaseUrl()} viewedAt={new Date()} />
}
