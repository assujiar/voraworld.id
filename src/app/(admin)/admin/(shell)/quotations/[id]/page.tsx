import { notFound } from 'next/navigation'
import { quotationStatusAction, requestApprovalAction, reviewApprovalAction } from '@/actions/finance'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { many, one } from '@/server/data'
import { DELIVERY_LABEL, INVOICE_LABEL, QUOTATION_LABEL } from '@/server/finance/labels'
import { money } from '@/server/money'
import { routeId } from '@/server/http'

export default async function QuotationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const q = id > 0 && id < 2_147_483_647 ? await one('quotations', (f) => f.eq('id', id)) : undefined
  if (!q) notFound()
  // A historical quotation made for a lead alone has no customer: it is shown as it is, never given one. Every newer quotation has a customer.
  const lead = q.leadId ? await one('leads', (f) => f.eq('id', q.leadId as number), 'id,reference,company,name,email') : undefined
  const customer = q.customerId ? await one('customers', (f) => f.eq('id', q.customerId as number), 'id,name,email,public_code') : undefined
  const recipient = customer ?? (lead && { name: (lead.company as string) || lead.name, email: lead.email })
  const deliveries = await many('deliveries', (f) => f.eq('quotation_id', id).order('id', { ascending: false }), 'id,number,status,delivery_date', 100)
  const invoices = await many('invoices', (f) => f.eq('quotation_id', id).order('id', { ascending: false }), 'id,number,status,total_minor,outstanding_minor,currency', 100)
  const items = await many('quotation_items', (f) => f.eq('quotation_id', id).order('id'))
  const approvals = await many('quotation_approvals', (f) => f.eq('quotation_id', id).order('id', { ascending: false }), '*', 20)
  const cur = q.currency as string
  const here = `/admin/quotations/${id}`
  return (
    <AdminPage heading="Quotation" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{q.number as string} <span className="status">{QUOTATION_LABEL[q.status as string] ?? (q.status as string)}</span></h3>
        <p>For {customer ? <a href={`/admin/customers/${customer.id}`}><strong>{customer.name as string}</strong></a> : <strong>{recipient?.name as string}</strong>}{customer ? <small className="muted"> · {customer.publicCode as string}</small> : <small className="muted"> · earlier quotation made for a lead, with no customer</small>}
          {lead ? <> · from lead <a href={`/admin/leads/${lead.id}`}>{(lead.reference as string) || `#${lead.id}`}</a></> : customer ? <span className="muted"> · no lead (entered directly)</span> : null}
          <br />Issued {q.issuedAt as string} · Valid until {q.validUntil as string}{(q.validUntil as string) < new Date().toISOString().slice(0, 10) && !['validated', 'void'].includes(q.status as string) ? ' (expired)' : ''}
          {q.picName ? <><br />Attention: {q.picName as string}{q.picEmail ? ` · ${q.picEmail}` : ''}{q.picPhone ? ` · ${q.picPhone}` : ''}</> : null}
          {q.serviceMode || q.origin || q.destination ? <><br />{[q.serviceMode as string, [q.origin as string, q.destination as string].filter(Boolean).join(' → ')].filter(Boolean).join(' · ')}</> : null}
          {q.customerApprovedAt ? <><br />Signed by the customer {fmt(q.customerApprovedAt as Date)}{q.validatedAt ? ` · validated by VORA ${fmt(q.validatedAt as Date)}` : ''}</> : null}</p>
        {q.cargoInfo ? <p className="mini" style={{ whiteSpace: 'pre-wrap' }}><strong>Cargo:</strong> {q.cargoInfo as string}</p> : null}
        <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
          {items.map((i) => <tr key={i.id as number}><td>{i.description as string}</td><td>{i.quantity as string}</td><td>{i.unit as string}</td><td>{money(i.priceMinor as number, cur)}</td><td>{money(i.amountMinor as number, cur)}</td></tr>)}
        </tbody></table>
        <div className="metrics" style={{ margin: '25px 0' }}>
          <div className="metric"><span>Subtotal</span><strong style={{ fontSize: '1.4rem' }}>{money(q.subtotalMinor as number, cur)}</strong></div>
          <div className="metric"><span>Tax ({q.taxPercent as string}%)</span><strong style={{ fontSize: '1.4rem' }}>{money(q.taxMinor as number, cur)}</strong></div>
          <div className="metric"><span>Total</span><strong style={{ fontSize: '1.4rem' }}>{money(q.totalMinor as number, cur)}</strong></div>
        </div>
        {q.paymentTerms ? <><h4>Terms of payment</h4><p style={{ whiteSpace: 'pre-wrap' }}>{q.paymentTerms as string}</p></> : null}
        {q.termsConditions ? <><h4>Terms and conditions</h4><p style={{ whiteSpace: 'pre-wrap' }}>{q.termsConditions as string}</p></> : null}
        {q.notes ? <><h4>Notes</h4><p style={{ whiteSpace: 'pre-wrap' }}>{q.notes as string}</p></> : null}
        <div className="inline-actions">
          {q.status === 'draft' ? <form action={quotationStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button" name="action" value="issue">Issue quotation</button></form> : null}
          {q.status !== 'void' && (q.customerId || !['validated'].includes(q.status as string)) ? <form action={quotationStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline" name="action" value="void">Void</button></form> : null}
          <a className="button-outline" href={`/admin/quotations/${id}/pdf`} target="_blank" rel="noopener">View PDF ↗</a>
        </div>
      </div>
      {['issued', 'awaiting_approval', 'rejected'].includes(q.status as string) ? (
        <form action={requestApprovalAction} className="admin-panel">
          <input type="hidden" name="record" value={id} /><Back to={here} />
          <h4>Customer signature &amp; company stamp</h4>
          <p className="note">{q.status === 'rejected' ? 'The signed document was rejected and the quotation needs correction. When it is right, send it again. ' : ''}Sends the quotation PDF through the configured SMTP with a private, expiring link. The customer uploads the signed and stamped PDF: the quotation then becomes <em>approved by the customer</em>. It is validated only when VORA has checked the signature and stamp by hand. A new request revokes earlier links.</p>
          <button className="button">{q.status === 'rejected' ? 'Send again for customer approval' : 'Send quotation for customer approval'}</button>
        </form>
      ) : null}
      <div className="admin-panel"><h4>Related records</h4>
        {q.status === 'validated' ? (
          <div className="inline-actions" style={{ marginBottom: 10 }}>
            <a className="button" href={`/admin/deliveries/new?customer=${q.customerId}&quotation=${id}`}>New delivery note</a>
            <a className="button-outline" href={`/admin/invoices/new?customer=${q.customerId}&quotation=${id}`}>New invoice</a>
          </div>
        ) : <p className="mini muted">Delivery notes and invoices can be made once the quotation is validated.</p>}
        <div className="dashboard-split">
          <table><thead><tr><th>Delivery note</th><th>Date</th><th>Status</th></tr></thead><tbody>
            {deliveries.length ? deliveries.map((d) => <tr key={d.id as number}><td><a href={`/admin/deliveries/${d.id}`}>{d.number as string}</a></td><td>{d.deliveryDate as string}</td><td>{DELIVERY_LABEL[d.status as string] ?? (d.status as string)}</td></tr>) : <tr><td colSpan={3}>None yet.</td></tr>}
          </tbody></table>
          <table><thead><tr><th>Invoice</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>
            {invoices.length ? invoices.map((i) => <tr key={i.id as number}><td><a href={`/admin/invoices/${i.id}`}>{i.number as string}</a></td><td>{INVOICE_LABEL[i.status as string] ?? (i.status as string)}</td><td>{money(i.outstandingMinor as number, i.currency as string)}</td></tr>) : <tr><td colSpan={3}>None yet.</td></tr>}
          </tbody></table>
        </div>
      </div>
      {approvals.length ? (
        <div className="admin-panel"><h4>Customer approval history</h4>
          <table><thead><tr><th>Request</th><th>Status</th><th>Signer</th><th>Document</th><th>Review</th></tr></thead><tbody>
            {approvals.map((a) => (
              <tr key={a.id as number}>
                <td>#{a.id as number}<br /><small>Expires {fmt(a.expiresAt as Date)} UTC</small></td>
                <td>{a.status as string}</td>
                <td>{a.signerName as string}<br /><small>{a.signerTitle as string}</small></td>
                <td>{a.signedPdfKey ? <a href={`/admin/quotation-approvals/${a.id}/file`}>Download signed PDF</a> : 'Awaiting upload'}<br />{a.signedPdfSha256 ? <small title="SHA-256 recorded at upload">sha256 {(a.signedPdfSha256 as string).slice(0, 12)}…</small> : null}</td>
                <td>{a.status === 'submitted' ? (
                  <form action={reviewApprovalAction}>
                    <input type="hidden" name="record" value={a.id as number} /><Back to={here} />
                    <label><input type="checkbox" name="signature_and_stamp_verified" value="yes" /> Signature and stamp reviewed manually</label>
                    <textarea name="review_note" placeholder="Notes (required when rejecting: say what must be corrected)" />
                    <div className="inline-actions"><button className="button" name="action" value="approve">Validate Quotation</button><button className="button-outline" name="action" value="reject">Reject: needs correction</button></div>
                  </form>
                ) : (a.reviewNote as string) || '—'}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ) : null}
    </AdminPage>
  )
}
