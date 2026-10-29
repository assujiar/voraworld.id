import { createQuotationAction } from '@/actions/finance'
import { ActionForm, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { sql } from '@/server/db'
import { today } from '@/server/dates'

export async function QuotationForm() {
  const customers = await sql`select id, name, currency from customers order by name limit 500`
  const leads = await sql`select id, name, company, email from leads order by id desc limit 300`
  const day = today()
  return (
    <div className="admin-panel">
      <h3>New quotation</h3>
      <ActionForm action={createQuotationAction}>
        <div className="admin-form-grid">
          <div className="field wide"><label>Customer or lead</label>
            <FSelect name="recipient" required>
              {customers.map((c) => <option key={`c${c.id}`} value={`customer:${c.id}`}>Customer · {c.name as string} · {c.currency as string}</option>)}
              {leads.map((l) => <option key={`l${l.id}`} value={`lead:${l.id}`}>Lead · {(l.company as string) || (l.name as string)} · {l.email as string}</option>)}
            </FSelect>
          </div>
          <div className="field"><label>Issue date</label><FInput name="issued_at" type="date" fallback={day} required /></div>
          <div className="field"><label>Valid until</label><FInput name="valid_until" type="date" fallback={day} required /></div>
          <div className="field"><label>Tax % (optional)</label><FInput name="tax_percent" fallback="0" inputMode="decimal" /></div>
          <div className="field wide"><label>Line items (description | quantity | unit price | unit)</label>
            <FTextarea name="items" rows={6} required placeholder={'Freight service | 1 | 2500000 | shipment\nDocumentation | 1 | 350000 | job'} />
          </div>
          <div className="field wide"><label>Terms and notes</label><FTextarea name="notes" /></div>
        </div>
        <p className="note mini">Amounts are calculated on the server in exact decimal arithmetic. A customer quotation uses the customer&apos;s currency; a quotation to a lead is in IDR.</p>
        <Submit>Save quotation draft</Submit>
      </ActionForm>
    </div>
  )
}
