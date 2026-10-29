import { notFound } from 'next/navigation'
import { submitApprovalAction } from '@/actions/approval'
import { approvalByToken, approvalIsOpen } from '@/server/finance/quotations'
import { maxUploadBytes } from '@/server/env'

export const metadata = { title: { absolute: 'Customer approval | VORA' } }

/** The customer's private page: download the quotation, sign and stamp it, upload it for VORA's review. */
export default async function QuotationApproval({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; received?: string }> }) {
  const { token } = await params
  const sp = await searchParams
  const a = await approvalByToken(token)
  if (!a || a.quotationStatus === 'void') notFound()
  const expired = a.expiresAt.getTime() < Date.now()
  const open = approvalIsOpen(a)
  const state = expired && a.status === 'pending' ? 'EXPIRED' : a.status.toUpperCase()
  return (
    <main className="wrap" style={{ maxWidth: 680, paddingTop: '8vh', paddingBottom: 60 }}>
      <div className="form-panel">
        <img src="/static/assets/vora-primary.svg" alt="VORA" width={135} />
        <span className="eyebrow" style={{ marginTop: 28 }}>Customer approval workflow</span>
        <h1 style={{ fontSize: 'clamp(2rem,4vw,2.6rem)' }}>Review and approve quotation</h1>
        <p>Quotation: <strong>{a.quotationNumber}</strong></p>
        {sp.received ? <div className="alert" role="status"><strong>Document received.</strong> Your signed quotation has been submitted for review by VORA. This is not an automatic approval confirmation.</div> : null}
        {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
        <p className="note">Approval status: <strong>{state}</strong></p>
        {a.status === 'pending' || a.status === 'submitted' ? (
          <p><a href={`/quotation-approval/${token}/pdf`}>Download the quotation PDF</a>. Sign it and apply your company stamp before uploading the complete PDF for VORA&apos;s review.</p>
        ) : null}
        {open ? (
          <form action={submitApprovalAction}>
            <input type="hidden" name="token" value={token} />
            <div className="field"><label>Full name of the authorised signatory</label><input name="signer_name" maxLength={180} required /></div>
            <div className="field"><label>Position / title</label><input name="signer_title" maxLength={180} required /></div>
            <div className="field"><label>Signed and company-stamped quotation PDF (max {Math.floor(maxUploadBytes() / 1048576)} MB)</label><input name="signed_pdf" type="file" accept="application/pdf" required /></div>
            <div className="field"><label style={{ fontWeight: 400 }}><input type="checkbox" name="ack" value="yes" required style={{ width: 'auto', minHeight: 0, marginRight: 8 }} />I confirm that I am authorised to submit the signed and company-stamped quotation for review by VORA.</label></div>
            <button className="button">Submit for VORA review</button>
          </form>
        ) : !sp.received ? <p>This request is no longer accepting documents. Please contact VORA by email if you need a new link.</p> : null}
        <p className="muted mini" style={{ marginTop: 22 }}>Uploading a document does not automatically constitute VORA&apos;s acceptance. An authorised administrator reviews every submission.</p>
      </div>
    </main>
  )
}
