import { notFound } from 'next/navigation'
import { convertLeadAction, replyLeadAction, updateLeadAction } from '@/actions/crm'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { many, one } from '@/server/data'
import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/server/lead-constants'
import { leadCustomerMatches } from '@/server/leads'
import { QUOTATION_LABEL } from '@/server/finance/labels'
import { CURRENCIES } from '@/server/finance/parse'
import { money } from '@/server/money'
import type { LeadsRow } from '@/server/schema'
import { routeId } from '@/server/http'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const lead = id > 0 ? await one('leads', (q) => q.eq('id', id)) : undefined
  if (!lead) notFound()
  const o = lead as unknown as LeadsRow
  const customer = o.customerId ? await one('customers', (q) => q.eq('id', o.customerId!), 'id,name,public_code') : undefined
  const quotations = await many('quotations', (q) => q.eq('lead_id', id).order('id', { ascending: false }), 'id,number,status,total_minor,currency', 50)
  const matches = o.customerId ? [] : await leadCustomerMatches(id)
  const everyone = o.customerId ? [] : await many('customers', (q) => q.order('name'), 'id,name,public_code', 500)
  const activities = await many('lead_activities', (q) => q.eq('lead_id', id).order('id', { ascending: false }), 'created_at,message')
  return (
    <AdminPage heading="Lead detail" sp={await searchParams}>
      <div className="dashboard-split">
        <div className="admin-panel">
          <span className="eyebrow">{o.type} · {o.reference || `Legacy lead #${o.id}`}</span>
          <h2 style={{ fontSize: '2.1rem' }}>{o.name}</h2>
          <p><strong>{o.company}</strong><br />{o.email}{o.phone ? <><br />{o.phone}</> : null}</p>
          <p>{o.message}</p>
          {o.type === 'RFQ' ? <div className="note">{o.mode} · {o.origin} → {o.destination} · {o.pickup}<p>{o.cargo}</p></div> : null}
          <p className="mini muted">Created {fmt(o.createdAt)}</p>
        </div>
        <div className="admin-panel">
          <h3>Pipeline &amp; follow-up</h3>
          <PendingForm action={updateLeadAction}>
            <input type="hidden" name="record" value={o.id} /><Back to={`/admin/leads/${o.id}`} />
            <div className="field"><label>Status</label><select name="status" defaultValue={o.status}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="field"><label>Priority</label><select name="priority" defaultValue={o.priority}>{LEAD_PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Assignee</label><input name="assignee" defaultValue={o.assignee} /></div>
            <div className="field"><label>Follow-up</label><input name="followup" type="date" defaultValue={o.followup} /></div>
            <div className="field"><label>Internal note (appends to activity timeline)</label><textarea name="note" /></div>
            <AsyncButton className="button">Save lead</AsyncButton>
          </PendingForm>
          {o.email ? (
            <PendingForm action={replyLeadAction} style={{ marginTop: 25 }}>
              <input type="hidden" name="record" value={o.id} /><Back to={`/admin/leads/${o.id}`} />
              <h3>Reply by email</h3>
              <div className="field"><label>Message to {o.email}</label><textarea name="message" required minLength={2} maxLength={6000} rows={5} /></div>
              <AsyncButton className="button-outline">Send reply</AsyncButton>
              <p className="muted mini" style={{ marginTop: 8 }}>Needs SMTP and the <code>lead_reply</code> notification switched on. The reply is recorded in the activity below.</p>
            </PendingForm>
          ) : null}
          <h3 style={{ marginTop: 25 }}>Activity</h3>
          {activities.length ? activities.map((a, i) => <p className="mini" key={i}>{fmt(a.createdAt as Date)} · {a.message as string}</p>) : <p className="muted">No notes yet.</p>}
        </div>
      </div>

      <div className="admin-panel">
        <h3>Customer and quotation</h3>
        {customer ? (
          <>
            <p>This lead is the customer <a href={`/admin/customers/${customer.id}`}><strong>{customer.name as string}</strong></a> <small className="muted">· {customer.publicCode as string} · converted {o.convertedAt ? fmt(o.convertedAt) : ''}</small>. The lead itself is kept as it was.</p>
            <div className="inline-actions"><a className="button" href={`/admin/quotations/new?customer=${customer.id}&lead=${o.id}`}>Buat Quotation</a><a className="button-outline" href={`/admin/customers/${customer.id}`}>Open the customer</a></div>
          </>
        ) : (
          <PendingForm action={convertLeadAction}>
            <input type="hidden" name="record" value={o.id} />
            <p className="note">A quotation is always for a customer. Save this lead as a customer first (or link one that already exists), then make the quotation. Check the details before saving; nothing is merged for you.</p>
            {matches.length ? (
              <div className="alert" role="status">
                <strong>Customers that look like this lead:</strong>
                <ul style={{ margin: '6px 0 0 18px' }}>{matches.map((m) => <li key={m.id}><a href={`/admin/customers/${m.id}`}>{m.name}</a> {m.publicCode ? `(${m.publicCode})` : ''}: {m.why}</li>)}</ul>
              </div>
            ) : null}
            <div className="field"><label>Link an existing customer</label>
              <select name="existing_customer_id" defaultValue="">
                <option value="">No: save as a new customer (fill in the details below)</option>
                {everyone.map((c) => <option key={c.id as number} value={c.id as number}>{c.name as string} · {(c.publicCode as string) || 'legacy'}</option>)}
              </select>
            </div>
            <div className="admin-form-grid">
              <div className="field"><label>Company / person *</label><input name="name" defaultValue={o.company || o.name} maxLength={200} /></div>
              <div className="field"><label>Billing email</label><input name="email" type="email" defaultValue={o.email} maxLength={200} /></div>
              <div className="field"><label>Tax identifier (NPWP)</label><input name="tax_id" maxLength={100} /></div>
              <div className="field"><label>Company phone</label><input name="phone" type="tel" maxLength={60} /></div>
              <div className="field"><label>Currency</label><select name="currency" defaultValue="IDR">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label>Payment terms (days)</label><input name="terms_days" type="number" min={0} max={365} defaultValue={14} /></div>
              <div className="field wide"><label>Billing address</label><textarea name="address" maxLength={3000} /></div>
              <div className="field"><label>Contact person (PIC)</label><input name="pic_name" defaultValue={o.name} maxLength={160} /></div>
              <div className="field"><label>PIC position</label><input name="pic_position" maxLength={160} /></div>
              <div className="field"><label>PIC email</label><input name="pic_email" type="email" defaultValue={o.email} maxLength={200} /></div>
              <div className="field"><label>PIC phone / mobile</label><input name="pic_phone" type="tel" defaultValue={o.phone} maxLength={60} /></div>
              {matches.length ? <div className="field wide"><label style={{ fontWeight: 400 }}><input type="checkbox" name="different_customer" value="yes" style={{ width: 'auto', minHeight: 0, marginRight: 8 }} /> This is a different customer, even if it looks like one of the above</label></div> : null}
            </div>
            <div className="inline-actions">
              <AsyncButton className="button-outline">Simpan sebagai Customer</AsyncButton>
              <AsyncButton className="button" name="then" value="quotation">Simpan sebagai Customer &amp; Buat Quotation</AsyncButton>
            </div>
          </PendingForm>
        )}
        {quotations.length ? (
          <>
            <h4 style={{ marginTop: 18 }}>Quotations from this lead</h4>
            <table><thead><tr><th>Number</th><th>Status</th><th>Total</th></tr></thead><tbody>
              {quotations.map((q) => <tr key={q.id as number}><td><a href={`/admin/quotations/${q.id}`}>{q.number as string}</a></td><td>{QUOTATION_LABEL[q.status as string] ?? (q.status as string)}</td><td>{money(q.totalMinor as number, q.currency as string)}</td></tr>)}
            </tbody></table>
          </>
        ) : null}
      </div>
    </AdminPage>
  )
}
