import { notFound } from 'next/navigation'
import { cancelPaymentAction, confirmPaymentAction, ensurePrepaymentAction, invoiceStatusAction, sendInvoiceAction } from '@/actions/finance'
import { VerificationPanel } from '@/components/admin/VerificationPanel'
import { fileHref } from '@/content/file-names'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { MailHistory } from '@/components/admin/MailHistory'
import { RecordPaymentForm } from '@/components/admin/RecordPaymentForm'
import { DELIVERY_LABEL, INVOICE_LABEL, PAYMENT_LABEL, QUOTATION_LABEL, RECEIPT_LABEL, label } from '@/server/finance/labels'
import { mailHistory } from '@/server/mail/history'
import { many, one, withRelated, type Row } from '@/server/data'
import { today } from '@/server/dates'
import { money } from '@/server/money'
import { routeId } from '@/server/http'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function InvoiceDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const invoice = id > 0 && id < 2_147_483_647 ? await one('invoices', (q) => q.eq('id', id)) : undefined
  const [inv] = invoice ? await withRelated([invoice], 'customers', 'customerId', { name: 'customerName', email: 'customerEmail', address: 'customerAddress', tax_id: 'customerTaxId' }) : []
  if (!inv) notFound()
  const cur = inv.currency as string
  const items = await many('invoice_items', (q) => q.eq('invoice_id', id).order('id'))
  const banks = await many('invoice_bank_instructions', (q) => q.eq('invoice_id', id).order('position'))
  const payments = await paymentsWithReceipts(id)
  const quotation = inv.quotationId ? await one('quotations', (q) => q.eq('id', inv.quotationId as number), 'id,number,status') : undefined
  const links = await many('invoice_delivery_notes', (q) => q.eq('invoice_id', id).order('id'), 'delivery_id,released_at')
  const billedDeliveries = links.length ? await many('deliveries', (q) => q.in('id', links.map((l) => l.deliveryId as number)).order('id'), 'id,number,status,delivery_date') : []
  const lead = inv.quotationId ? await one('quotations', (q) => q.eq('id', inv.quotationId as number), 'lead_id').then((qq) => (qq?.leadId ? one('leads', (q) => q.eq('id', qq.leadId as number), 'id,reference') : undefined)) : undefined
  const emails = await mailHistory('invoice', id)
  const prepayment = (await many('prepayment_receipts', (q) => q.eq('invoice_id', id), 'id,number,status,stamp_required')).sort((a, b) => Number(a.status === 'void') - Number(b.status === 'void') || (b.id as number) - (a.id as number))[0]
  const accounts = (await many('bank_accounts', (q) => q.eq('active', true).eq('currency', cur).order('position'), 'id,bank_name,account_number')).map((b) => ({ id: b.id as number, label: `${b.bankName} · ${b.accountNumber}` }))
  const here = `/admin/invoices/${id}`
  const status = inv.status as string
  const open = ['issued', 'partially_paid'].includes(status)
  const shipment = [
    inv.poNumber && `PO ${inv.poNumber}`, inv.shipmentReference && `Job ${inv.shipmentReference}`, inv.serviceMode,
    (inv.origin || inv.destination) && `${inv.origin || '—'} → ${inv.destination || '—'}`, inv.transportDocumentRef && `B/L–AWB ${inv.transportDocumentRef}`,
  ].filter(Boolean) as string[]
  return (
    <AdminPage heading="Invoice" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{inv.number as string} <span className="status">{INVOICE_LABEL[status] ?? status}</span></h3>
        <p><strong>Customer:</strong> <a href={`/admin/customers/${inv.customerId}`}>{inv.customerName as string}</a>{inv.customerEmail ? ` · ${inv.customerEmail}` : ''}<br />
          <strong>Issued:</strong> {inv.issuedAt as string} · <strong>Due:</strong> {inv.dueAt as string}</p>
        <p className="mini">{quotation ? <>Quotation <a href={`/admin/quotations/${quotation.id}`}>{quotation.number as string}</a> ({QUOTATION_LABEL[quotation.status as string] ?? (quotation.status as string)}){lead ? <> · from lead <a href={`/admin/leads/${lead.id}`}>{(lead.reference as string) || `#${lead.id}`}</a></> : null}</> : 'Made before invoices were linked to a quotation'}
          {billedDeliveries.length ? <> · Delivery notes: {billedDeliveries.map((d, k) => <span key={d.id as number}>{k ? ', ' : ''}<a href={`/admin/deliveries/${d.id}`}>{d.number as string}</a>{links.find((l) => l.deliveryId === d.id)?.releasedAt ? ' (released)' : ''}</span>)}</> : null}</p>
        {shipment.length ? <p className="mini muted">{shipment.join(' · ')}</p> : null}
        <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
          {items.map((i) => <tr key={i.id as number}><td>{i.description as string}</td><td>{i.quantity as string}</td><td>{i.unit as string}</td><td>{money(i.priceMinor as number, cur)}</td><td>{money(i.amountMinor as number, cur)}</td></tr>)}
        </tbody></table>
        <div className="metrics" style={{ margin: '25px 0' }}>
          <div className="metric"><span>Subtotal</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.subtotalMinor as number, cur)}</strong></div>
          {(inv.discountMinor as number) ? <div className="metric"><span>Discount</span><strong style={{ fontSize: '1.4rem' }}>-{money(inv.discountMinor as number, cur)}</strong></div> : null}
          <div className="metric"><span>Tax ({inv.taxPercent as string}%)</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.taxMinor as number, cur)}</strong></div>
          {(inv.withholdingMinor as number) ? <div className="metric"><span>Withholding ({inv.withholdingPercent as string}%)</span><strong style={{ fontSize: '1.4rem' }}>-{money(inv.withholdingMinor as number, cur)}</strong></div> : null}
          <div className="metric"><span>Total</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.totalMinor as number, cur)}</strong></div>
          <div className="metric"><span>Outstanding</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.outstandingMinor as number, cur)}</strong></div>
        </div>
        {inv.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{inv.notes as string}</p> : null}
        <div className="admin-panel"><h4>Payment instructions (frozen when the invoice was created)</h4>
          {banks.length ? banks.map((b) => <p key={b.id as number} style={{ fontFamily: 'monospace' }}>{b.bankName as string} · {b.accountNumber as string} · {b.accountHolder as string} · {b.currency as string}{b.swiftCode ? ` · SWIFT ${b.swiftCode}` : ''}</p>) : <p className="note">No payment account was selected for this invoice.</p>}
        </div>
        <div className="admin-panel"><h4>Pre-payment receipt</h4>
          {prepayment ? (
            <p><a href={`/admin/prepayment-receipts/${prepayment.id}`}>{prepayment.number as string}</a> <span className="status">{label(RECEIPT_LABEL, prepayment.status)}</span>
              {' '}· <a href={`/admin/prepayment-receipts/${prepayment.id}/pdf`} target="_blank" rel="noopener">PDF ↗</a>
              {prepayment.stampRequired ? ' · needs a manual e-meterai (amount above IDR 5,000,000, or foreign currency)' : ' · no e-meterai needed'}
              {prepayment.status === 'draft' ? <><br /><span className="mini muted">Released when the invoice is issued.</span></> : null}</p>
          ) : (
            <>
              <p className="note">{['draft', 'issued'].includes(status) ? 'This invoice has no pre-payment receipt.' : 'A pre-payment receipt can only be made while the invoice is unpaid.'}</p>
              {['draft', 'issued'].includes(status) && (inv.totalMinor as number) > 0 ? <PendingForm action={ensurePrepaymentAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button-outline">Create pre-payment receipt</AsyncButton></PendingForm> : null}
            </>
          )}
        </div>
        <div className="inline-actions">
          {status === 'draft' ? <PendingForm action={invoiceStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button" name="action" value="issue">Issue invoice</AsyncButton></PendingForm> : null}
          {['draft', 'issued'].includes(status) ? <PendingForm action={invoiceStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button-outline" name="action" value="void">Void</AsyncButton></PendingForm> : null}
          <a className="button-outline" href={fileHref(`/admin/invoices/${id}/pdf`, inv.number as string)} target="_blank" rel="noopener">Download PDF ↗</a>
          {!['draft', 'void'].includes(status) ? <PendingForm action={sendInvoiceAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button-outline">Kirim Invoice &amp; Pre-Payment Receipt</AsyncButton></PendingForm> : null}
        </div>
        {open ? <><hr /><RecordPaymentForm invoiceId={id} currency={cur} today={today()} banks={accounts} /></> : null}
        <p className="note mini">Sending the invoice and its pre-payment receipt is not a payment: the balance changes only when a recorded payment is confirmed as funds received.</p>
        <h3 style={{ marginTop: 25 }}>Payments</h3>
        <table><thead><tr><th>Receipt</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {payments.length ? payments.map((p) => (
            <tr key={p.id as number}>
              <td>{p.receiptId ? <a href={`/admin/receipts/${p.receiptId}`}>{p.receiptNumber as string}</a> : '—'}</td>
              <td>{money(p.amountMinor as number, cur)}<br /><small>{p.method as string}{p.reference ? ` · ${p.reference}` : ''}</small></td>
              <td>{p.date as string}</td>
              <td><span className="status">{PAYMENT_LABEL[p.status as string] ?? (p.status as string)}</span>
                {p.status === 'pending_confirmation' ? (
                  <>
                    <PendingForm action={confirmPaymentAction} style={{ marginTop: 9 }}>
                      <input type="hidden" name="record" value={p.id as number} /><Back to={here} />
                      {p.receivingBankSnapshot ? <p className="mini muted">Receiving account: {(p.receivingBankSnapshot as Record<string, string>).bank_name} · {(p.receivingBankSnapshot as Record<string, string>).account_number}</p> : (
                        <div className="field"><label className="mini">VORA account that received the money</label>
                          <select name="receiving_bank_id" defaultValue=""><option value="">Select the receiving account</option>{accounts.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
                        </div>
                      )}
                      <label className="mini" style={{ display: 'block' }}><input type="checkbox" name="funds_cleared" value="yes" required /> I verified that the funds are effectively credited to PT Satu Arah International</label>
                      <AsyncButton className="button" style={{ marginTop: 7 }}>Konfirmasi Dana Diterima</AsyncButton>
                    </PendingForm>
                    <PendingForm action={cancelPaymentAction} style={{ marginTop: 5 }}><input type="hidden" name="record" value={p.id as number} /><Back to={here} /><AsyncButton className="button-outline">Reject / cancel</AsyncButton></PendingForm>
                  </>
                ) : p.status === 'recorded' ? <small style={{ display: 'block' }}>Confirmed {fmt(p.confirmedAt as Date)} UTC</small> : null}
              </td>
            </tr>
          )) : <tr><td colSpan={4}>No payments yet.</td></tr>}
        </tbody></table>
      </div>
      <MailHistory lines={emails} />
      <VerificationPanel kind="invoice" id={id} />
    </AdminPage>
  )
}

/** Each payment of the invoice with the receipt it produced, if any. */
async function paymentsWithReceipts(invoiceId: number): Promise<Row[]> {
  const payments = await many('payments', (q) => q.eq('invoice_id', invoiceId).order('id', { ascending: false }))
  if (!payments.length) return payments
  const receipts = await many('receipts', (q) => q.in('payment_id', payments.map((p) => p.id as number)), 'id,number,payment_id')
  return payments.map((p) => {
    const r = receipts.find((x) => x.paymentId === p.id)
    return { ...p, receiptId: r?.id, receiptNumber: r?.number }
  })
}
