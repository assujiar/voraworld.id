import { notFound } from 'next/navigation'
import { deliveryStatusAction, rejectProofAction, resendReceivedAction } from '@/actions/deliveries'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { deliveryBy, proofsOf } from '@/server/delivery/deliveries'
import { publicBaseUrl } from '@/server/env'
import { routeId } from '@/server/http'

const CONDITION: Record<string, string> = { good: 'Good', damaged: 'Damaged', partial: 'Partial' }

export default async function DeliveryDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const d = id > 0 && id < 2_147_483_647 ? await deliveryBy('id', id) : null
  if (!d) notFound()
  const proofs = await proofsOf(id)
  const live = proofs.find((p) => p.status === 'submitted')
  const base = publicBaseUrl()
  const here = `/admin/deliveries/${id}`
  const facts: Array<[string, string]> = [
    ['Date', d.deliveryDate], ['Reference', d.shipmentReference], ['PO number', d.poNumber], ['From', d.origin], ['To', d.destination], ['Carrier', d.carrier],
    ['Vehicle', [d.vehicle, d.vehiclePlate].filter(Boolean).join(' / ')], ['Driver', [d.driverName, d.driverPhone].filter(Boolean).join(' / ')],
  ]
  return (
    <AdminPage heading="Delivery note" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{d.number} <span className="status">{d.status}</span></h3>
        <p><strong>{d.consigneeName}</strong>{d.customerId ? <> · <a href={`/admin/customers/${d.customerId}`}>customer</a></> : null}<br />
          {d.consigneeAddress ? <>{d.consigneeAddress}<br /></> : null}
          {[d.consigneeContact, d.consigneePhone, d.consigneeEmail].filter(Boolean).join(' · ')}<br />
          Created {fmt(d.createdAt)}{d.issuedAt ? ` · issued ${fmt(d.issuedAt)}` : ''}{d.deliveredAt ? ` · received ${fmt(d.deliveredAt)}` : ''}</p>
        <dl style={{ margin: '14px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="mini muted">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>)}
        </dl>
        <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Remarks</th></tr></thead><tbody>
          {d.items.map((i, k) => <tr key={k}><td>{k + 1}</td><td>{i.description}</td><td>{i.quantity}</td><td>{i.unit}</td><td>{i.remarks}</td></tr>)}
        </tbody></table>
        {d.notes ? <p style={{ whiteSpace: 'pre-wrap' }}><strong>Notes:</strong> {d.notes}</p> : null}
        {d.status === 'issued' ? <p className="mini muted">Receiver&apos;s address (the QR code on the PDF opens it; share it only with the receiver): <a href={`/pod/${d.captureToken}`} target="_blank" rel="noopener">{base}/pod/{d.captureToken}</a></p> : null}
        <div className="inline-actions">
          {d.status === 'draft' ? <a className="button-outline" href={`/admin/deliveries/${id}/edit`}>Edit draft</a> : null}
          {d.status === 'draft' ? <form action={deliveryStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button" name="action" value="issue">Issue delivery note</button></form> : null}
          <a className="button-outline" href={`/admin/deliveries/${id}/pdf`} target="_blank" rel="noopener">{d.status === 'draft' || d.status === 'void' ? `Download PDF (marked ${d.status})` : 'Download PDF'} ↗</a>
          {d.status === 'draft' || d.status === 'issued' ? <form action={deliveryStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline" name="action" value="void">Void</button></form> : null}
        </div>
        {d.status === 'draft' ? <p className="note mini">A draft is marked DRAFT on every page and its QR code does not work yet. Issuing makes the QR code live; to change an issued note, void it and write a new one.</p> : null}
      </div>

      <div className="admin-panel">
        <h3>Proof of delivery</h3>
        {!proofs.length ? <p className="note">{d.status === 'issued' ? 'Waiting for the receiver to scan the QR code on the printed note.' : 'No proof of delivery yet. It can be given only after the note is issued.'}</p> : null}
        {proofs.map((p) => (
          <div key={p.id} style={{ borderTop: '1px solid var(--rule, #dcdfe1)', paddingTop: 14, marginTop: 14, opacity: p.status === 'rejected' ? 0.7 : 1 }}>
            <p><span className="status">{p.status}</span> <strong>{p.receiverName}</strong>, {p.receiverPosition} · {p.receiverPhone}{p.receiverEmail ? ` · ${p.receiverEmail}` : ''}{p.receiverIdNumber ? ` · ID ${p.receiverIdNumber}` : ''}<br />
              Received {fmt(p.serverTime)} (server time){p.deviceTime ? ` · phone clock ${fmt(new Date(p.deviceTime))}` : ''}<br />
              Condition: <strong>{CONDITION[p.condition] ?? p.condition}</strong>{p.conditionNote ? ` · ${p.conditionNote}` : ''}<br />
              {p.locationStatus === 'captured' && p.latitude !== null && p.longitude !== null
                ? <>Location: <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</a>{p.accuracyM !== null ? ` (accuracy ${Math.round(p.accuracyM)} m)` : ''}</>
                : <>Location: not shared by the receiver{p.locationNote ? ` (${p.locationNote})` : ''}</>}<br />
              <span className="mini muted">From {p.ip || 'unknown address'} · {p.userAgent.slice(0, 120)}</span>
              {p.status === 'rejected' ? <><br />Rejected {p.rejectedAt ? fmt(p.rejectedAt) : ''}: {p.rejectReason}</> : null}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <a href={`/admin/deliveries/${id}/evidence/signature?proof=${p.id}`} target="_blank" rel="noopener"><img src={`/admin/deliveries/${id}/evidence/signature?proof=${p.id}`} alt="Signature" style={{ height: 90, background: '#fff', border: '1px solid #dcdfe1', borderRadius: 6 }} /></a>
              {p.photos.map((ph, k) => <a key={ph.position} href={`/admin/deliveries/${id}/evidence/photo-${k + 1}?proof=${p.id}`} target="_blank" rel="noopener"><img src={`/admin/deliveries/${id}/evidence/photo-${k + 1}?proof=${p.id}`} alt={`Photo ${k + 1}`} style={{ height: 90, borderRadius: 6 }} /></a>)}
            </div>
          </div>
        ))}
        {live ? (
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <a className="button-outline" href={`/admin/deliveries/${id}/pod-pdf`} target="_blank" rel="noopener">Download proof of delivery (PDF) ↗</a>
            <a className="button-outline" href={`/pod/view/${d.viewToken}`} target="_blank" rel="noopener">Open the consignee&apos;s view ↗</a>
            {d.consigneeEmail ? <form action={resendReceivedAction}><input type="hidden" name="record" value={id} /><Back to={here} /><button className="button-outline">Email the proof to the consignee again</button></form> : null}
            <form action={rejectProofAction} className="inline-actions"><input type="hidden" name="record" value={id} /><Back to={here} />
              <input name="reason" placeholder="Why is this proof wrong? (at least 5 characters)" required minLength={5} maxLength={500} style={{ minWidth: 280 }} />
              <button className="button-outline">Reject proof</button></form>
          </div>
        ) : null}
      </div>
    </AdminPage>
  )
}
