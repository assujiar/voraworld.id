import { notFound } from 'next/navigation'
import { submitApprovalAction } from '@/actions/approval'
import { approvalByToken, approvalIsOpen } from '@/server/finance/quotations'
import { maxUploadBytes } from '@/server/env'
import { money } from '@/server/money'

export const metadata = { title: { absolute: 'Customer approval | VORA' } }

/** The customer's private page: download the Price Agreement Letter (the quotation), sign and stamp it, upload it for VORA's review. */
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
        <h1 style={{ fontSize: 'clamp(2rem,4vw,2.6rem)' }}>Review and approve the Price Agreement Letter</h1>
        <p>Reference: <strong>{a.quotationNumber}</strong> · Total <strong>{money(a.totalMinor, a.currency)}</strong> · Valid until <strong>{a.validUntil}</strong></p>
        {sp.received ? <div className="alert" role="status"><strong>Document received.</strong> Your signed Price Agreement Letter has been submitted for review by VORA. This is not an automatic approval confirmation.</div> : null}
        {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
        <p className="note">Approval status: <strong>{state}</strong></p>
        {a.paymentTerms || a.termsConditions ? (
          <div style={{ margin: '22px 0' }}>
            <h2 style={{ fontSize: '1.15rem' }}>What your signature accepts</h2>
            {a.paymentTerms ? <><h3 style={{ fontSize: '.95rem', margin: '14px 0 4px' }}>Terms of payment</h3><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.paymentTerms}</p></> : null}
            {a.termsConditions ? <><h3 style={{ fontSize: '.95rem', margin: '14px 0 4px' }}>Terms &amp; conditions</h3><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.termsConditions}</p></> : null}
          </div>
        ) : null}
        {open ? (
          <>
            <h2 style={{ fontSize: '1.15rem' }}>How to approve</h2>
            <ol style={{ paddingLeft: 20, lineHeight: 1.6 }}>
              <li><a href={`/quotation-approval/${token}/pdf`}>Download the Price Agreement Letter (PDF)</a> and read the terms above.</li>
              <li>Sign in the <strong>Authorized signature</strong> box, apply your company stamp in the <strong>Company stamp</strong> box, and write your name, position and the date.</li>
              <li>Upload the complete signed PDF below. VORA reviews every submission manually; uploading is not an automatic approval.</li>
            </ol>
            <form action={submitApprovalAction}>
              <input type="hidden" name="token" value={token} />
              <div className="field"><label>Full name of the authorised signatory</label><input name="signer_name" maxLength={180} required /></div>
              <div className="field"><label>Position / title</label><input name="signer_title" maxLength={180} required /></div>
              <div className="field"><label>Signed and company-stamped Price Agreement Letter, PDF (max {Math.floor(maxUploadBytes() / 1048576)} MB)</label><input name="signed_pdf" type="file" accept="application/pdf" required /></div>
              <div className="field"><label style={{ fontWeight: 400 }}><input type="checkbox" name="ack" value="yes" required style={{ width: 'auto', minHeight: 0, marginRight: 8 }} />I confirm that I am authorised to agree to this Price Agreement Letter on behalf of my company, including the terms shown above, and to submit the signed and company-stamped PDF for review by VORA.</label></div>
              <button className="button">Submit for VORA review</button>
            </form>
          </>
        ) : (
          <>
            {a.status === 'submitted' ? <p><a href={`/quotation-approval/${token}/pdf`}>Download the Price Agreement Letter (PDF)</a></p> : null}
            {!sp.received ? <p>This request is no longer accepting documents. Please contact VORA by email if you need a new link.</p> : null}
          </>
        )}
        <p className="muted mini" style={{ marginTop: 22 }}>Uploading a document does not automatically constitute VORA&apos;s acceptance. An authorised administrator reviews every submission.</p>
      </div>
    </main>
  )
}
