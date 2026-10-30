import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { many, searchClause } from '@/server/data'

const STATUSES = ['draft', 'issued', 'delivered', 'void']

export default async function Deliveries({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  const clause = await searchClause(q, ['number', 'consignee_name', 'destination', 'shipment_reference', 'po_number'])
  const rows = await many('deliveries', (f) => {
    let b = clause ? f.or(clause) : f
    if (status) b = b.eq('status', status)
    return b.order('id', { ascending: false })
  }, 'id,number,status,consignee_name,destination,delivery_date,delivered_at,created_at', 300)
  return (
    <AdminPage heading="Delivery Notes" sp={sp}>
      <div className="admin-panel">
        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <p className="note" style={{ margin: 0 }}>A delivery note (surat jalan) carries a QR code. The receiver scans it, signs on their phone and photographs the goods: that is the proof of delivery.</p>
          <a className="button" href="/admin/deliveries/new">New delivery note</a>
        </div>
        <form method="get" className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number, consignee, destination or reference" />
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="button">Filter</button>
        </form>
        <table><thead><tr><th>Delivery note</th><th>Consignee</th><th>Destination</th><th>Date</th><th>Status</th><th>Received</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/deliveries/${r.id}`}>{r.number as string}</a></td>
              <td>{r.consigneeName as string}</td><td>{r.destination as string}</td><td>{r.deliveryDate as string}</td>
              <td><span className="status">{r.status as string}</span></td>
              <td>{r.deliveredAt ? day(r.deliveredAt as Date) : '-'}</td>
            </tr>
          )) : <tr><td colSpan={6}>No delivery notes found.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
