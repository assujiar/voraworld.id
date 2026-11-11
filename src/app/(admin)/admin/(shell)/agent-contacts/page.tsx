import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { reviewAgentIdentity } from '@/actions/agent-contacts'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'

export default async function AgentContacts({ searchParams }: { searchParams: Promise<Notices> }) {
  const [reviews, contacts] = await Promise.all([
    many('agent_identity_reviews', (q) => q.eq('status', 'pending').order('created_at', { ascending: false }), 'id,name,company,email,phone,reason,created_at', 150),
    many('agent_contacts', (q) => q.order('created_at', { ascending: false }), 'id,name,company,email,phone,created_at', 150),
  ])
  return <AdminPage heading="Agent Contacts" sp={await searchParams}>
    <div className="admin-panel">
      <h3>Potential duplicate contacts</h3>
      <p>These registrations resemble an existing record. Check customer and lead details before making changes. They are not merged automatically.</p>
      <div style={{ overflowX: 'auto' }}>
        <table><thead><tr><th>Name / company</th><th>Contact</th><th>Flag</th><th>Review</th></tr></thead>
          <tbody>{reviews.length ? reviews.map((r) => <tr key={r.id as number}>
            <td>{String(r.name)}<br/><small>{String(r.company)}</small></td>
            <td>{String(r.email)}<br/><small>{String(r.phone)}</small></td>
            <td><small>{String(r.reason)}</small></td>
            <td><PendingForm action={reviewAgentIdentity}><input type="hidden" name="record" value={Number(r.id)}/><AsyncButton className="button-outline">Mark reviewed</AsyncButton></PendingForm></td>
          </tr>) : <tr><td colSpan={4}>No pending potential duplicates.</td></tr>}</tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 30 }}>New website contacts</h3>
      <p>Only registrations with no exact or suspected CRM match appear here. Exact matches to Leads or Customers reuse their existing record.</p>
      <div style={{ overflowX: 'auto' }}>
        <table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th></tr></thead>
          <tbody>{contacts.length ? contacts.map((c) => <tr key={String(c.id)}>
            <td>{String(c.name)}</td><td>{String(c.company)}</td><td>{String(c.email)}</td><td>{String(c.phone)}</td>
          </tr>) : <tr><td colSpan={4}>No agent contact registrations yet.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </AdminPage>
}
