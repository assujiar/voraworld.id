import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { count, many } from '@/server/data'
import { INVOICE_LABEL, LEAD_LABEL, label } from '@/server/finance/labels'
import { money } from '@/server/money'
import { setupChecklist } from '@/server/setup-check'

export default async function Dashboard({ searchParams }: { searchParams: Promise<Notices> }) {
  const sp = await searchParams
  const checks = await setupChecklist()
  const todo = checks.filter((k) => !k.ok)
  // What needs a person's attention now. Every number is a live count of real records and links to the list that holds them.
  const [newLeads, toValidate, awaitingProof, unpaid, awaitingFunds, awaitingStamp, awaitingPrepaymentStamp, mailFailed, leads, invoices] = await Promise.all([
    count('leads', (f) => f.eq('status', 'new')),
    count('quotations', (f) => f.eq('status', 'customer_approved')),
    count('deliveries', (f) => f.eq('status', 'issued')),
    count('invoices', (f) => f.in('status', ['issued', 'partially_paid'])),
    count('payments', (f) => f.eq('status', 'pending_confirmation')),
    count('receipts', (f) => f.eq('status', 'pending_stamp')),
    count('prepayment_receipts', (f) => f.eq('status', 'pending_stamp')),
    count('email_jobs', (f) => f.in('status', ['failed', 'retry'])),
    many('leads', (f) => f.order('id', { ascending: false }), 'id,name,type,status', 8),
    many('invoices', (f) => f.order('id', { ascending: false }), 'id,number,status,outstanding_minor,currency', 8),
  ])
  const attention: Array<{ n: number; label: string; href: string; hint: string }> = [
    { n: newLeads, label: 'New leads', href: '/admin/leads?status=new', hint: 'Not contacted yet' },
    { n: toValidate, label: 'Quotations to validate', href: '/admin/quotations?status=customer_approved', hint: 'The customer has signed; check the signature and stamp' },
    { n: awaitingProof, label: 'Delivery notes awaiting proof', href: '/admin/deliveries?status=issued', hint: 'Issued, not yet received' },
    { n: unpaid, label: 'Unpaid invoices', href: '/admin/invoices', hint: 'Issued or partly paid' },
    { n: awaitingFunds, label: 'Payments to confirm', href: '/admin/invoices', hint: 'Menunggu Konfirmasi Pembayaran' },
    { n: awaitingStamp + awaitingPrepaymentStamp, label: 'Receipts awaiting e-meterai', href: '/admin/receipts', hint: 'Held back until the stamped file is stored' },
    { n: mailFailed, label: 'Emails that failed', href: '/admin/mail', hint: 'Check the delivery log and retry' },
  ]
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
      <h3 style={{ margin: '4px 0 10px' }}>Needs attention</h3>
      <div className="metrics">
        {attention.map((a) => (
          <a key={a.label} className="metric" href={a.href} style={{ textDecoration: 'none', color: 'inherit', opacity: a.n ? 1 : 0.6 }}>
            <strong>{a.n}</strong><span>{a.label}</span><small className="muted">{a.hint}</small>
          </a>
        ))}
      </div>
      <div className="dashboard-split">
        <div className="admin-panel"><h3>Recent leads</h3>
          <table><thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead><tbody>
            {leads.length ? leads.map((l) => <tr key={l.id as number}><td><a href={`/admin/leads/${l.id}`}>{l.name as string}</a></td><td>{l.type as string}</td><td>{label(LEAD_LABEL, l.status)}</td></tr>) : <tr><td colSpan={3}>No leads yet.</td></tr>}
          </tbody></table></div>
        <div className="admin-panel"><h3>Accounts receivable</h3>
          <table><thead><tr><th>Invoice</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>
            {invoices.length ? invoices.map((i) => <tr key={i.id as number}><td><a href={`/admin/invoices/${i.id}`}>{i.number as string}</a></td><td>{label(INVOICE_LABEL, i.status)}</td><td>{money(i.outstandingMinor as number, i.currency as string)}</td></tr>) : <tr><td colSpan={3}>No invoices yet.</td></tr>}
          </tbody></table></div>
      </div>
    </AdminPage>
  )
}
