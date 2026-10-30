import { createQuotationAction } from '@/actions/finance'
import { ActionForm, FInput, FTextarea, Submit } from '@/components/admin/ActionForm'
import { CHARGE_COLUMNS, ItemsTable } from '@/components/admin/ItemsTable'
import { one } from '@/server/data'
import { today } from '@/server/dates'
import { MAX_PAYMENT_TERMS, MAX_TERMS_CONDITIONS } from '@/server/finance/quotations'
import { settingMap } from '@/server/settings'

/**
 * A quotation is for a CUSTOMER (always) and optionally brought by a lead. From a customer, `leadId` is empty and stays empty: no lead is
 * created. From a lead that was saved as a customer, the lead's inquiry fills the service, route and cargo, but no price is ever invented.
 */
export async function QuotationForm({ customerId, leadId }: { customerId: number; leadId: number | null }) {
  const customer = await one('customers', (q) => q.eq('id', customerId), 'id,name,currency,email,pic_name,pic_email,pic_phone,public_code')
  if (!customer) return <div className="admin-panel"><p>That customer does not exist. <a href="/admin/quotations/new">Choose another</a></p></div>
  const lead = leadId ? await one('leads', (q) => q.eq('id', leadId), 'id,reference,name,email,phone,mode,origin,destination,cargo,message,customer_id') : undefined
  const settings = await settingMap()
  const day = today()
  const leadOk = lead && (!lead.customerId || lead.customerId === customerId)
  const cargo = leadOk ? [lead.cargo as string, lead.message ? `Inquiry: ${lead.message as string}` : ''].filter(Boolean).join('\n\n').slice(0, 3000) : ''
  return (
    <div className="admin-panel">
      <h3>New quotation</h3>
      <p>For <a href={`/admin/customers/${customer.id}`}><strong>{customer.name as string}</strong></a> <small className="muted">· {customer.publicCode as string} · {customer.currency as string}</small>
        {leadOk ? <> · from lead <a href={`/admin/leads/${lead.id}`}>{(lead.reference as string) || `#${lead.id}`}</a></> : <> · <span className="muted">no lead (entered directly)</span></>}</p>
      <ActionForm action={createQuotationAction}>
        <input type="hidden" name="customer_id" value={customer.id as number} />
        {leadOk ? <input type="hidden" name="lead_id" value={lead.id as number} /> : null}
        <div className="admin-form-grid">
          <div className="field"><label>Issue date</label><FInput name="issued_at" type="date" fallback={day} required /></div>
          <div className="field"><label>Valid until</label><FInput name="valid_until" type="date" fallback={day} required /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '10px 0 0' }}>Addressed to</h4>
          <div className="field"><label>Contact person (PIC)</label><FInput name="pic_name" fallback={(customer.picName as string) || (leadOk ? (lead.name as string) : '')} maxLength={160} /></div>
          <div className="field"><label>PIC email</label><FInput name="pic_email" type="email" fallback={(customer.picEmail as string) || (customer.email as string) || (leadOk ? (lead.email as string) : '')} maxLength={200} /></div>
          <div className="field"><label>PIC phone</label><FInput name="pic_phone" type="tel" fallback={(customer.picPhone as string) || (leadOk ? (lead.phone as string) : '')} maxLength={60} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '10px 0 0' }}>The service quoted</h4>
          <div className="field"><label>Service</label><FInput name="service_mode" fallback={leadOk ? (lead.mode as string) : ''} maxLength={120} placeholder="e.g. Sea import FCL" /></div>
          <div className="field"><label>Origin</label><FInput name="origin" fallback={leadOk ? (lead.origin as string) : ''} maxLength={240} /></div>
          <div className="field"><label>Destination</label><FInput name="destination" fallback={leadOk ? (lead.destination as string) : ''} maxLength={240} /></div>
          <div className="field wide"><label>Shipment / cargo information</label><FTextarea name="cargo_info" rows={3} fallback={cargo} maxLength={3000} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '10px 0 0' }}>Commercial charges</h4>
          <div className="field wide">
            <ItemsTable columns={CHARGE_COLUMNS} initial={[]} showAmount currency={customer.currency as string} addLabel="Add charge" />
          </div>
          <div className="field"><label>Tax % (optional)</label><FInput name="tax_percent" fallback="0" inputMode="decimal" /></div>
          <div className="field wide"><label>Terms of payment</label>
            <FTextarea name="payment_terms" rows={3} required maxLength={MAX_PAYMENT_TERMS} fallback={settings.quotation_payment_terms ?? ''}
              placeholder={'e.g. 50% down payment on approval, the balance within 14 days of the invoice date.'} />
          </div>
          <div className="field wide"><label>Terms and conditions</label>
            <FTextarea name="terms_conditions" rows={9} required maxLength={MAX_TERMS_CONDITIONS} fallback={settings.quotation_terms ?? ''}
              placeholder={'One clause per line. These are the terms the customer accepts by signing.'} />
          </div>
          <div className="field wide"><label>Notes (optional)</label><FTextarea name="notes" rows={3} /></div>
        </div>
        <p className="note mini">The quotation uses the customer&apos;s currency ({customer.currency as string}). Terms of payment and terms and conditions are printed on the quotation and shown to the customer before they sign; the boxes start from the defaults in Site Settings and each quotation keeps its own copy. Amounts are calculated on the server in exact decimal arithmetic.</p>
        <Submit>Save quotation draft</Submit>
      </ActionForm>
    </div>
  )
}
