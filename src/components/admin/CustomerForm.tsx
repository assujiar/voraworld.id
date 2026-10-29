import { saveCustomerAction } from '@/actions/finance'
import { ActionForm, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { CURRENCIES } from '@/server/finance/parse'
import type { CustomersRow } from '@/server/schema'

export function CustomerForm({ customer }: { customer?: CustomersRow }) {
  return (
    <div className="admin-panel">
      <ActionForm action={saveCustomerAction}>
        {customer ? <input type="hidden" name="record" value={customer.id} /> : null}
        <div className="admin-form-grid">
          <div className="field"><label>Company / person *</label><FInput name="name" fallback={customer?.name ?? ''} required maxLength={200} /></div>
          <div className="field"><label>Billing email</label><FInput name="email" type="email" fallback={customer?.email ?? ''} maxLength={200} /></div>
          <div className="field"><label>Tax identifier (optional)</label><FInput name="tax_id" fallback={customer?.taxId ?? ''} maxLength={100} /></div>
          <div className="field"><label>Currency</label>
            <FSelect name="currency" fallback={customer?.currency ?? 'IDR'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</FSelect>
          </div>
          <div className="field"><label>Terms (days)</label><FInput name="terms_days" type="number" min={0} max={365} fallback={String(customer?.termsDays ?? 14)} /></div>
          <div className="field wide"><label>Billing address</label><FTextarea name="address" fallback={customer?.address ?? ''} maxLength={3000} /></div>
        </div>
        <Submit>Save customer</Submit>
      </ActionForm>
      {customer ? <p className="muted mini" style={{ marginTop: 16 }}>Owner code <strong>{customer.publicCode ?? 'assigned on save'}</strong> appears in every document number for this customer and never changes. The currency cannot change once the customer has a quotation or invoice.</p> : null}
    </div>
  )
}
