'use client'
import { useEffect, useRef, useState } from 'react'
import { createInvoiceAction } from '@/actions/finance'
import { ActionForm, FCheckbox, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'

export interface CustomerOption { id: number; name: string; currency: string; termsDays: number }
export interface BankOption { id: number; label: string; currency: string; isDefault: boolean }

/** Invoice creation. The accounts offered follow the selected customer's currency (an invoice only prints accounts in its own currency). */
export function InvoiceForm({ customers, banks, today }: { customers: CustomerOption[]; banks: BankOption[]; today: string }) {
  const select = useRef<HTMLSelectElement>(null)
  const [currency, setCurrency] = useState(customers[0]?.currency ?? '')
  const sync = () => setCurrency(select.current?.selectedOptions[0]?.dataset.currency ?? '')
  useEffect(sync, [])
  const offered = banks.filter((b) => b.currency === currency)
  return (
    <div className="admin-panel">
      <h3>Create invoice</h3>
      <ActionForm action={createInvoiceAction}>
        <div className="admin-form-grid">
          <div className="field"><label>Customer *</label>
            <FSelect name="customer_id" ref={select} onChange={sync} required>
              {customers.map((c) => <option key={c.id} value={c.id} data-currency={c.currency}>{c.name} · {c.currency}</option>)}
            </FSelect>
          </div>
          <div className="field"><label>Issue date</label><FInput name="issued_at" type="date" fallback={today} /></div>
          <div className="field"><label>Due date (blank = customer&apos;s payment terms)</label><FInput name="due_at" type="date" /></div>
          <div className="field"><label>Tax % (not hard-coded)</label><FInput name="tax_percent" fallback="0" inputMode="decimal" /></div>
          <div className="field"><label>Withholding %</label><FInput name="withholding_percent" fallback="0" inputMode="decimal" /></div>
          <div className="field"><label>Discount (currency units)</label><FInput name="discount" fallback="0" inputMode="decimal" /></div>
          <div className="field"><label>Customer PO number (optional)</label><FInput name="po_number" maxLength={100} /></div>
          <div className="field"><label>Shipment / job reference</label><FInput name="shipment_reference" maxLength={120} /></div>
          <div className="field"><label>Freight / service mode (optional)</label><FInput name="service_mode" maxLength={120} placeholder="e.g. Sea Import FCL + Customs Brokerage" /></div>
          <div className="field"><label>Origin / POL (optional)</label><FInput name="origin" maxLength={180} placeholder="e.g. Shanghai (CNSHA)" /></div>
          <div className="field"><label>Destination / POD (optional)</label><FInput name="destination" maxLength={180} placeholder="e.g. Jakarta (IDJKT) - Cikarang" /></div>
          <div className="field"><label>B/L, AWB or transport document reference (optional)</label><FInput name="transport_document_ref" maxLength={150} /></div>
          <div className="field wide"><label>Bank accounts to print on the invoice (leave all unticked to use the preferred account)</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {offered.length ? offered.map((b) => (
                <label key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 400 }}>
                  <FCheckbox name="bank_account_ids" value={String(b.id)} /> {b.label}{b.isDefault ? ' (preferred)' : ''}
                </label>
              )) : <small>No active bank account in {currency || 'this currency'}. Add one under <a href="/admin/bank-accounts">Bank Accounts</a> first.</small>}
            </div>
          </div>
          <div className="field wide"><label>Notes</label><FTextarea name="notes" /></div>
          <div className="field wide"><label>Line items (one per line: description | quantity | unit price | unit)</label>
            <FTextarea name="items" rows={6} required placeholder={'Ocean freight | 1 | 2500000 | shipment\nDocumentation | 1 | 350000 | job'} />
          </div>
        </div>
        <p className="note mini">Amounts are recalculated on the server with exact decimal arithmetic; the browser never supplies a total. The currency comes from the selected customer. Up to five line items fit on each A4 page; more continue on further pages.</p>
        {customers.length ? <Submit>Create invoice (draft)</Submit> : <p className="note">Create a customer first.</p>}
      </ActionForm>
    </div>
  )
}
