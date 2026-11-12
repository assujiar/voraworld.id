import { many, one, searchClause } from '@/server/data'

/** How long a registered conversation is kept after the visitor's last message (migration 0041). */
export const CONVERSATION_RETENTION_DAYS = 30

/** Where the visitor's details were matched at registration (agent_register_identity in migration 0032). */
export type ConversationSource = 'customer' | 'lead' | 'contact' | 'review' | ''

export interface ConversationLink { label: string; href: string | null }

/** The CRM record a conversation belongs to, as the admin should see it: existing customer, existing lead, new contact or a contact held for review. */
export function conversationSource(source: unknown, ref: unknown): ConversationLink {
  const id = typeof ref === 'string' && /^\d{1,10}$/.test(ref) ? ref : ''
  switch (source) {
    case 'customer': return { label: 'Existing customer', href: id ? `/admin/customers/${id}` : null }
    case 'lead': return { label: 'Existing lead', href: id ? `/admin/leads/${id}` : null }
    case 'contact': return { label: 'New website contact', href: '/admin/agent-contacts' }
    case 'review': return { label: 'Possible duplicate, under review', href: '/admin/agent-contacts' }
    default: return { label: 'Not matched', href: null }
  }
}

/** A conversation id is the session's UUID; anything else is not looked up. */
export const isConversationId = (value: string | undefined): value is string =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '')

/** The number PostgREST returns for an embedded `agent_messages(count)`. */
export function embeddedCount(value: unknown): number {
  const first = Array.isArray(value) ? value[0] : value
  const n = first && typeof first === 'object' ? Number((first as { count?: unknown }).count) : NaN
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

export interface ConversationSummary {
  id: string; name: string; company: string; email: string; phone: string; locale: string
  startedAt: Date | null; lastActivityAt: Date | null; messages: number; source: ConversationLink
}

const dateOf = (v: unknown) => (v instanceof Date ? v : v ? new Date(String(v)) : null)
const SUMMARY_COLUMNS = 'id,locale,visitor_name,visitor_company,visitor_email,visitor_phone,identity_source,identity_ref,identity_at,created_at,last_activity_at,agent_messages(count)'

function summary(r: Record<string, unknown>): ConversationSummary {
  return {
    id: String(r.id), name: String(r.visitorName ?? ''), company: String(r.visitorCompany ?? ''), email: String(r.visitorEmail ?? ''), phone: String(r.visitorPhone ?? ''),
    locale: r.locale === 'id' ? 'ID' : 'EN', startedAt: dateOf(r.identityAt ?? r.createdAt), lastActivityAt: dateOf(r.lastActivityAt),
    messages: embeddedCount(r.agentMessages), source: conversationSource(r.identitySource, r.identityRef),
  }
}

/** Registered conversations, most recent activity first. Every registered visitor is listed, including those matched to an existing lead or customer. */
export async function listConversations(query: string, limit = 200): Promise<ConversationSummary[]> {
  const clause = await searchClause(query, ['visitor_name', 'visitor_company', 'visitor_email', 'visitor_phone'])
  const rows = await many('agent_sessions', (f) => {
    const registered = f.not('identity_at', 'is', null)
    return (clause ? registered.or(clause) : registered).order('last_activity_at', { ascending: false })
  }, SUMMARY_COLUMNS, limit)
  return rows.map(summary)
}

export interface ConversationMessage { id: number; role: 'user' | 'assistant'; content: string; at: Date | null }

/** One conversation with its full transcript in the order it was written, or undefined when it does not exist (or was deleted by the visitor). */
export async function conversationDetail(id: string): Promise<{ summary: ConversationSummary; salutation: string; messages: ConversationMessage[] } | undefined> {
  if (!isConversationId(id)) return undefined
  const row = await one('agent_sessions', (q) => q.eq('id', id).not('identity_at', 'is', null), `${SUMMARY_COLUMNS},visitor_salutation`)
  if (!row) return undefined
  const messages = await many('agent_messages', (q) => q.eq('session_id', id).order('id', { ascending: true }), 'id,role,content,created_at')
  return {
    summary: summary(row), salutation: String(row.visitorSalutation ?? ''),
    messages: messages.map((m) => ({ id: Number(m.id), role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? ''), at: dateOf(m.createdAt) })),
  }
}
