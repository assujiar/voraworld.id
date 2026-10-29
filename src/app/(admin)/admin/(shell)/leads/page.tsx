import { LEAD_STATUSES } from '@/server/lead-constants'
import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'

export default async function Leads({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = LEAD_STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const rows = await sql`select id, reference, name, company, email, type, status, priority, created_at from leads
    where (${q} = '' or name ilike ${like} or company ilike ${like} or email ilike ${like}) and (${status} = '' or status = ${status})
    order by id desc limit 250`
  return (
    <AdminPage heading="Leads" sp={sp}>
      <div className="admin-panel">
        <form method="get" className="inline-actions">
          <input placeholder="Search name, company, email" name="q" defaultValue={q} />
          <select name="status" defaultValue={status}><option value="">All status</option>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="button">Filter</button>
          <a className="button-outline" href="/admin/leads.csv">Export CSV</a>
        </form>
        <table><thead><tr><th>Reference</th><th>Lead</th><th>Type</th><th>Created</th><th>Pipeline</th><th>Priority</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td>{(r.reference as string) || `Legacy #${r.id}`}</td>
              <td><a href={`/admin/leads/${r.id}`}>{r.name as string}</a><br /><small>{(r.company as string) || (r.email as string)}</small></td>
              <td>{r.type as string}</td><td>{day(r.createdAt as Date)}</td><td><span className="status">{r.status as string}</span></td><td>{r.priority as string}</td>
            </tr>
          )) : <tr><td colSpan={6}>No matching leads.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
