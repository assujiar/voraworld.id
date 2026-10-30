import { createQuotationAction } from '@/actions/finance'
import { ActionForm, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { many } from '@/server/data'
import { today } from '@/server/dates'
import { MAX_PAYMENT_TERMS, MAX_TERMS_CONDITIONS } from '@/server/finance/quotations'
import { settingMap } from '@/server/settings'

export async function QuotationForm() {
  const customers = await many('customers', (q) => q.order('name'), 'id,name,currency', 500)
  const leads = await many('leads', (q) => q.order('id', { ascending: false }), 'id,name,company,email', 300)
  const settings = await settingMap()
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
        <p className="note mini">Terms of payment and terms and conditions are printed on the quotation and shown to the customer before they sign. The boxes start from the defaults in Site Settings; each quotation keeps its own copy. Amounts are calculated on the server in exact decimal arithmetic. A customer quotation uses the customer&apos;s currency; a quotation to a lead is in IDR.</p>
        <Submit>Save quotation draft</Submit>
      </ActionForm>
    </div>
  )
}
