import { AdminPage, ListLoad, day, type Notices } from '@/components/admin/AdminPage'
import { many, withRelated } from '@/server/data'
import { money } from '@/server/money'
import { RECEIPT_LABEL, label } from '@/server/finance/labels'

export default async function Receipts({ searchParams }: { searchParams: Promise<Notices> }) {
  return (
    <AdminPage heading="Receipts" sp={await searchParams}>
      <div className="admin-panel">
        <p className="note">A receipt exists only after Finance confirmed cleared funds. Receipts above IDR 5,000,000, or in any foreign currency, wait for a manually applied e-meterai.</p>
        <ListLoad filters={[]} what="receipts" columns={6}><ReceiptRows /></ListLoad>
      </div>
      <div className="admin-panel">
        <h3>Pre-payment receipts</h3>
        <p className="note">Made with every invoice, for customers whose finance team needs a receipt before it releases payment. They are issued before the money arrives and are not proof of payment. Above IDR 5,000,000 (or in any foreign currency) the e-meterai is applied by hand before release.</p>
        <ListLoad filters={[]} what="pre-payment receipts" columns={6}><PrepaymentRows /></ListLoad>
      </div>
    </AdminPage>
  )
}

async function ReceiptRows() {
  const r0 = await many('receipts', (f) => f.order('id', { ascending: false }), 'id,number,status,created_at,stamp_required,invoice_id,payment_id', 300)
  const r1 = await withRelated(r0, 'invoices', 'invoiceId', { number: 'invoiceNumber', currency: 'currency' })
  const rows = await withRelated(r1, 'payments', 'paymentId', { amount_minor: 'amountMinor' })
  return (
      <table><thead><tr><th>Receipt</th><th>Invoice</th><th>Amount</th><th>Issued</th><th>Status</th><th>PDF</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/receipts/${r.id}`}>{r.number as string}</a></td>
              <td><a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a></td>
              <td>{money(r.amountMinor as number, r.currency as string)}</td><td>{day(r.createdAt as Date)}</td>
              <td><span className="status">{label(RECEIPT_LABEL, r.status)}</span></td>
              <td>{r.status === 'void' ? '—' : <a href={`/admin/receipts/${r.id}/pdf`}>PDF</a>}</td>
            </tr>
          )) : <tr><td colSpan={6}>No receipts yet.</td></tr>}
        </tbody></table>
  )
}

async function PrepaymentRows() {
  const p0 = await many('prepayment_receipts', (f) => f.order('id', { ascending: false }), 'id,number,status,created_at,stamp_required,amount_minor,currency,invoice_id', 300)
  const pre = await withRelated(p0, 'invoices', 'invoiceId', { number: 'invoiceNumber' })
  return (
      <table><thead><tr><th>Pre-payment receipt</th><th>Invoice</th><th>Amount</th><th>Created</th><th>Status</th><th>PDF</th></tr></thead><tbody>
          {pre.length ? pre.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/prepayment-receipts/${r.id}`}>{r.number as string}</a></td>
              <td><a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a></td>
              <td>{money(r.amountMinor as number, r.currency as string)}</td><td>{day(r.createdAt as Date)}</td>
              <td><span className="status">{label(RECEIPT_LABEL, r.status)}</span>{r.stampRequired && r.status === 'pending_stamp' ? ' · e-meterai' : ''}</td>
              <td>{r.status === 'void' ? '—' : <a href={`/admin/prepayment-receipts/${r.id}/pdf`}>PDF</a>}</td>
            </tr>
          )) : <tr><td colSpan={6}>No pre-payment receipts yet.</td></tr>}
        </tbody></table>
  )
}
