import { recordPaymentAction } from '@/actions/finance'
import { ActionForm, FInput, FSelect, Submit } from '@/components/admin/ActionForm'

export function RecordPaymentForm({ invoiceId, currency, today, banks }: { invoiceId: number; currency: string; today: string; banks: Array<{ id: number; label: string }> }) {
  return (
    <>
      <h3>Register a payment (pending bank confirmation)</h3>
      <p className="note">Entering a transfer does not change the outstanding balance. Only Finance can confirm that the funds were really credited to the company bank account, and a receipt exists only after that.</p>
      <ActionForm action={recordPaymentAction}>
        <input type="hidden" name="record" value={invoiceId} />
        <div className="admin-form-grid">
          <div className="field"><label>Amount ({currency})</label><FInput name="amount" required inputMode="decimal" /></div>
          <div className="field"><label>Payment date</label><FInput name="date" type="date" fallback={today} max={today} /></div>
          <div className="field"><label>Method</label><FInput name="method" fallback="bank transfer" maxLength={100} /></div>
          <div className="field"><label>Reference</label><FInput name="reference" maxLength={160} /></div>
          <div className="field"><label>Receiving bank account (optional now, required to confirm a transfer)</label>
            <FSelect name="receiving_bank_id"><option value="">Not specified yet</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</FSelect>
          </div>
        </div>
        <Submit>Save payment for bank confirmation</Submit>
      </ActionForm>
    </>
  )
}
