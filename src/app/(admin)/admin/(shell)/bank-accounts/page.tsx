import { createBankAction, updateBankAction } from '@/actions/finance'
import { ActionForm, FCheckbox, FInput, Submit } from '@/components/admin/ActionForm'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import type { BankAccountsRow } from '@/server/schema'

export default async function BankAccounts({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = (await sql`select * from bank_accounts order by currency, position, id`) as unknown as BankAccountsRow[]
  return (
    <AdminPage heading="Company bank accounts" sp={await searchParams}>
      <div className="admin-panel">
        <p className="note">Several accounts are supported. Set one preferred account per currency, then choose which accounts print on each invoice. An invoice keeps a frozen copy of its payment instructions, so editing an account never changes issued invoices.</p>
        <div className="admin-panel">
          <h4>Add bank account</h4>
          <ActionForm action={createBankAction}>
            <div className="admin-form-grid">
              <div className="field"><label>Bank name *</label><FInput name="bank_name" maxLength={120} required /></div>
              <div className="field"><label>Account number / IBAN *</label><FInput name="account_number" minLength={5} maxLength={60} required /></div>
              <div className="field"><label>Account holder *</label><FInput name="account_holder" maxLength={200} required /></div>
              <div className="field"><label>Currency *</label><FInput name="currency" fallback="IDR" maxLength={3} required /></div>
              <div className="field"><label>Branch (optional)</label><FInput name="branch" /></div>
              <div className="field"><label>SWIFT/BIC (optional)</label><FInput name="swift_code" maxLength={11} /></div>
              <div className="field wide"><label>Internal notes (never printed)</label><FInput name="notes" /></div>
              <div className="field"><label><FCheckbox name="is_default" value="1" /> Preferred account for this currency</label></div>
            </div>
            <Submit>Add account</Submit>
          </ActionForm>
        </div>
        {rows.length ? rows.map((b) => (
          <div className="admin-panel" key={b.id}>
            <form action={updateBankAction}>
              <input type="hidden" name="id" value={b.id} /><Back to="/admin/bank-accounts" />
              <h4>{b.bankName} · {b.currency} {b.isDefault ? <span className="status">PREFERRED</span> : null} {!b.active ? <span className="status">INACTIVE</span> : null}</h4>
              <div className="admin-form-grid">
                <div className="field"><label>Bank name</label><input name="bank_name" defaultValue={b.bankName} required /></div>
                <div className="field"><label>Account number</label><input name="account_number" defaultValue={b.accountNumber} required /></div>
                <div className="field"><label>Account holder</label><input name="account_holder" defaultValue={b.accountHolder} required /></div>
                <div className="field"><label>Branch</label><input name="branch" defaultValue={b.branch ?? ''} /></div>
                <div className="field"><label>SWIFT/BIC</label><input name="swift_code" defaultValue={b.swiftCode ?? ''} /></div>
                <div className="field wide"><label>Internal notes</label><input name="notes" defaultValue={b.notes ?? ''} /></div>
              </div>
              <div className="inline-actions">
                <button className="button" name="action" value="save">Save details</button>
                {b.active ? <>
                  <button className="button-outline" name="action" value="default">Set preferred</button>
                  <button className="button-outline" name="action" value="disable">Deactivate</button>
                </> : <button className="button-outline" name="action" value="enable">Reactivate</button>}
              </div>
            </form>
          </div>
        )) : <p className="note">No bank accounts yet. Add one before issuing invoices with payment instructions.</p>}
      </div>
    </AdminPage>
  )
}
