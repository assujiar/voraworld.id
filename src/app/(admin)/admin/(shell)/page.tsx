import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { money } from '@/server/money'

export default async function Dashboard({ searchParams }: { searchParams: Promise<Notices> }) {
  const sp = await searchParams
  const [[c], leads, invoices] = await Promise.all([
    sql`select (select count(*) from leads)::int as leads, (select count(*) from leads where status = 'new')::int as new_leads,
               (select count(*) from articles where status = 'published')::int as published,
               (select count(*) from invoices where status in ('issued', 'partially_paid'))::int as outstanding`,
    sql`select id, name, type, status from leads order by id desc limit 8`,
    sql`select id, number, status, outstanding_minor, currency from invoices order by id desc limit 8`,
  ])
  return (
    <AdminPage heading="Overview" sp={sp}>
      <div className="metrics">
        <div className="metric"><strong>{c.leads}</strong><span>All leads</span></div>
        <div className="metric"><strong>{c.newLeads}</strong><span>New leads</span></div>
        <div className="metric"><strong>{c.published}</strong><span>Published articles</span></div>
        <div className="metric"><strong>{c.outstanding}</strong><span>Unpaid invoices</span></div>
      </div>
      <div className="dashboard-split">
        <div className="admin-panel"><h3>Recent leads</h3>
          <table><thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead><tbody>
            {leads.length ? leads.map((l) => <tr key={l.id as number}><td><a href={`/admin/leads/${l.id}`}>{l.name as string}</a></td><td>{l.type as string}</td><td>{l.status as string}</td></tr>) : <tr><td colSpan={3}>No leads yet.</td></tr>}
          </tbody></table></div>
        <div className="admin-panel"><h3>Accounts receivable</h3>
          <table><thead><tr><th>Invoice</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>
            {invoices.length ? invoices.map((i) => <tr key={i.id as number}><td><a href={`/admin/invoices/${i.id}`}>{i.number as string}</a></td><td>{i.status as string}</td><td>{money(i.outstandingMinor as number, i.currency as string)}</td></tr>) : <tr><td colSpan={3}>No invoices yet.</td></tr>}
          </tbody></table></div>
      </div>
    </AdminPage>
  )
}
