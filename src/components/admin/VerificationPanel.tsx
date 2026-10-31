import { fmt } from '@/components/admin/AdminPage'
import { trustPolicy } from '@/content/trust-policy'
import type { TrustKind } from '@/content/trust-policy'
import { publicBaseUrl } from '@/server/env'
import { artifactsOf } from '@/server/trust/artifacts'
import { getVerification } from '@/server/verification'

/**
 * What an administrator needs to reach about any VORA document, on its own page: the public verification page (the address printed on the PDF as a link and a QR code), the
 * evidence export, and what is archived. General documents have the fuller `DocumentTrustPanel` (with signing); this is for invoices, quotations, receipts, pre-payment receipts and
 * delivery notes, which are verified the same way.
 */
export async function VerificationPanel({ kind, id }: { kind: TrustKind; id: number }) {
  const policy = trustPolicy(kind)
  const [verification, artifacts] = await Promise.all([getVerification(kind, id), artifactsOf(kind, id)])
  if (!verification) return null
  const url = `${publicBaseUrl()}/verify/${verification.token}`
  return (
    <div className="admin-panel">
      <h4>Verification</h4>
      {verification.revoked
        ? <p className="mini">The verification page of this document shows it as no longer valid.</p>
        : <p className="mini">Anybody who scans the QR code on the PDF or opens its link sees whether this document is genuine, and its current status: <a href={`/verify/${verification.token}`} target="_blank" rel="noopener" style={{ overflowWrap: 'anywhere' }}>{url} ↗</a></p>}
      {policy.archive === 'immutable'
        ? (artifacts.length
          ? <p className="mini">The issued file is archived ({artifacts.length} version{artifacts.length > 1 ? 's' : ''}, recorded {fmt(artifacts[0].createdAt)}), with its SHA-256 and an attestation. <a href={`/admin/evidence/${kind}/${id}`}>Download the evidence export (JSON) ↓</a></p>
          : <p className="mini muted">No archived file yet: it is archived when the PDF is first made after issue.</p>)
        : <p className="mini muted">This kind of document is shown live on its verification page (its status follows the record), so no file is archived.</p>}
    </div>
  )
}
