import { notFound } from 'next/navigation'
import { businessDateTime } from '@/server/dates'
import { deliveryBy, proofsOf, TOKEN } from '@/server/delivery/deliveries'

export const metadata = { title: { absolute: 'VORA Proof of Delivery' } }
const CONDITION: Record<string, string> = { good: 'Good', damaged: 'Damaged', partial: 'Partially received' }

/** The finished proof of delivery, for the consignee who is emailed this address. It shows the recorded evidence and nothing of VORA's accounts. */
export default async function PodView({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const d = TOKEN.test(token) ? await deliveryBy('view_token', token) : null
  if (!d) notFound()
  const proof = d.status === 'delivered' ? (await proofsOf(d.id)).find((p) => p.status === 'submitted') : undefined
  const base = `/pod/view/${token}/evidence`
  return (
    <main className="wrap" style={{ maxWidth: 720, paddingTop: 24, paddingBottom: 48 }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" alt="VORA" width={130} /></a>
      <div className="form-panel" style={{ marginTop: 20 }}>
        <span className="eyebrow">Proof of delivery / Bukti pengiriman</span>
        <h1 style={{ fontSize: '1.7rem', margin: '6px 0 12px' }}>{proof ? 'RECEIVED' : 'NOT AVAILABLE'}</h1>
        <p><strong>Delivery note:</strong> {d.number}<br />{d.shipperName ? <><strong>Sender:</strong> {d.shipperName}<br /></> : null}<strong>Consignee:</strong> {d.consigneeName}{d.destination ? <><br /><strong>Destination:</strong> {d.destination}</> : null}</p>
        {!proof ? <p className="note">There is no proof of delivery to show for this delivery note.</p> : (
          <>
            <p><strong>Delivered by:</strong> {proof.courierName || '-'}<br />
              <strong>Received by:</strong> {proof.receiverName}, {proof.receiverPosition}<br />
              <strong>Time of receipt:</strong> {businessDateTime(proof.serverTime)} WIB<br />
              <strong>Condition of the goods:</strong> {CONDITION[proof.condition] ?? proof.condition}{proof.conditionNote ? ` (${proof.conditionNote})` : ''}<br />
              <strong>Location:</strong> {proof.locationStatus === 'captured' && proof.latitude !== null && proof.longitude !== null
                ? <a href={`https://www.google.com/maps?q=${proof.latitude},${proof.longitude}`} target="_blank" rel="noopener noreferrer">{proof.latitude.toFixed(5)}, {proof.longitude.toFixed(5)}</a>
                : 'not shared by the driver'}</p>
            <table><thead><tr><th>#</th><th>Description</th><th>Qty</th></tr></thead><tbody>
              {d.items.map((i, k) => <tr key={k}><td>{k + 1}</td><td>{i.description}</td><td>{i.quantity} {i.unit}</td></tr>)}
            </tbody></table>
            <h3 style={{ marginTop: 22 }}>Signature</h3>
            <img src={`${base}/signature`} alt="Signature of the receiver" style={{ maxWidth: '100%', maxHeight: 160, background: '#fff', border: '1px solid #dcdfe1', borderRadius: 6 }} />
            <h3 style={{ marginTop: 22 }}>Photos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {proof.photos.map((p, k) => <a key={p.position} href={`${base}/photo-${k + 1}`} target="_blank" rel="noopener"><img src={`${base}/photo-${k + 1}`} alt={`Photo ${k + 1} of the goods`} style={{ width: '100%', borderRadius: 6 }} /></a>)}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
