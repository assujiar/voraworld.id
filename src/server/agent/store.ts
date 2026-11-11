import { insert, many, one, update } from '@/server/data'
import { digest, SESSION_LIFETIME_SECONDS } from './security'
import type { AgentTurn } from './gemini'
import type { Locale } from '@/content'
import { parseSalutation, type AgentSalutation } from './personalization'

export interface AgentSession { id: string; locale: Locale; identityAt: Date | null; name: string; company: string; email: string; phone: string; salutation: AgentSalutation | null }
export async function loadSession(token: string): Promise<AgentSession | null> {
  const row = await one('agent_sessions', (q) => q.eq('token_hash', digest(token)).gt('expires_at', new Date().toISOString()), 'id,locale,identity_at,visitor_name,visitor_company,visitor_email,visitor_phone,visitor_salutation')
  return row ? { id: String(row.id), locale: row.locale === 'id' ? 'id' : 'en', identityAt: row.identityAt instanceof Date ? row.identityAt : row.identityAt ? new Date(String(row.identityAt)) : null, name: String(row.visitorName || ''), company: String(row.visitorCompany || ''), email: String(row.visitorEmail || ''), phone: String(row.visitorPhone || ''), salutation: parseSalutation(row.visitorSalutation) } : null
}

export async function ensureSession(token: string, locale: Locale): Promise<AgentSession> {
  const existing = await loadSession(token)
  if (existing) return existing
  // A token is generated only on the server. A unique collision is astronomically unlikely.
  const rows = await insert('agent_sessions', { token_hash: digest(token), locale, consent_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000).toISOString() })
  return { id: String(rows[0].id), locale, identityAt: null, name: '', company: '', email: '', phone: '', salutation: null }
}

export async function touchSession(id: string): Promise<void> {
  await update('agent_sessions', { last_activity_at: new Date().toISOString() }, (q) => q.eq('id', id))
}

export async function addAgentMessage(id: string, role: AgentTurn['role'], content: string): Promise<void> {
  await insert('agent_messages', { session_id: id, role, content })
}

export async function agentMessages(id: string, max = 14): Promise<AgentTurn[]> {
  const rows = await many('agent_messages', (q) => q.eq('session_id', id).order('id', { ascending: false }), 'role,content', max)
  return rows.reverse().map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: String(r.content ?? '') }))
}
