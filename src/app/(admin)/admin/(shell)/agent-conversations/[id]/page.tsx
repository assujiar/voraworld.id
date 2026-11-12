import { notFound } from 'next/navigation'
import { AdminPage, fmt, type Notices } from '@/components/admin/AdminPage'
import { conversationDetail } from '@/server/agent/conversations'

export default async function AgentConversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const found = await conversationDetail((await params).id)
  if (!found) notFound()
  const { summary: c, messages } = found
  return (
    <AdminPage heading="Agent conversation" sp={await searchParams}>
      <p><a href="/admin/agent-conversations">← All conversations</a></p>
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="admin-panel">
          <span className="eyebrow">VORA Agent · {c.locale}</span>
          <h2 style={{ fontSize: '2.1rem' }}>{c.name || 'Unnamed visitor'}</h2>
          <p><strong>{c.company}</strong><br />{c.email}{c.phone ? <><br />{c.phone}</> : null}</p>
          <p>{c.source.href ? <a href={c.source.href}>{c.source.label}</a> : c.source.label}</p>
          <p className="mini muted">Started {fmt(c.startedAt)} · last message {fmt(c.lastActivityAt)} · {c.messages} messages</p>
        </div>
        <div className="admin-panel">
          <h3>Transcript</h3>
          {messages.length ? (
            <ol className="agent-transcript">
              {messages.map((m) => (
                <li key={m.id} className={`agent-transcript__msg agent-transcript__msg--${m.role}`}>
                  <span className="agent-transcript__who">{m.role === 'assistant' ? 'VORA Agent' : c.name || 'Visitor'} · {fmt(m.at)}</span>
                  <p>{m.content}</p>
                </li>
              ))}
            </ol>
          ) : <p>No messages in this conversation yet.</p>}
        </div>
      </div>
    </AdminPage>
  )
}
