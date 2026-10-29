import { notFound } from 'next/navigation'
import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { CustomerForm } from '@/components/admin/CustomerForm'
import { sql } from '@/server/db'
import { money } from '@/server/money'
import type { CustomersRow } from '@/server/schema'
import { routeId } from '@/server/http'

export default async function EditCustomer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const [c] = id > 0 && id < 2_147_483_647 ? await sql`select * from customers where id = ${id}` : []
  if (!c) notFound()
  const quotations = await sql`select id, number, status, total_minor, currency from quotations where customer_id = ${id} order by id desc limit 50`
  const invoices = await sql`select id, number, status, total_minor, outstanding_minor, currency, issued_at from invoices where customer_id = ${id} order by id desc limit 50`
  return (
    <AdminPage heading="Edit customer" sp={await searchParams}>
      <CustomerForm customer={c as CustomersRow} />
      <div className="dashboard-split">
        <div className="admin-panel"><h3>Quotations</h3>
          <table><thead><tr><th>Number</th><th>Status</th><th>Total</th></tr></thead><tbody>
            {quotations.length ? quotations.map((q) => <tr key={q.id as number}><td><a href={`/admin/quotations/${q.id}`}>{q.number as string}</a></td><td>{q.status as string}</td><td>{money(q.totalMinor as number, q.currency as string)}</td></tr>) : <tr><td colSpan={3}>None yet.</td></tr>}
          </tbody></table>
        </div>
        <div className="admin-panel"><h3>Invoices</h3>
          <table><thead><tr><th>Number</th><th>Issued</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>
            {invoices.length ? invoices.map((i) => <tr key={i.id as number}><td><a href={`/admin/invoices/${i.id}`}>{i.number as string}</a></td><td>{(i.issuedAt as string) || day(null)}</td><td>{i.status as string}</td><td>{money(i.outstandingMinor as number, i.currency as string)}</td></tr>) : <tr><td colSpan={4}>None yet.</td></tr>}
          </tbody></table>
        </div>
      </div>
    </AdminPage>
  )
}
