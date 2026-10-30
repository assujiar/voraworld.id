import { notFound } from 'next/navigation'
import { PodForm } from '@/components/pod/PodForm'
import { deliveryBy, TOKEN } from '@/server/delivery/deliveries'

export const metadata = { title: { absolute: 'VORA Proof of Delivery' } }

/** What the QR code on a delivery note opens: the page where the receiver confirms receipt on their own phone. */
export default async function PodCapture({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const d = TOKEN.test(token) ? await deliveryBy('capture_token', token) : null
  if (!d) notFound()
  const refused = d.status === 'draft' ? 'This delivery note has not been issued yet.' : d.status === 'void' ? 'This delivery note was cancelled.' : d.status === 'delivered' ? 'The delivery of this note has already been recorded. Thank you.' : ''
  return (
    <main className="wrap" style={{ maxWidth: 640, paddingTop: 24, paddingBottom: 48 }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" alt="VORA" width={130} /></a>
      <div className="form-panel" style={{ marginTop: 20 }}>
        <span className="eyebrow">Driver / courier: proof of delivery / Bukti pengiriman</span>
        <h1 style={{ fontSize: '1.7rem', margin: '6px 0 12px' }}>{d.number}</h1>
        <p><strong>{d.consigneeName}</strong>{d.destination ? <><br />{d.destination}</> : null}<br /><small className="muted">Delivery date {d.deliveryDate}{d.shipmentReference ? ` · ${d.shipmentReference}` : ''}</small></p>
        <table><thead><tr><th>#</th><th>Description</th><th>Qty</th></tr></thead><tbody>
          {d.items.map((i, k) => <tr key={k}><td>{k + 1}</td><td>{i.description}{i.remarks ? <><br /><small className="muted">{i.remarks}</small></> : null}</td><td>{i.quantity} {i.unit}</td></tr>)}
        </tbody></table>
        {refused ? <p className="note" role="status" style={{ marginTop: 18 }}>{refused}</p> : <PodForm token={token} number={d.number} driverName={d.driverName} driverPhone={d.driverPhone} />}
      </div>
    </main>
  )
}
