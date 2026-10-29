import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'

export default async function Customers({ searchParams }: { searchParams: Promise<Notices & { q?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const rows = await sql`select id, name, email, currency, terms_days, public_code from customers
    where (${q} = '' or name ilike ${like} or email ilike ${like} or public_code ilike ${like}) order by id desc limit 300`
  return (
    <AdminPage heading="Customers" sp={sp} newHref="/admin/customers/new" newLabel="New customer">
      <div className="admin-panel">
        <form method="get" className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search name, email or owner code" />
          <button className="button">Search</button>
        </form>
        <table><thead><tr><th>Company / person</th><th>Contact</th><th>Currency</th><th>Terms</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/customers/${r.id}`}>{r.name as string}</a><small> · {(r.publicCode as string) || 'Legacy customer'}</small></td>
              <td>{r.email as string}</td><td>{r.currency as string}</td><td>{r.termsDays as number} days</td>
            </tr>
          )) : <tr><td colSpan={4}>No customers yet.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
