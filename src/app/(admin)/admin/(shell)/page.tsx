import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { count, many } from '@/server/data'
import { money } from '@/server/money'
import { setupChecklist } from '@/server/setup-check'

export default async function Dashboard({ searchParams }: { searchParams: Promise<Notices> }) {
  const sp = await searchParams
  const checks = await setupChecklist()
  const todo = checks.filter((k) => !k.ok)
  const [leadCount, newLeads, published, outstanding, leads, invoices] = await Promise.all([
    count('leads'), count('leads', (f) => f.eq('status', 'new')), count('articles', (f) => f.eq('status', 'published')), count('invoices', (f) => f.in('status', ['issued', 'partially_paid'])),
    many('leads', (f) => f.order('id', { ascending: false }), 'id,name,type,status', 8),
    many('invoices', (f) => f.order('id', { ascending: false }), 'id,number,status,outstanding_minor,currency', 8),
  ])
  const c = { leads: leadCount, newLeads, published, outstanding }
  return (
    <AdminPage heading="Overview" sp={sp}>
      <details className="admin-panel" open={todo.some((k) => k.level === 'launch')}>
        <summary style={{ cursor: 'pointer', fontWeight: 650 }}>
          Setup checklist <span className="status">{checks.length - todo.length} of {checks.length} ready</span>
        </summary>
        <p className="muted mini" style={{ marginTop: 10 }}>What this server can see of your Vercel, Supabase and email setup. It shows presence only, never a secret value.</p>
        <table><tbody>
          {checks.map((k) => (
            <tr key={k.id}>
              <td style={{ width: 28 }} aria-label={k.ok ? 'Ready' : 'To do'}>{k.ok ? '✓' : '!'}</td>
              <td><strong>{k.label}</strong>{k.ok ? null : <><br /><span className="muted mini">{k.hint}{k.href ? <> <a href={k.href}>Open</a></> : null}</span></>}</td>
              <td style={{ width: 90 }}><span className="status">{k.ok ? 'ready' : k.level === 'launch' ? 'before launch' : 'recommended'}</span></td>
            </tr>
          ))}
        </tbody></table>
      </details>
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
