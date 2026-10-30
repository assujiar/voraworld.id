import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { money } from '@/server/money'

export default async function Receipts({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await sql`select r.id, r.number, r.status, r.created_at, r.stamp_required, i.id as invoice_id, i.number as invoice_number, i.currency, p.amount_minor
    from receipts r join invoices i on i.id = r.invoice_id join payments p on p.id = r.payment_id order by r.id desc limit 300`
  const pre = await sql`select p.id, p.number, p.status, p.created_at, p.stamp_required, p.amount_minor, p.currency, i.id as invoice_id, i.number as invoice_number
    from prepayment_receipts p join invoices i on i.id = p.invoice_id order by p.id desc limit 300`
  return (
    <AdminPage heading="Receipts" sp={await searchParams}>
      <div className="admin-panel">
        <p className="note">A receipt exists only after Finance confirmed cleared funds. Receipts above IDR 5,000,000, or in any foreign currency, wait for a manually applied e-meterai.</p>
        <table><thead><tr><th>Receipt</th><th>Invoice</th><th>Amount</th><th>Issued</th><th>Status</th><th>PDF</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/receipts/${r.id}`}>{r.number as string}</a></td>
              <td><a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a></td>
              <td>{money(r.amountMinor as number, r.currency as string)}</td><td>{day(r.createdAt as Date)}</td>
              <td><span className="status">{(r.status as string).replace('_', ' ')}</span></td>
              <td>{r.status === 'void' ? '—' : <a href={`/admin/receipts/${r.id}/pdf`}>PDF</a>}</td>
            </tr>
          )) : <tr><td colSpan={6}>No receipts yet.</td></tr>}
        </tbody></table>
      </div>
      <div className="admin-panel">
        <h3>Pre-payment receipts</h3>
        <p className="note">Made with every invoice, for customers whose finance team needs a receipt before it releases payment. They are issued before the money arrives and are not proof of payment. Above IDR 5,000,000 (or in any foreign currency) the e-meterai is applied by hand before release.</p>
        <table><thead><tr><th>Pre-payment receipt</th><th>Invoice</th><th>Amount</th><th>Created</th><th>Status</th><th>PDF</th></tr></thead><tbody>
          {pre.length ? pre.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/prepayment-receipts/${r.id}`}>{r.number as string}</a></td>
              <td><a href={`/admin/invoices/${r.invoiceId}`}>{r.invoiceNumber as string}</a></td>
              <td>{money(r.amountMinor as number, r.currency as string)}</td><td>{day(r.createdAt as Date)}</td>
              <td><span className="status">{(r.status as string).replace('_', ' ')}</span>{r.stampRequired && r.status === 'pending_stamp' ? ' · e-meterai' : ''}</td>
              <td>{r.status === 'void' ? '—' : <a href={`/admin/prepayment-receipts/${r.id}/pdf`}>PDF</a>}</td>
            </tr>
          )) : <tr><td colSpan={6}>No pre-payment receipts yet.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
