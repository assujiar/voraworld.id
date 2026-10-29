import { notFound } from 'next/navigation'
import { quotationStatusAction, requestApprovalAction, reviewApprovalAction } from '@/actions/finance'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { money } from '@/server/money'
import { routeId } from '@/server/http'

export default async function QuotationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const [q] = id > 0 && id < 2_147_483_647 ? await sql`select * from quotations where id = ${id}` : []
  if (!q) notFound()
  const [recipient] = q.customerId
    ? await sql`select name, email from customers where id = ${q.customerId as number}`
    : await sql`select coalesce(nullif(company, ''), name) as name, email from leads where id = ${q.leadId as number}`
  const items = await sql`select * from quotation_items where quotation_id = ${id} order by id`
  const approvals = await sql`select * from quotation_approvals where quotation_id = ${id} order by id desc limit 20`
  const cur = q.currency as string
  const here = `/admin/quotations/${id}`
  return (
    <AdminPage heading="Quotation" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{q.number as string} <span className="status">{q.status as string}</span></h3>
        <p>Recipient: <strong>{recipient?.name as string}</strong>{recipient?.email ? ` · ${recipient.email}` : ''} · Issued {q.issuedAt as string} · Valid until {q.validUntil as string}</p>
        <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
          {items.map((i) => <tr key={i.id as number}><td>{i.description as string}</td><td>{i.quantity as string}</td><td>{i.unit as string}</td><td>{money(i.priceMinor as number, cur)}</td><td>{money(i.amountMinor as number, cur)}</td></tr>)}
        </tbody></table>
        <div className="metrics" style={{ margin: '25px 0' }}>
          <div className="metric"><span>Subtotal</span><strong style={{ fontSize: '1.4rem' }}>{money(q.subtotalMinor as number, cur)}</strong></div>
          <div className="metric"><span>Tax ({q.taxPercent as string}%)</span><strong style={{ fontSize: '1.4rem' }}>{money(q.taxMinor as number, cur)}</strong></div>
          <div className="metric"><span>Total</span><strong style={{ fontSize: '1.4rem' }}>{money(q.totalMinor as number, cur)}</strong></div>
        </div>
        {q.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{q.notes as string}</p> : null}
        <div className="inline-actions">
          {q.status === 'draft' ? <form action={quotationStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button" name="action" value="issue">Issue quotation</button></form> : null}
          {q.status !== 'void' ? <form action={quotationStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline" name="action" value="void">Void</button></form> : null}
          <a className="button-outline" href={`/admin/quotations/${id}/pdf`} target="_blank" rel="noopener">View PDF ↗</a>
        </div>
      </div>
      {['issued', 'awaiting_approval'].includes(q.status as string) ? (
        <form action={requestApprovalAction} className="admin-panel">
          <input type="hidden" name="record" value={id} /><Back to={here} />
          <h4>Customer signature &amp; company stamp</h4>
          <p className="note">Sends the quotation PDF through the configured SMTP with a private, expiring link. The customer uploads the signed and stamped PDF. Nothing is approved until Finance has reviewed it manually. A new request revokes earlier links.</p>
          <button className="button">Send quotation for customer approval</button>
        </form>
      ) : null}
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
                    <textarea name="review_note" placeholder="Review notes (optional)" />
                    <div className="inline-actions"><button className="button" name="action" value="approve">Approve</button><button className="button-outline" name="action" value="reject">Reject</button></div>
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
