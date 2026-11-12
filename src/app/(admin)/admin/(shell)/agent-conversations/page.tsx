import { AdminPage, ListLoad, fmt, type Notices } from '@/components/admin/AdminPage'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'
import { CONVERSATION_RETENTION_DAYS, listConversations } from '@/server/agent/conversations'

export default async function AgentConversations({ searchParams }: { searchParams: Promise<Notices & { q?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  return (
    <AdminPage heading="Agent Conversations" sp={sp}>
      <div className="admin-panel">
        <p className="mini muted">Every visitor who registered with VORA Agent, including those matched to an existing lead or customer. A conversation is kept for {CONVERSATION_RETENTION_DAYS} days after its last message, unless the visitor deletes it from the chat window.</p>
        <StepForm className="inline-actions">
          <input placeholder="Search name, company, email, phone" name="q" defaultValue={q} />
          <AsyncButton className="button">Filter</AsyncButton>
        </StepForm>
        <ListLoad filters={[q]} what="conversations" columns={5}><ConversationRows q={q} /></ListLoad>
      </div>
    </AdminPage>
  )
}

async function ConversationRows({ q }: { q: string }) {
  const rows = await listConversations(q)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table><thead><tr><th>Visitor</th><th>Contact</th><th>Started</th><th>Last message</th><th>Messages</th></tr></thead><tbody>
        {rows.length ? rows.map((c) => (
          <tr key={c.id}>
            <td><a href={`/admin/agent-conversations/${c.id}`}>{c.name || 'Unnamed visitor'}</a><br /><small>{c.company}</small><br /><small className="muted">{c.source.label} · {c.locale}</small></td>
            <td><small>{c.email}<br />{c.phone}</small></td>
            <td>{fmt(c.startedAt)}</td>
            <td>{fmt(c.lastActivityAt)}</td>
            <td><a href={`/admin/agent-conversations/${c.id}`}>{c.messages}</a></td>
          </tr>
        )) : <tr><td colSpan={5}>{q ? 'No matching conversations.' : 'No conversations yet.'}</td></tr>}
      </tbody></table>
    </div>
  )
}
