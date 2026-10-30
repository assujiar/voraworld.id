import { AdminPage, ListLoad, type Notices } from '@/components/admin/AdminPage'
import { many, searchClause, withRelated, type Row } from '@/server/data'
import { money } from '@/server/money'

import { QUOTATION_LABEL, QUOTATION_STATUSES as STATUSES } from '@/server/finance/labels'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'

export default async function Quotations({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  return (
    <AdminPage heading="Quotations" sp={sp} newHref="/admin/quotations/new" newLabel="New quotation">
      <div className="admin-panel">
        <p className="note">Quotation numbers are generated once and never change. Make one for a customer: directly from the customer, or after saving a lead as a customer.</p>
        <StepForm className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number or recipient" />
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s} value={s}>{QUOTATION_LABEL[s]}</option>)}</select>
          <AsyncButton className="button">Filter</AsyncButton>
        </StepForm>
        <ListLoad filters={[q, status]} what="quotations" columns={5}><QuotationRows q={q} status={status} /></ListLoad>
      </div>
    </AdminPage>
  )
}

async function QuotationRows({ q, status }: { q: string; status: string }) {
  const clause = await searchClause(q, ['number'], [{ table: 'customers', columns: ['name'], fk: 'customer_id' }, { table: 'leads', columns: ['name', 'company'], fk: 'lead_id' }])
  const found = await many('quotations', (f) => (status ? (clause ? f.or(clause) : f).eq('status', status) : clause ? f.or(clause) : f).order('id', { ascending: false }), 'id,number,status,valid_until,total_minor,currency,customer_id,lead_id', 300)
  const withCustomer = await withRelated(found, 'customers', 'customerId', { name: 'customerName' })
  const rows: Row[] = (await withRelated(withCustomer, 'leads', 'leadId', { name: 'leadName', company: 'leadCompany' })).map((r) => ({ ...r, recipient: r.customerName || r.leadCompany || r.leadName }))
  return (
      <table><thead><tr><th>Quotation</th><th>Recipient</th><th>Valid until</th><th>Status</th><th>Total</th></tr></thead><tbody>
        {rows.length ? rows.map((r) => (
          <tr key={r.id as number}>
            <td><a href={`/admin/quotations/${r.id}`}>{r.number as string}</a></td><td>{r.recipient as string}</td><td>{r.validUntil as string}</td>
            <td><span className="status">{QUOTATION_LABEL[r.status as string] ?? (r.status as string)}</span></td><td>{money(r.totalMinor as number, r.currency as string)}</td>
          </tr>
        )) : <tr><td colSpan={5}>No quotations found.</td></tr>}
      </tbody></table>
  )
}
