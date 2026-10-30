import { notFound } from 'next/navigation'
import { resendReceiptAction, uploadStampAction, voidReceiptAction } from '@/actions/finance'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { MailHistory } from '@/components/admin/MailHistory'
import { one, withRelated } from '@/server/data'
import { mailHistory } from '@/server/mail/history'
import { maxUploadBytes } from '@/server/env'
import { money } from '@/server/money'
import { routeId } from '@/server/http'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'
import { RECEIPT_LABEL, label } from '@/server/finance/labels'

export default async function ReceiptDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const found = id > 0 && id < 2_147_483_647 ? await one('receipts', (q) => q.eq('id', id)) : undefined
  const withInvoice = found ? await withRelated([found], 'invoices', 'invoiceId', { number: 'invoiceNumber', currency: 'currency', total_minor: 'totalMinor', outstanding_minor: 'outstandingMinor', customer_id: 'customerId' }) : []
  const withCustomer = await withRelated(withInvoice, 'customers', 'customerId', { name: 'customerName' })
  const [r] = await withRelated(withCustomer, 'payments', 'paymentId', { amount_minor: 'amountMinor', date: 'paymentDate', method: 'method', reference: 'reference', confirmed_at: 'confirmedAt' })
  if (!r) notFound()
  const cur = r.currency as string
  const emails = await mailHistory('receipt', id)
  const invoice = await one('invoices', (q) => q.eq('id', r.invoiceId as number), 'quotation_id')
  const quotation = invoice?.quotationId ? await one('quotations', (q) => q.eq('id', invoice.quotationId as number), 'id,number') : undefined
  const here = `/admin/receipts/${id}`
  const status = r.status as string
  const maxMb = Math.floor(maxUploadBytes() / 1048576)
  return (
    <AdminPage heading="Receipt" sp={await searchParams}>
      <div className="admin-panel">
        <h2 style={{ fontSize: '2rem' }}>{r.number as string}</h2>
        <p>Status: <span className="status">{label(RECEIPT_LABEL, status)}</span></p>
        <p>Invoice <a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a> · <a href={`/admin/customers/${r.customerId}`}>{r.customerName as string}</a>{quotation ? <> · Quotation <a href={`/admin/quotations/${quotation.id}`}>{quotation.number as string}</a></> : null}<br />
          Payment of <strong>{money(r.amountMinor as number, cur)}</strong> on {r.paymentDate as string} · {r.method as string}{r.reference ? ` · ${r.reference}` : ''}<br />
          Confirmed {fmt(r.confirmedAt as Date)} UTC · Invoice balance now {money(r.outstandingMinor as number, cur)}</p>
        {status === 'pending_stamp' ? (
          <div className="admin-panel">
            <h3>Manual e-meterai required</h3>
            <p className="note">Download the draft receipt, apply an authentic e-meterai manually through an authorised provider, then upload the stamped PDF. The receipt is not released to the customer, and cannot be verified as final, before this step. VORA calls no external API and does not check the stamp itself: that review is yours.</p>
            <a className="button-outline" href={`/admin/receipts/${id}/pdf`} target="_blank" rel="noopener">Download PDF for stamping ↗</a>
            <PendingForm action={uploadStampAction} style={{ marginTop: 16 }}>
              <input type="hidden" name="record" value={id} /><Back to={here} />
              <div className="admin-form-grid">
                <div className="field"><label>Official e-meterai serial / reference *</label><input name="stamp_provider_reference" required minLength={6} maxLength={160} /></div>
                <div className="field"><label>Final stamped PDF (max {maxMb} MB) *</label><input type="file" name="stamped_pdf" accept="application/pdf" required /></div>
              </div>
              <div className="field"><label><input type="checkbox" name="approved" value="1" required /> I reviewed the original document and the applied e-meterai.</label></div>
              <AsyncButton className="button">Save final stamped receipt</AsyncButton>
            </PendingForm>
          </div>
        ) : r.stampRequired && status !== 'void' ? (
          <p className="note">Stamped PDF uploaded and stored privately (SHA-256 {(r.stampSha256 as string)?.slice(0, 16)}…). Official e-meterai reference: {r.stampProviderReference as string}</p>
        ) : null}
        <div className="inline-actions">
          {status === 'issued' ? <PendingForm action={resendReceiptAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button-outline">Send the receipt to the customer again</AsyncButton></PendingForm> : null}
          {status !== 'void' ? <a className="button" href={`/admin/receipts/${id}/pdf`} target="_blank" rel="noopener">{status === 'pending_stamp' ? 'Download PDF draft' : 'Download final PDF'} ↗</a> : null}
          {status !== 'void' ? <PendingForm action={voidReceiptAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button-outline">Void receipt and reverse payment</AsyncButton></PendingForm> : null}
        </div>
      </div>
      <MailHistory lines={emails} />
    </AdminPage>
  )
}
