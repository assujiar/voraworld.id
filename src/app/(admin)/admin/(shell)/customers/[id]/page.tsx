import { notFound } from 'next/navigation'
import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { CustomerForm } from '@/components/admin/CustomerForm'
import { many, one } from '@/server/data'
import { money } from '@/server/money'
import type { CustomersRow } from '@/server/schema'
import { routeId } from '@/server/http'
import { QUOTATION_LABEL } from '@/server/finance/labels'

export default async function EditCustomer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const c = id > 0 && id < 2_147_483_647 ? await one('customers', (f) => f.eq('id', id)) : undefined
  if (!c) notFound()
  const [leads, quotations, deliveries, invoices] = await Promise.all([
    many('leads', (f) => f.eq('customer_id', id).order('id', { ascending: false }), 'id,reference,type,created_at', 50),
    many('quotations', (f) => f.eq('customer_id', id).order('id', { ascending: false }), 'id,number,status,total_minor,currency', 100),
    many('deliveries', (f) => f.eq('customer_id', id).order('id', { ascending: false }), 'id,number,status,delivery_date,quotation_id', 100),
    many('invoices', (f) => f.eq('customer_id', id).order('id', { ascending: false }), 'id,number,status,total_minor,outstanding_minor,currency,issued_at', 100),
  ])
  const invoiceIds = invoices.map((i) => i.id as number)
  const payments = invoiceIds.length ? await many('payments', (f) => f.in('invoice_id', invoiceIds).order('id', { ascending: false }), 'id,invoice_id,amount_minor,status,date', 100) : []
  const receipts = invoiceIds.length ? await many('receipts', (f) => f.in('invoice_id', invoiceIds).order('id', { ascending: false }), 'id,number,status,invoice_id', 100) : []
  const invoiceNumber = new Map(invoices.map((i) => [i.id as number, i.number as string]))
  const cur = c.currency as string
  return (
    <AdminPage heading="Customer" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{c.name as string} <small className="muted">· {(c.publicCode as string) || 'Legacy customer'}</small></h3>
        <div className="inline-actions">
          <a className="button" href={`/admin/quotations/new?customer=${id}`}>Buat Quotation</a>
          <a className="button-outline" href="#quotations">Lihat Quotations ({quotations.length})</a>
          <a className="button-outline" href="#deliveries">Lihat Delivery Notes ({deliveries.length})</a>
          <a className="button-outline" href="#invoices">Lihat Invoices ({invoices.length})</a>
          <a className="button-outline" href="#payments">Lihat Pembayaran ({payments.length})</a>
          <a className="button-outline" href="#documents">Lihat Dokumen Terkait</a>
        </div>
        <p className="mini muted" style={{ marginTop: 10 }}>{leads.length ? `Came from ${leads.length} lead${leads.length > 1 ? 's' : ''}` : 'No lead is linked: this customer was entered directly, and everything below works the same.'}</p>
      </div>
      <CustomerForm customer={c as unknown as CustomersRow} />
      <div className="dashboard-split">
        <div className="admin-panel" id="quotations"><h3>Quotations</h3>
          <table><thead><tr><th>Number</th><th>Status</th><th>Total</th></tr></thead><tbody>
            {quotations.length ? quotations.map((q) => <tr key={q.id as number}><td><a href={`/admin/quotations/${q.id}`}>{q.number as string}</a></td><td>{QUOTATION_LABEL[q.status as string] ?? (q.status as string)}</td><td>{money(q.totalMinor as number, q.currency as string)}</td></tr>) : <tr><td colSpan={3}>None yet.</td></tr>}
          </tbody></table>
        </div>
        <div className="admin-panel" id="deliveries"><h3>Delivery notes</h3>
          <div className="inline-actions" style={{ marginBottom: 8 }}><a className="button-outline" href={`/admin/deliveries/new?customer=${id}`}>New delivery note</a></div>
          <table><thead><tr><th>Number</th><th>Date</th><th>Status</th></tr></thead><tbody>
            {deliveries.length ? deliveries.map((d) => <tr key={d.id as number}><td><a href={`/admin/deliveries/${d.id}`}>{d.number as string}</a></td><td>{d.deliveryDate as string}</td><td>{d.status as string}</td></tr>) : <tr><td colSpan={3}>None yet.</td></tr>}
          </tbody></table>
        </div>
      </div>
      <div className="dashboard-split">
        <div className="admin-panel" id="invoices"><h3>Invoices</h3>
          <div className="inline-actions" style={{ marginBottom: 8 }}><a className="button-outline" href={`/admin/invoices/new?customer=${id}`}>New invoice</a></div>
          <table><thead><tr><th>Number</th><th>Issued</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>
            {invoices.length ? invoices.map((i) => <tr key={i.id as number}><td><a href={`/admin/invoices/${i.id}`}>{i.number as string}</a></td><td>{(i.issuedAt as string) || day(null)}</td><td>{i.status as string}</td><td>{money(i.outstandingMinor as number, i.currency as string)}</td></tr>) : <tr><td colSpan={4}>None yet.</td></tr>}
          </tbody></table>
        </div>
        <div className="admin-panel" id="payments"><h3>Payments</h3>
          <table><thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {payments.length ? payments.map((p) => <tr key={p.id as number}><td><a href={`/admin/invoices/${p.invoiceId}`}>{invoiceNumber.get(p.invoiceId as number)}</a></td><td>{(p.date as string) || '-'}</td><td>{money(p.amountMinor as number, cur)}</td><td>{p.status as string}</td></tr>) : <tr><td colSpan={4}>None yet.</td></tr>}
          </tbody></table>
        </div>
      </div>
      <div className="admin-panel" id="documents"><h3>Related documents</h3>
        <p className="mini muted">Leads that became this customer, and the official receipts issued to it.</p>
        <table><thead><tr><th>Document</th><th>Reference</th><th>Status</th></tr></thead><tbody>
          {leads.map((l) => <tr key={`l${l.id}`}><td>Lead</td><td><a href={`/admin/leads/${l.id}`}>{(l.reference as string) || `#${l.id}`}</a></td><td>{l.type as string}</td></tr>)}
          {receipts.map((r) => <tr key={`r${r.id}`}><td>Official receipt</td><td><a href={`/admin/receipts/${r.id}`}>{r.number as string}</a></td><td>{r.status as string}</td></tr>)}
          {!leads.length && !receipts.length ? <tr><td colSpan={3}>None.</td></tr> : null}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
