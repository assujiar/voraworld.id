import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { QuotationForm } from '@/components/admin/QuotationForm'
import { many } from '@/server/data'

const id = (v: string | undefined) => (/^\d{1,10}$/.test(v ?? '') && Number(v) <= 2_147_483_647 ? Number(v) : 0)

/** Step 1 (when none is chosen yet): the customer. Step 2: the quotation form for that customer, with or without the lead that brought them. */
export default async function NewQuotation({ searchParams }: { searchParams: Promise<Notices & { customer?: string; lead?: string }> }) {
  const sp = await searchParams
  const customerId = id(sp.customer), leadId = id(sp.lead)
  if (customerId) return <AdminPage heading="New quotation" sp={sp}><QuotationForm customerId={customerId} leadId={leadId || null} /></AdminPage>
  const customers = await many('customers', (q) => q.order('name'), 'id,name,currency,public_code', 500)
  return (
    <AdminPage heading="New quotation" sp={sp}>
      <div className="admin-panel">
        <h3>Which customer is it for?</h3>
        <p className="note">Every quotation is for a customer. A lead is optional: if the business came from one, save the lead as a customer from the lead&apos;s page. A customer you know already can be chosen here directly.</p>
        <form method="get" className="admin-form-grid">
          <div className="field wide"><label>Customer</label>
            <select name="customer" required defaultValue="">
              <option value="" disabled>Choose a customer</option>
              {customers.map((c) => <option key={c.id as number} value={c.id as number}>{c.name as string} · {(c.publicCode as string) || 'legacy'} · {c.currency as string}</option>)}
            </select>
          </div>
          <div className="field"><button className="button">Continue</button> <a className="button-outline" href="/admin/customers/new">New customer</a></div>
        </form>
      </div>
    </AdminPage>
  )
}
