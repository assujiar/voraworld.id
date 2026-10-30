import { AdminPage, fmt, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'

/** What each kind of record is called, and where its page is. A kind not listed here is shown with its stored name made readable. */
const OBJECTS: Record<string, { name: string; href?: (id: number) => string }> = {
  invoice: { name: 'Invoice', href: (id) => `/admin/invoices/${id}` }, receipt: { name: 'Receipt', href: (id) => `/admin/receipts/${id}` },
  prepayment: { name: 'Pre-Payment Receipt', href: (id) => `/admin/prepayment-receipts/${id}` }, prepayment_receipt: { name: 'Pre-Payment Receipt', href: (id) => `/admin/prepayment-receipts/${id}` },
  quotation: { name: 'Quotation', href: (id) => `/admin/quotations/${id}` }, customer: { name: 'Customer', href: (id) => `/admin/customers/${id}` },
  lead: { name: 'Lead', href: (id) => `/admin/leads/${id}` }, delivery: { name: 'Delivery Note', href: (id) => `/admin/deliveries/${id}` },
  document: { name: 'Document', href: (id) => `/admin/documents/${id}` }, payment: { name: 'Payment' }, bank_account: { name: 'Bank Account' },
  article: { name: 'Article', href: (id) => `/admin/articles/${id}` }, page: { name: 'Page', href: (id) => `/admin/pages/${id}` },
}
const readable = (s: string) => { const t = s.replace(/[_-]+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1) }

export default async function Audit({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('audit_logs', (q) => q.order('id', { ascending: false }), 'created_at,actor_id,verb,object_type,object_id,summary', 200)
  const ids = [...new Set(rows.map((r) => r.actorId as number | null).filter((x): x is number => x != null))]
  const people = ids.length ? await many('users', (q) => q.in('id', ids), 'id,email') : []
  const who = new Map(people.map((u) => [u.id as number, u.email as string]))
  return (
    <AdminPage heading="Activity log" sp={await searchParams}>
      <div className="admin-panel"><p className="note mini">Who did what, newest first. The log is kept for traceability and cannot be edited.</p>
        <table><thead><tr><th>When</th><th>By</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>
          {rows.map((r, i) => {
            const object = OBJECTS[r.objectType as string]
            const id = r.objectId as number
            return (
              <tr key={i}><td>{fmt(r.createdAt as Date)}</td><td>{r.actorId == null ? 'System' : who.get(r.actorId as number) ?? `Account ${r.actorId}`}</td><td>{readable(r.verb as string)}</td>
                <td>{object?.href ? <a href={object.href(id)}>{object.name} #{id}</a> : `${object?.name ?? readable(r.objectType as string)}${id ? ` #${id}` : ''}`}</td><td>{r.summary as string}</td></tr>
            )
          })}
        </tbody></table></div>
    </AdminPage>
  )
}
