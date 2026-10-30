import { saveCustomerAction } from '@/actions/finance'
import { ActionForm, FCheckbox, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { CURRENCIES } from '@/server/finance/parse'
import type { CustomersRow } from '@/server/schema'

/** One form for a new customer (created by hand, with no lead) and for editing one. The contact person (PIC) is who VORA writes to. */
export function CustomerForm({ customer }: { customer?: CustomersRow }) {
  return (
    <div className="admin-panel">
      <ActionForm action={saveCustomerAction}>
        {customer ? <input type="hidden" name="record" value={customer.id} /> : null}
        <div className="admin-form-grid">
          <h4 style={{ gridColumn: '1 / -1', margin: 0 }}>Company</h4>
          <div className="field"><label>Company / person *</label><FInput name="name" fallback={customer?.name ?? ''} required maxLength={200} /></div>
          <div className="field"><label>Tax identifier (NPWP)</label><FInput name="tax_id" fallback={customer?.taxId ?? ''} maxLength={100} /></div>
          <div className="field"><label>Billing email</label><FInput name="email" type="email" fallback={customer?.email ?? ''} maxLength={200} /></div>
          <div className="field"><label>Company phone (general number)</label><FInput name="phone" type="tel" fallback={customer?.phone ?? ''} maxLength={60} /></div>
          <div className="field"><label>Currency</label>
            <FSelect name="currency" fallback={customer?.currency ?? 'IDR'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</FSelect>
          </div>
          <div className="field"><label>Payment terms (days)</label><FInput name="terms_days" type="number" min={0} max={365} fallback={String(customer?.termsDays ?? 14)} /></div>
          <div className="field wide"><label>Billing address</label><FTextarea name="address" fallback={customer?.address ?? ''} maxLength={3000} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '10px 0 0' }}>Contact person (PIC)</h4>
          <div className="field"><label>Name</label><FInput name="pic_name" fallback={customer?.picName ?? ''} maxLength={160} /></div>
          <div className="field"><label>Position</label><FInput name="pic_position" fallback={customer?.picPosition ?? ''} maxLength={160} /></div>
          <div className="field"><label>Email</label><FInput name="pic_email" type="email" fallback={customer?.picEmail ?? ''} maxLength={200} /></div>
          <div className="field"><label>Phone / mobile</label><FInput name="pic_phone" type="tel" fallback={customer?.picPhone ?? ''} maxLength={60} /></div>
          {!customer ? (
            <div className="field wide">
              <label style={{ fontWeight: 400 }}><FCheckbox name="different_customer" value="yes" style={{ width: 'auto', minHeight: 0, marginRight: 8 }} /> This is a different customer, even if it looks like one that already exists</label>
              <span className="mini muted">If a customer with the same name, email, tax identifier or phone exists, saving is refused and the match is shown, so the same company is not entered twice. Nothing is merged for you.</span>
            </div>
          ) : null}
        </div>
        <Submit>Save customer</Submit>
      </ActionForm>
      {customer ? <p className="muted mini" style={{ marginTop: 16 }}>Owner code <strong>{customer.publicCode ?? 'assigned on save'}</strong> appears in every document number for this customer and never changes. The currency cannot change once the customer has a quotation or invoice.</p> : null}
    </div>
  )
}
