import { notFound } from 'next/navigation'
import { cancelPaymentAction, confirmPaymentAction, invoiceStatusAction, sendInvoiceAction } from '@/actions/finance'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { RecordPaymentForm } from '@/components/admin/RecordPaymentForm'
import { sql } from '@/server/db'
import { today } from '@/server/dates'
import { money } from '@/server/money'

export default async function InvoiceDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = Number((await params).id) || 0
  const [inv] = id > 0 && id < 2_147_483_647 ? await sql`select i.*, c.name as customer_name, c.email as customer_email, c.address as customer_address, c.tax_id as customer_tax_id from invoices i join customers c on c.id = i.customer_id where i.id = ${id}` : []
  if (!inv) notFound()
  const cur = inv.currency as string
  const items = await sql`select * from invoice_items where invoice_id = ${id} order by id`
  const banks = await sql`select * from invoice_bank_instructions where invoice_id = ${id} order by position`
  const payments = await sql`select p.*, r.id as receipt_id, r.number as receipt_number from payments p left join receipts r on r.payment_id = p.id where p.invoice_id = ${id} order by p.id desc`
  const accounts = (await sql`select id, bank_name, account_number from bank_accounts where active and currency = ${cur} order by position`).map((b) => ({ id: b.id as number, label: `${b.bankName} · ${b.accountNumber}` }))
  const here = `/admin/invoices/${id}`
  const status = inv.status as string
  const open = ['issued', 'partially_paid'].includes(status)
  return (
    <AdminPage heading="Invoice" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{inv.number as string} <span className="status">{status}</span></h3>
        <p><strong>Customer:</strong> <a href={`/admin/customers/${inv.customerId}`}>{inv.customerName as string}</a>{inv.customerEmail ? ` · ${inv.customerEmail}` : ''}<br />
          <strong>Issued:</strong> {inv.issuedAt as string} · <strong>Due:</strong> {inv.dueAt as string}</p>
        {(inv.poNumber || inv.shipmentReference || inv.serviceMode || inv.origin || inv.destination || inv.transportDocumentRef) ? (
          <p className="mini muted">
            {inv.poNumber ? <>PO {inv.poNumber as string} · </> : null}{inv.shipmentReference ? <>Job {inv.shipmentReference as string} · </> : null}{inv.serviceMode ? <>{inv.serviceMode as string} · </> : null}
            {inv.origin || inv.destination ? <>{(inv.origin as string) || '—'} → {(inv.destination as string) || '—'} · </> : null}{inv.transportDocumentRef ? <>B/L–AWB {inv.transportDocumentRef as string}</> : null}
          </p>
        ) : null}
        <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
          {items.map((i) => <tr key={i.id as number}><td>{i.description as string}</td><td>{i.quantity as string}</td><td>{i.unit as string}</td><td>{money(i.priceMinor as number, cur)}</td><td>{money(i.amountMinor as number, cur)}</td></tr>)}
        </tbody></table>
        <div className="metrics" style={{ margin: '25px 0' }}>
          <div className="metric"><span>Subtotal</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.subtotalMinor as number, cur)}</strong></div>
          {(inv.discountMinor as number) ? <div className="metric"><span>Discount</span><strong style={{ fontSize: '1.4rem' }}>-{money(inv.discountMinor as number, cur)}</strong></div> : null}
          <div className="metric"><span>Tax ({inv.taxPercent as string}%)</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.taxMinor as number, cur)}</strong></div>
          {(inv.withholdingMinor as number) ? <div className="metric"><span>Withholding ({inv.withholdingPercent as string}%)</span><strong style={{ fontSize: '1.4rem' }}>-{money(inv.withholdingMinor as number, cur)}</strong></div> : null}
          <div className="metric"><span>Total</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.totalMinor as number, cur)}</strong></div>
          <div className="metric"><span>Outstanding</span><strong style={{ fontSize: '1.4rem' }}>{money(inv.outstandingMinor as number, cur)}</strong></div>
        </div>
        {inv.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{inv.notes as string}</p> : null}
        <div className="admin-panel"><h4>Payment instructions (frozen when the invoice was created)</h4>
          {banks.length ? banks.map((b) => <p key={b.id as number} style={{ fontFamily: 'monospace' }}>{b.bankName as string} · {b.accountNumber as string} · {b.accountHolder as string} · {b.currency as string}{b.swiftCode ? ` · SWIFT ${b.swiftCode}` : ''}</p>) : <p className="note">No payment account was selected for this invoice.</p>}
        </div>
        <div className="inline-actions">
          {status === 'draft' ? <form action={invoiceStatusAction}><input type="hidden" name="id" value={id} /><Back to={here} /><button className="button" name="action" value="issue">Issue invoice</button></form> : null}
          {['draft', 'issued'].includes(status) ? <form action={invoiceStatusAction}><input type="hidden" name="id" value={id} /><Back to={here} /><button className="button-outline" name="action" value="void">Void</button></form> : null}
          <a className="button-outline" href={`/admin/invoices/${id}/pdf`} target="_blank" rel="noopener">Download PDF ↗</a>
          {!['draft', 'void'].includes(status) ? <form action={sendInvoiceAction}><input type="hidden" name="id" value={id} /><Back to={here} /><button className="button-outline">Email invoice PDF to customer</button></form> : null}
        </div>
        {open ? <><hr /><RecordPaymentForm invoiceId={id} currency={cur} today={today()} banks={accounts} /></> : null}
        <h3 style={{ marginTop: 25 }}>Payment confirmation queue</h3>
        <table><thead><tr><th>Receipt</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {payments.length ? payments.map((p) => (
            <tr key={p.id as number}>
              <td>{p.receiptId ? <a href={`/admin/receipts/${p.receiptId}`}>{p.receiptNumber as string}</a> : '—'}</td>
              <td>{money(p.amountMinor as number, cur)}<br /><small>{p.method as string}{p.reference ? ` · ${p.reference}` : ''}</small></td>
              <td>{p.date as string}</td>
              <td><span className="status">{p.status as string}</span>
                {p.status === 'pending_confirmation' ? (
                  <>
                    <form action={confirmPaymentAction} style={{ marginTop: 9 }}>
                      <input type="hidden" name="id" value={p.id as number} /><Back to={here} />
                      {p.receivingBankSnapshot ? <p className="mini muted">Receiving account: {(p.receivingBankSnapshot as Record<string, string>).bank_name} · {(p.receivingBankSnapshot as Record<string, string>).account_number}</p> : (
                        <div className="field"><label className="mini">VORA account that received the money</label>
                          <select name="receiving_bank_id" defaultValue=""><option value="">Select the receiving account</option>{accounts.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
                        </div>
                      )}
                      <label className="mini" style={{ display: 'block' }}><input type="checkbox" name="funds_cleared" value="yes" required /> I verified that the funds are effectively credited to PT Satu Arah International</label>
                      <button className="button" style={{ marginTop: 7 }}>Confirm cleared funds &amp; notify customer</button>
                    </form>
                    <form action={cancelPaymentAction} style={{ marginTop: 5 }}><input type="hidden" name="id" value={p.id as number} /><Back to={here} /><button className="button-outline">Reject / cancel</button></form>
                  </>
                ) : p.status === 'recorded' ? <small style={{ display: 'block' }}>Confirmed {fmt(p.confirmedAt as Date)} UTC</small> : null}
              </td>
            </tr>
          )) : <tr><td colSpan={4}>No payments yet.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
