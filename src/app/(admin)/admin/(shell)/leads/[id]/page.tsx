import { notFound } from 'next/navigation'
import { updateLeadAction } from '@/actions/crm'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/server/lead-constants'
import type { LeadsRow } from '@/server/schema'

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = Number((await params).id) || 0
  const [lead] = await sql`select * from leads where id = ${id}`
  if (!lead) notFound()
  const o = lead as LeadsRow
  const activities = await sql`select created_at, message from lead_activities where lead_id = ${id} order by id desc`
  return (
    <AdminPage heading="Lead detail" sp={await searchParams}>
      <div className="dashboard-split">
        <div className="admin-panel">
          <span className="eyebrow">{o.type} · {o.reference || `Legacy lead #${o.id}`}</span>
          <h2 style={{ fontSize: '2.1rem' }}>{o.name}</h2>
          <p><strong>{o.company}</strong><br />{o.email}</p>
          <p>{o.message}</p>
          {o.type === 'RFQ' ? <div className="note">{o.mode} · {o.origin} → {o.destination} · {o.pickup}<p>{o.cargo}</p></div> : null}
          <p className="mini muted">Created {fmt(o.createdAt)}</p>
        </div>
        <div className="admin-panel">
          <h3>Pipeline &amp; follow-up</h3>
          <form action={updateLeadAction}>
            <input type="hidden" name="id" value={o.id} /><Back to={`/admin/leads/${o.id}`} />
            <div className="field"><label>Status</label><select name="status" defaultValue={o.status}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="field"><label>Priority</label><select name="priority" defaultValue={o.priority}>{LEAD_PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Assignee</label><input name="assignee" defaultValue={o.assignee} /></div>
            <div className="field"><label>Follow-up</label><input name="followup" type="date" defaultValue={o.followup} /></div>
            <div className="field"><label>Internal note (appends to activity timeline)</label><textarea name="note" /></div>
            <button className="button">Save lead</button>
          </form>
          <h3 style={{ marginTop: 25 }}>Activity</h3>
          {activities.length ? activities.map((a, i) => <p className="mini" key={i}>{fmt(a.createdAt as Date)} · {a.message as string}</p>) : <p className="muted">No notes yet.</p>}
        </div>
      </div>
    </AdminPage>
  )
}
