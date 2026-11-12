import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ list: [] as Array<{ table: string; columns: string; limit?: number }> }))
vi.mock('@/server/data', () => ({
  searchClause: vi.fn(async (q: string) => (q ? `visitor_name.ilike.*${q}*` : null)),
  many: vi.fn(async (table: string, _build: unknown, columns: string, limit?: number) => {
    calls.list.push({ table, columns, limit })
    if (table === 'agent_messages') return [
      { id: 7, role: 'user', content: 'Halo, saya mau kirim 2 palet ke Surabaya.\nBisa?', createdAt: new Date('2026-11-11T23:21:00Z') },
      { id: 8, role: 'assistant', content: 'Bisa, Pak.', createdAt: new Date('2026-11-11T23:21:05Z') },
    ]
    return [{ id: '0b9e8f1c-2d3a-4b5c-8d7e-6f5a4b3c2d1e', locale: 'id', visitorName: 'Budi', visitorCompany: 'PT Contoh', visitorEmail: 'budi@example.invalid', visitorPhone: '+62 812 0000 0000', identitySource: 'lead', identityRef: '42', identityAt: new Date('2026-11-11T23:20:30Z'), createdAt: new Date('2026-11-11T23:20:27Z'), lastActivityAt: new Date('2026-11-11T23:24:41Z'), agentMessages: [{ count: 14 }] }]
  }),
  one: vi.fn(async (table: string, _build: unknown, columns: string) => {
    calls.list.push({ table, columns })
    return { id: '0b9e8f1c-2d3a-4b5c-8d7e-6f5a4b3c2d1e', locale: 'en', visitorName: 'Ann', visitorCompany: 'Acme', visitorEmail: 'ann@example.invalid', visitorPhone: '+62 811', identitySource: 'customer', identityRef: '5', identityAt: null, createdAt: new Date('2026-11-01T00:00:00Z'), lastActivityAt: new Date('2026-11-02T00:00:00Z'), agentMessages: [{ count: 2 }], visitorSalutation: 'ms' }
  }),
}))

import { CONVERSATION_RETENTION_DAYS, conversationDetail, conversationSource, embeddedCount, isConversationId, listConversations } from '@/server/agent/conversations'

describe('agent conversations', () => {
  it('links a conversation to the CRM record it was matched to at registration', () => {
    expect(conversationSource('customer', '5')).toEqual({ label: 'Existing customer', href: '/admin/customers/5' })
    expect(conversationSource('lead', '42')).toEqual({ label: 'Existing lead', href: '/admin/leads/42' })
    expect(conversationSource('contact', 'c0ffee00-0000-0000-0000-000000000000').href).toBe('/admin/agent-contacts')
    expect(conversationSource('review', '').href).toBe('/admin/agent-contacts')
    expect(conversationSource('lead', '../x').href).toBeNull()
    expect(conversationSource(null, null)).toEqual({ label: 'Not matched', href: null })
  })

  it('reads only well-formed session ids and the count PostgREST embeds', () => {
    expect(isConversationId('0b9e8f1c-2d3a-4b5c-8d7e-6f5a4b3c2d1e')).toBe(true)
    expect(isConversationId('1')).toBe(false)
    expect(isConversationId("x' or 1=1")).toBe(false)
    expect(embeddedCount([{ count: 14 }])).toBe(14)
    expect(embeddedCount([])).toBe(0)
    expect(embeddedCount(undefined)).toBe(0)
  })

  it('lists every registered visitor with the message count, matched leads and customers included', async () => {
    calls.list.length = 0
    const [c] = await listConversations('budi')
    expect(calls.list[0].table).toBe('agent_sessions')
    expect(calls.list[0].columns).toContain('agent_messages(count)')
    expect(c).toMatchObject({ name: 'Budi', company: 'PT Contoh', locale: 'ID', messages: 14, source: { label: 'Existing lead', href: '/admin/leads/42' } })
    expect(c.startedAt?.toISOString()).toBe('2026-11-11T23:20:30.000Z')
  })

  it('returns the transcript in the order it was written and refuses a malformed id', async () => {
    expect(await conversationDetail('1')).toBeUndefined()
    const d = await conversationDetail('0b9e8f1c-2d3a-4b5c-8d7e-6f5a4b3c2d1e')
    expect(d?.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(d?.messages[0].content).toContain('\n')
    expect(d?.summary.source.href).toBe('/admin/customers/5')
    expect(d?.salutation).toBe('ms')
  })

  it('keeps registered conversations for 30 days after the last activity', () => {
    const sql = readFileSync('migrations/0041_agent_conversation_retention.sql', 'utf8')
    expect(CONVERSATION_RETENTION_DAYS).toBe(30)
    expect(sql).toContain("last_activity_at < now() - interval '30 days'")
    expect(sql).toContain('expires_at < now()')
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.agent_cleanup\(\) TO service_role/)
  })
})
