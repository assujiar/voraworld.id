import { notFound } from 'next/navigation'
import { sendPrepaymentAction, uploadPrepaymentStampAction, voidPrepaymentAction } from '@/actions/finance'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { maxUploadBytes } from '@/server/env'
import { money } from '@/server/money'
import { routeId } from '@/server/http'

export default async function PrepaymentReceiptDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const [r] = id > 0 && id < 2_147_483_647 ? await sql`select p.*, i.number as invoice_number, i.status as invoice_status, c.name as customer_name, c.email as customer_email
    from prepayment_receipts p join invoices i on i.id = p.invoice_id join customers c on c.id = i.customer_id where p.id = ${id}` : []
  if (!r) notFound()
  const here = `/admin/prepayment-receipts/${id}`
  const status = r.status as string
  const maxMb = Math.floor(maxUploadBytes() / 1048576)
  return (
    <AdminPage heading="Pre-payment receipt" sp={await searchParams}>
      <div className="admin-panel">
        <h2 style={{ fontSize: '2rem' }}>{r.number as string}</h2>
        <p>Status: <span className="status">{status.replace('_', ' ')}</span></p>
        <p>Invoice <a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a> ({(r.invoiceStatus as string).replace('_', ' ')}) · {r.customerName as string}{r.customerEmail ? ` · ${r.customerEmail}` : ''}<br />
          Amount to be received <strong>{money(r.amountMinor as number, r.currency as string)}</strong> ·{' '}
          {r.stampRequired ? 'e-meterai required (above IDR 5,000,000, or foreign currency)' : 'no e-meterai required'}</p>
        <p className="note">A pre-payment receipt is issued with the invoice, before any money arrives, for customers whose finance team needs a receipt to release the payment. It states that it is not proof of payment. The official payment receipt is still issued only after you confirm cleared funds.</p>
        {status === 'draft' ? <p className="note">It is released when the invoice is issued.</p> : null}
        {status === 'pending_stamp' ? (
          <div className="admin-panel">
            <h3>Manual e-meterai required</h3>
            <p className="note">Download the draft, apply an authentic e-meterai manually through an authorised provider, then upload the stamped PDF. The pre-payment receipt is not released to the customer, and cannot be verified as final, before this step. VORA calls no external API and does not check the stamp itself: that review is yours.</p>
            <a className="button-outline" href={`/admin/prepayment-receipts/${id}/pdf`} target="_blank" rel="noopener">Download PDF for stamping ↗</a>
            <form action={uploadPrepaymentStampAction} encType="multipart/form-data" style={{ marginTop: 16 }}>
              <input type="hidden" name="record" value={id} /><Back to={here} />
              <div className="admin-form-grid">
                <div className="field"><label>Official e-meterai serial / reference *</label><input name="stamp_provider_reference" required minLength={6} maxLength={160} /></div>
                <div className="field"><label>Final stamped PDF (max {maxMb} MB) *</label><input type="file" name="stamped_pdf" accept="application/pdf" required /></div>
              </div>
              <div className="field"><label><input type="checkbox" name="approved" value="1" required /> I reviewed the original document and the applied e-meterai.</label></div>
              <button className="button">Save final stamped pre-payment receipt</button>
            </form>
          </div>
        ) : r.stampRequired && status === 'issued' ? (
          <p className="note">Stamped PDF uploaded and stored privately (SHA-256 {(r.stampSha256 as string)?.slice(0, 16)}…). Official e-meterai reference: {r.stampProviderReference as string}</p>
        ) : null}
        <div className="inline-actions">
          {status !== 'void' ? <a className="button" href={`/admin/prepayment-receipts/${id}/pdf`} target="_blank" rel="noopener">{status === 'issued' ? 'Download final PDF' : 'Download PDF draft'} ↗</a> : null}
          {status === 'issued' ? <form action={sendPrepaymentAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline">Email pre-payment receipt to customer</button></form> : null}
          {status !== 'void' ? <form action={voidPrepaymentAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline">Void pre-payment receipt</button></form> : null}
        </div>
      </div>
    </AdminPage>
  )
}
