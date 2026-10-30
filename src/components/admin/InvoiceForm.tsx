import { createInvoiceAction } from '@/actions/finance'
import { ActionForm, FCheckbox, FInput, FTextarea, Submit } from '@/components/admin/ActionForm'
import { CHARGE_COLUMNS, ItemsTable } from '@/components/admin/ItemsTable'
import { many, one } from '@/server/data'
import { today } from '@/server/dates'
import { money, plainAmount } from '@/server/money'

/**
 * An invoice is made for a customer's VALIDATED quotation and bills the delivery notes (each with its proof of delivery) chosen on the previous
 * step. The charge table starts from the quotation's charges and is edited here: the quotation's total is NOT multiplied by the number of delivery
 * notes, and what earlier invoices of the same quotation already billed is shown so the amounts can be set by hand.
 */
export async function InvoiceForm({ customerId, quotationId, deliveryIds }: { customerId: number; quotationId: number; deliveryIds: number[] }) {
  const [customer, quotation] = await Promise.all([
    one('customers', (q) => q.eq('id', customerId), 'id,name,currency,terms_days'),
    one('quotations', (q) => q.eq('id', quotationId), 'id,number,status,customer_id,currency,subtotal_minor,tax_percent,origin,destination,service_mode'),
  ])
  if (!customer || !quotation || quotation.customerId !== customerId || quotation.status !== 'validated' || !deliveryIds.length) {
    return <div className="admin-panel"><p>Choose a customer, one of their validated quotations and at least one delivery note first. <a href="/admin/invoices/new">Start again</a></p></div>
  }
  const cur = customer.currency as string
  const [items, deliveries, billedBefore, banks] = await Promise.all([
    many('quotation_items', (q) => q.eq('quotation_id', quotationId).order('id'), 'description,quantity,unit,price_minor'),
    many('deliveries', (q) => q.in('id', deliveryIds).order('id'), 'id,number,status,delivery_date,origin,destination,po_number,shipment_reference,customer_id,quotation_id'),
    many('invoices', (q) => q.eq('quotation_id', quotationId).neq('status', 'void').order('id'), 'number,subtotal_minor'),
    many('bank_accounts', (q) => q.eq('active', true).eq('currency', cur).order('is_default', { ascending: false }).order('position'), 'id,bank_name,account_number,is_default'),
  ])
  if (deliveries.length !== deliveryIds.length || deliveries.some((d) => d.customerId !== customerId || d.quotationId !== quotationId || d.status !== 'delivered')) {
    return <div className="admin-panel"><p>One of the chosen delivery notes is not available for this invoice. <a href="/admin/invoices/new">Start again</a></p></div>
  }
  const billed = billedBefore.reduce((n, i) => n + (i.subtotalMinor as number), 0)
  const rows = items.map((i) => ({ description: i.description as string, quantity: i.quantity as string, unit: i.unit as string, price: plainAmount(i.priceMinor as number, cur) }))
  const day = today()
  const first = deliveries[0]
  return (
    <div className="admin-panel">
      <h3>Create invoice</h3>
      <p>For <a href={`/admin/customers/${customer.id}`}><strong>{customer.name as string}</strong></a> · quotation <a href={`/admin/quotations/${quotation.id}`}>{quotation.number as string}</a> · bills {deliveries.map((d, k) => <span key={d.id as number}>{k ? ', ' : ''}<a href={`/admin/deliveries/${d.id}`}>{d.number as string}</a></span>)}</p>
      <p className="note mini">Quoted subtotal {money(quotation.subtotalMinor as number, cur)}{billedBefore.length ? ` · already billed on ${billedBefore.map((b) => b.number as string).join(', ')}: ${money(billed, cur)}` : ' · nothing billed yet'}. The charges below start from the quotation and are yours to adjust (for example, one delivery of several, or the actual quantity).</p>
      <ActionForm action={createInvoiceAction}>
        <input type="hidden" name="customer_id" value={customer.id as number} />
        <input type="hidden" name="quotation_id" value={quotation.id as number} />
        {deliveries.map((d) => <input key={d.id as number} type="hidden" name="delivery_ids" value={d.id as number} />)}
        <div className="admin-form-grid">
          <div className="field"><label>Issue date</label><FInput name="issued_at" type="date" fallback={day} /></div>
          <div className="field"><label>Due date (blank = customer&apos;s payment terms)</label><FInput name="due_at" type="date" /></div>
          <div className="field"><label>Tax %</label><FInput name="tax_percent" fallback={String(quotation.taxPercent ?? '0')} inputMode="decimal" /></div>
          <div className="field"><label>Withholding %</label><FInput name="withholding_percent" fallback="0" inputMode="decimal" /></div>
          <div className="field"><label>Discount (currency units)</label><FInput name="discount" fallback="0" inputMode="decimal" /></div>
          <div className="field"><label>Customer PO number</label><FInput name="po_number" fallback={deliveries.map((d) => d.poNumber as string).find(Boolean) ?? ''} maxLength={100} /></div>
          <div className="field"><label>Shipment / job reference</label><FInput name="shipment_reference" fallback={deliveries.map((d) => d.shipmentReference as string).find(Boolean) ?? ''} maxLength={120} /></div>
          <div className="field"><label>Freight / service mode</label><FInput name="service_mode" fallback={(quotation.serviceMode as string) ?? ''} maxLength={120} placeholder="e.g. Sea Import FCL + Customs Brokerage" /></div>
          <div className="field"><label>Origin / POL</label><FInput name="origin" fallback={(quotation.origin as string) || (first.origin as string) || ''} maxLength={180} /></div>
          <div className="field"><label>Destination / POD</label><FInput name="destination" fallback={(quotation.destination as string) || (first.destination as string) || ''} maxLength={180} /></div>
          <div className="field"><label>B/L, AWB or transport document reference</label><FInput name="transport_document_ref" maxLength={150} /></div>
          <div className="field wide"><label>Bank accounts to print on the invoice (leave all unticked to use the preferred account)</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {banks.length ? banks.map((b) => (
                <label key={b.id as number} style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 400 }}>
                  <FCheckbox name="bank_account_ids" value={String(b.id)} /> {b.bankName as string} · {b.accountNumber as string} · {cur}{b.isDefault ? ' (preferred)' : ''}
                </label>
              )) : <small>No active bank account in {cur}. Add one under <a href="/admin/bank-accounts">Bank Accounts</a> first.</small>}
            </div>
          </div>
          <div className="field wide"><label>Notes</label><FTextarea name="notes" /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '10px 0 0' }}>Charges</h4>
          <div className="field wide"><ItemsTable columns={CHARGE_COLUMNS} initial={rows} showAmount currency={cur} addLabel="Add charge" /></div>
          <div className="field wide">
            <label style={{ fontWeight: 400 }}><FCheckbox name="over_quotation_ack" value="yes" style={{ width: 'auto', minHeight: 0, marginRight: 8 }} /> The invoices of this quotation may add up to more than was quoted, and that is intended</label>
            <span className="mini muted">Without this, an invoice that takes the billed total of the quotation above the quoted subtotal is refused.</span>
          </div>
        </div>
        <p className="note mini">Amounts are recalculated on the server with exact decimal arithmetic; the browser never supplies a total. The currency is the customer&apos;s. Up to five charge rows fit on each A4 page; more continue on further pages. A pre-payment receipt is made with the invoice.</p>
        <Submit>Create invoice (draft)</Submit>
      </ActionForm>
    </div>
  )
}
