import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { money } from '@/server/money'

const STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void']

export default async function Invoices({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const rows = await sql`select i.id, i.number, i.due_at, i.status, i.total_minor, i.outstanding_minor, i.currency, c.name as customer
    from invoices i join customers c on c.id = i.customer_id
    where (${q} = '' or i.number ilike ${like} or c.name ilike ${like} or i.po_number ilike ${like} or i.shipment_reference ilike ${like}) and (${status} = '' or i.status = ${status})
    order by i.id desc limit 300`
  return (
    <AdminPage heading="Invoices" sp={sp} newHref="/admin/invoices/new" newLabel="New invoice">
      <div className="admin-panel">
        <form method="get" className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number, customer, PO or job" />
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="button">Filter</button>
        </form>
        <table><thead><tr><th>Document no.</th><th>Customer</th><th>Due</th><th>Status</th><th>Total</th><th>Outstanding</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/invoices/${r.id}`}>{r.number as string}</a></td><td>{r.customer as string}</td><td>{r.dueAt as string}</td>
              <td><span className="status">{r.status as string}</span></td><td>{money(r.totalMinor as number, r.currency as string)}</td><td>{money(r.outstandingMinor as number, r.currency as string)}</td>
            </tr>
          )) : <tr><td colSpan={6}>No invoices found.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
