import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { InvoiceForm } from '@/components/admin/InvoiceForm'
import { many, one } from '@/server/data'
import { money } from '@/server/money'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'

const id = (v: string | undefined) => (/^\d{1,10}$/.test(v ?? '') && Number(v) <= 2_147_483_647 ? Number(v) : 0)
type SP = Notices & { customer?: string; quotation?: string; delivery?: string | string[]; picked?: string }

/**
 * Customer -> one of their VALIDATED quotations -> the delivery notes to bill (several, each with its proof of delivery and not billed elsewhere) -> the
 * invoice form. No lead is involved at any step; the same steps serve a customer entered by hand and one that came from a lead.
 */
export default async function NewInvoice({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const customerId = id(sp.customer), quotationId = id(sp.quotation)
  const picked = [sp.delivery ?? []].flat().map(id).filter(Boolean)
  if (customerId && quotationId && picked.length) return <AdminPage heading="Create invoice" sp={sp}><InvoiceForm customerId={customerId} quotationId={quotationId} deliveryIds={picked} /></AdminPage>

  const customer = customerId ? await one('customers', (q) => q.eq('id', customerId), 'id,name') : undefined
  if (customer && quotationId) {
    const quotation = await one('quotations', (q) => q.eq('id', quotationId).eq('customer_id', customer.id as number), 'id,number,status')
    if (quotation?.status === 'validated') {
      const delivered = await many('deliveries', (q) => q.eq('customer_id', customer.id as number).eq('quotation_id', quotationId).eq('status', 'delivered').order('id'), 'id,number,delivery_date,destination')
      const live = delivered.length ? await many('invoice_delivery_notes', (q) => q.in('delivery_id', delivered.map((d) => d.id as number)).is('released_at', null), 'delivery_id,invoice_id') : []
      const invoiceOf = new Map(live.map((l) => [l.deliveryId as number, l.invoiceId as number]))
      const inv = live.length ? await many('invoices', (q) => q.in('id', [...new Set(live.map((l) => l.invoiceId as number))]), 'id,number') : []
      const number = new Map(inv.map((i) => [i.id as number, i.number as string]))
      return (
        <AdminPage heading="Create invoice" sp={sp}>
          <div className="admin-panel">
            <h3>Which delivery notes does this invoice bill?</h3>
            <p className="note">Quotation {quotation.number as string} · {customer.name as string}. Only delivery notes with a recorded proof of delivery can be billed, and each only once.</p>
            {delivered.length ? (
              <StepForm>
                <input type="hidden" name="customer" value={customer.id as number} /><input type="hidden" name="quotation" value={quotationId} />
                <table><thead><tr><th></th><th>Delivery note</th><th>Date</th><th>Destination</th><th>Billing</th></tr></thead><tbody>
                  {delivered.map((d) => {
                    const billedOn = invoiceOf.get(d.id as number)
                    return (
                      <tr key={d.id as number}>
                        <td><input type="checkbox" name="delivery" value={d.id as number} disabled={Boolean(billedOn)} defaultChecked={!billedOn} aria-label={`Bill ${d.number}`} style={{ width: 'auto', minHeight: 0 }} /></td>
                        <td><a href={`/admin/deliveries/${d.id}`}>{d.number as string}</a></td><td>{d.deliveryDate as string}</td><td>{d.destination as string}</td>
                        <td>{billedOn ? <>already on <a href={`/admin/invoices/${billedOn}`}>{number.get(billedOn)}</a></> : 'not billed yet'}</td>
                      </tr>
                    )
                  })}
                </tbody></table>
                <div className="inline-actions" style={{ marginTop: 12 }}><AsyncButton className="button" busy="Menyiapkan form Invoice…">Continue</AsyncButton> <a className="button-outline" href={`/admin/invoices/new?customer=${customer.id}`}>Another quotation</a></div>
              </StepForm>
            ) : <p className="note">This quotation has no delivery note with a recorded proof of delivery yet. <a href={`/admin/deliveries/new?customer=${customer.id}&quotation=${quotationId}`}>Make a delivery note</a></p>}
          </div>
        </AdminPage>
      )
    }
  }
  if (customer) {
    const quotations = await many('quotations', (q) => q.eq('customer_id', customer.id as number).eq('status', 'validated').order('id', { ascending: false }), 'id,number,total_minor,currency', 100)
    return (
      <AdminPage heading="Create invoice" sp={sp}>
        <div className="admin-panel">
          <h3>Which validated quotation of {customer.name as string}?</h3>
          {quotations.length ? (
            <StepForm className="admin-form-grid">
              <input type="hidden" name="customer" value={customer.id as number} />
              <div className="field wide"><label>Validated quotation</label>
                <select name="quotation" required defaultValue="">
                  <option value="" disabled>Choose a quotation</option>
                  {quotations.map((q) => <option key={q.id as number} value={q.id as number}>{q.number as string} · {money(q.totalMinor as number, q.currency as string)}</option>)}
                </select>
              </div>
              <div className="field"><AsyncButton className="button" busy="Memuat Surat Jalan…">Continue</AsyncButton> <a className="button-outline" href="/admin/invoices/new">Another customer</a></div>
            </StepForm>
          ) : <p className="note">This customer has no validated quotation. An invoice is made from a validated quotation, after the delivery. <a href={`/admin/customers/${customer.id}`}>Open the customer</a></p>}
        </div>
      </AdminPage>
    )
  }
  const customers = await many('customers', (q) => q.order('name'), 'id,name,public_code', 500)
  return (
    <AdminPage heading="Create invoice" sp={sp}>
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
