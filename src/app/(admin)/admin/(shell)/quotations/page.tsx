import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { money } from '@/server/money'

const STATUSES = ['draft', 'issued', 'awaiting_approval', 'approved', 'void']

export default async function Quotations({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const rows = await sql`select q.id, q.number, q.status, q.valid_until, q.total_minor, q.currency,
      coalesce(c.name, nullif(l.company, ''), l.name) as recipient
    from quotations q left join customers c on c.id = q.customer_id left join leads l on l.id = q.lead_id
    where (${q} = '' or q.number ilike ${like} or c.name ilike ${like} or l.name ilike ${like} or l.company ilike ${like}) and (${status} = '' or q.status = ${status})
    order by q.id desc limit 300`
  return (
    <AdminPage heading="Quotations" sp={sp} newHref="/admin/quotations/new" newLabel="New quotation">
      <div className="admin-panel">
        <p className="note">Quotation numbers are generated once and never change. Create one for an existing customer or lead.</p>
        <form method="get" className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number or recipient" />
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="button">Filter</button>
        </form>
        <table><thead><tr><th>Quotation</th><th>Recipient</th><th>Valid until</th><th>Status</th><th>Total</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/quotations/${r.id}`}>{r.number as string}</a></td><td>{r.recipient as string}</td><td>{r.validUntil as string}</td>
              <td><span className="status">{r.status as string}</span></td><td>{money(r.totalMinor as number, r.currency as string)}</td>
            </tr>
          )) : <tr><td colSpan={5}>No quotations found.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
