import { notFound } from 'next/navigation'
import { uploadStampAction, voidReceiptAction } from '@/actions/finance'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { maxUploadBytes } from '@/server/env'
import { money } from '@/server/money'

export default async function ReceiptDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = Number((await params).id) || 0
  const [r] = id > 0 && id < 2_147_483_647 ? await sql`select r.*, i.number as invoice_number, i.currency, i.total_minor, i.outstanding_minor, c.name as customer_name,
      p.amount_minor, p.date as payment_date, p.method, p.reference, p.confirmed_at
    from receipts r join invoices i on i.id = r.invoice_id join customers c on c.id = i.customer_id join payments p on p.id = r.payment_id where r.id = ${id}` : []
  if (!r) notFound()
  const cur = r.currency as string
  const here = `/admin/receipts/${id}`
  const status = r.status as string
  const maxMb = Math.floor(maxUploadBytes() / 1048576)
  return (
    <AdminPage heading="Receipt" sp={await searchParams}>
      <div className="admin-panel">
        <h2 style={{ fontSize: '2rem' }}>{r.number as string}</h2>
        <p>Status: <span className="status">{status.replace('_', ' ')}</span></p>
        <p>Invoice <a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a> · {r.customerName as string}<br />
          Payment of <strong>{money(r.amountMinor as number, cur)}</strong> on {r.paymentDate as string} · {r.method as string}{r.reference ? ` · ${r.reference}` : ''}<br />
          Confirmed {fmt(r.confirmedAt as Date)} UTC · Invoice balance now {money(r.outstandingMinor as number, cur)}</p>
        {status === 'pending_stamp' ? (
          <div className="admin-panel">
            <h3>Manual e-meterai required</h3>
            <p className="note">Download the draft receipt, apply an authentic e-meterai manually through an authorised provider, then upload the stamped PDF. The receipt is not released to the customer, and cannot be verified as final, before this step. VORA calls no external API and does not check the stamp itself: that review is yours.</p>
            <a className="button-outline" href={`/admin/receipts/${id}/pdf`} target="_blank" rel="noopener">Download PDF for stamping ↗</a>
            <form action={uploadStampAction} encType="multipart/form-data" style={{ marginTop: 16 }}>
              <input type="hidden" name="record" value={id} /><Back to={here} />
              <div className="admin-form-grid">
                <div className="field"><label>Official e-meterai serial / reference *</label><input name="stamp_provider_reference" required minLength={6} maxLength={160} /></div>
                <div className="field"><label>Final stamped PDF (max {maxMb} MB) *</label><input type="file" name="stamped_pdf" accept="application/pdf" required /></div>
              </div>
              <div className="field"><label><input type="checkbox" name="approved" value="1" required /> I reviewed the original document and the applied e-meterai.</label></div>
              <button className="button">Save final stamped receipt</button>
            </form>
          </div>
        ) : r.stampRequired && status !== 'void' ? (
          <p className="note">Stamped PDF uploaded and stored privately (SHA-256 {(r.stampSha256 as string)?.slice(0, 16)}…). Official e-meterai reference: {r.stampProviderReference as string}</p>
        ) : null}
        <div className="inline-actions">
          {status !== 'void' ? <a className="button" href={`/admin/receipts/${id}/pdf`} target="_blank" rel="noopener">{status === 'pending_stamp' ? 'Download PDF draft' : 'Download final PDF'} ↗</a> : null}
          {status !== 'void' ? <form action={voidReceiptAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline">Void receipt and reverse payment</button></form> : null}
        </div>
      </div>
    </AdminPage>
  )
}
