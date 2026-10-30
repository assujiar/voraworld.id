import { AdminPage, ListLoad, type Notices } from '@/components/admin/AdminPage'
import { many, searchClause, withRelated } from '@/server/data'
import { money } from '@/server/money'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'
import { INVOICE_LABEL, label } from '@/server/finance/labels'

const STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void']

export default async function Invoices({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  return (
    <AdminPage heading="Invoices" sp={sp} newHref="/admin/invoices/new" newLabel="New invoice">
      <div className="admin-panel">
        <StepForm className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number, customer, PO or job" />
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s} value={s}>{label(INVOICE_LABEL, s)}</option>)}</select>
          <AsyncButton className="button">Filter</AsyncButton>
        </StepForm>
        <ListLoad filters={[q, status]} what="invoices" columns={6}><InvoiceRows q={q} status={status} /></ListLoad>
      </div>
    </AdminPage>
  )
}

async function InvoiceRows({ q, status }: { q: string; status: string }) {
  const clause = await searchClause(q, ['number', 'po_number', 'shipment_reference'], [{ table: 'customers', columns: ['name'], fk: 'customer_id' }])
  const found = await many('invoices', (f) => (status ? (clause ? f.or(clause) : f).eq('status', status) : clause ? f.or(clause) : f).order('id', { ascending: false }), 'id,number,due_at,status,total_minor,outstanding_minor,currency,customer_id', 300)
  const rows = await withRelated(found, 'customers', 'customerId', { name: 'customer' })
  return (
      <table><thead><tr><th>Document no.</th><th>Customer</th><th>Due</th><th>Status</th><th>Total</th><th>Outstanding</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/invoices/${r.id}`}>{r.number as string}</a></td><td>{r.customer as string}</td><td>{r.dueAt as string}</td>
              <td><span className="status">{label(INVOICE_LABEL, r.status)}</span></td><td>{money(r.totalMinor as number, r.currency as string)}</td><td>{money(r.outstandingMinor as number, r.currency as string)}</td>
            </tr>
          )) : <tr><td colSpan={6}>No invoices found.</td></tr>}
        </tbody></table>
  )
}
