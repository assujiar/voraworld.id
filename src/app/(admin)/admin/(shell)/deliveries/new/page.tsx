import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { DeliveryForm } from '@/components/admin/DeliveryForm'
import { many, one } from '@/server/data'
import { money } from '@/server/money'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'

const id = (v: string | undefined) => (/^\d{1,10}$/.test(v ?? '') && Number(v) <= 2_147_483_647 ? Number(v) : 0)

/** Customer, then one of that customer's VALIDATED quotations, then the form (prefilled from both). No lead is involved at any step. */
export default async function NewDelivery({ searchParams }: { searchParams: Promise<Notices & { customer?: string; quotation?: string }> }) {
  const sp = await searchParams
  const customerId = id(sp.customer), quotationId = id(sp.quotation)
  if (customerId && quotationId) return <AdminPage heading="New delivery note" sp={sp}><DeliveryForm customerId={customerId} quotationId={quotationId} /></AdminPage>
  const customer = customerId ? await one('customers', (q) => q.eq('id', customerId), 'id,name') : undefined
  if (customer) {
    const quotations = await many('quotations', (q) => q.eq('customer_id', customer.id as number).eq('status', 'validated').order('id', { ascending: false }), 'id,number,total_minor,currency,origin,destination', 100)
    return (
      <AdminPage heading="New delivery note" sp={sp}>
        <div className="admin-panel">
          <h3>Which validated quotation of {customer.name as string}?</h3>
          {quotations.length ? (
            <StepForm className="admin-form-grid">
              <input type="hidden" name="customer" value={customer.id as number} />
              <div className="field wide"><label>Validated quotation</label>
                <select name="quotation" required defaultValue="">
                  <option value="" disabled>Choose a quotation</option>
                  {quotations.map((q) => <option key={q.id as number} value={q.id as number}>{q.number as string} · {money(q.totalMinor as number, q.currency as string)}{q.origin ? ` · ${q.origin as string} → ${q.destination as string}` : ''}</option>)}
                </select>
              </div>
              <div className="field"><AsyncButton className="button" busy="Memuat data Quotation…">Continue</AsyncButton> <a className="button-outline" href="/admin/deliveries/new">Another customer</a></div>
            </StepForm>
          ) : <p className="note">This customer has no validated quotation. A quotation becomes validated after the customer has signed it and VORA has checked it. <a href={`/admin/customers/${customer.id}`}>Open the customer</a></p>}
        </div>
      </AdminPage>
    )
  }
  const customers = await many('customers', (q) => q.order('name'), 'id,name,public_code', 500)
  return (
    <AdminPage heading="New delivery note" sp={sp}>
      <div className="admin-panel">
        <h3>Which customer is it for?</h3>
        <StepForm className="admin-form-grid">
          <div className="field wide"><label>Customer</label>
            <select name="customer" required defaultValue="">
              <option value="" disabled>Choose a customer</option>
              {customers.map((c) => <option key={c.id as number} value={c.id as number}>{c.name as string} · {(c.publicCode as string) || 'legacy'}</option>)}
            </select>
          </div>
          <div className="field"><AsyncButton className="button" busy="Memuat Quotation Customer…">Continue</AsyncButton></div>
        </StepForm>
      </div>
    </AdminPage>
  )
}
