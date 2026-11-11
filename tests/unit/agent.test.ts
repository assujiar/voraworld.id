import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { agentSources, retrieveAgentSources, makeAgentInstructions } from '@/server/agent/knowledge'
import { generateAgentReply, activeAgentAI } from '@/server/agent/providers'
import { validModel, validProvider, RECOMMENDED_MODELS } from '@/lib/agent-models'

const mock = vi.hoisted(() => ({ active: null as null | {provider:string; model:string; api_key:string} }))
vi.mock('@/server/data', () => ({
  rpc: vi.fn(async (fn: string) => fn === 'agent_ai_active' ? mock.active : []),
  many: vi.fn(async () => []),
}))

afterEach(() => { vi.unstubAllGlobals(); mock.active = null })

beforeEach(() => { mock.active = null })

describe('VORA Agent approved knowledge', () => {
  it('contains public company details and five service groups, in each language', () => {
    for (const locale of ['en', 'id'] as const) {
      const docs = agentSources(locale)
      expect(docs[0].text).toContain('info@voraworld.id')
      expect(docs.filter((d) => d.id.startsWith('service-'))).toHaveLength(5)
      expect(docs.some((d) => d.id === 'domain-incoterms')).toBe(true)
    }
  })
  it('retrieves customs guidance for customs inquiries', () => {
    const docs = retrieveAgentSources('customs clearance invoice packing list import', 'en')
    expect(docs.some((d) => /customs/i.test(d.title))).toBe(true)
    expect(docs.length).toBeLessThanOrEqual(7)
  })
  it('grounds Incoterms without presenting reference URLs', () => {
    const prompt = makeAgentInstructions('FOB CIF CFR risk transfer incoterms', 'en')
    expect(prompt).toContain('Incoterms® 2020')
    expect(prompt).toContain('Never show citations')
    expect(prompt).not.toContain('### Incoterms® 2020 (https:')
  })
  it('uses natural Indonesian and avoids invented rates', () => {
    const prompt = makeAgentInstructions('Berapa biaya kirim ke Jepang?', 'id')
    expect(prompt).toContain('Answer in the visitor')
    expect(prompt).toContain('/id/request-quote')
    expect(prompt).toContain('Never claim')
  })
})

describe('AI provider configuration', () => {
  it('allows text models and rejects unrelated model types', () => {
    expect(validProvider('gemini')).toBe(true)
    expect(validModel('gemini', 'gemini-3.8-flash')).toBe(true)
    expect(validModel('gemini', 'gemini-3.1-flash-image')).toBe(false)
    expect(validModel('openai', 'gpt-6-luna')).toBe(true)
    expect(validModel('openai', 'gemini-3.8-flash')).toBe(false)
    expect(RECOMMENDED_MODELS.openai.length).toBeGreaterThan(1)
  })
  it('stays offline without admin-configured credentials', async () => {
    expect(await activeAgentAI()).toBe(null)
    expect(await generateAgentReply([{ role: 'user', content: 'Hello' }], 'en')).toEqual({ error: 'unavailable' })
  })
  it('calls Gemini with Vault key and strips unwanted citations', async () => {
    mock.active = { provider: 'gemini', model: 'gemini-3.8-flash', api_key: 'vault-private-key' }
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toContain('generativelanguage.googleapis.com')
      expect((options.headers as Record<string,string>)['x-goog-api-key']).toBe('vault-private-key')
      const body = JSON.parse(String(options.body))
      expect(body.contents).toHaveLength(1)
      expect(body.systemInstruction.parts[0].text).toContain('Never show citations')
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Kami bisa bantu review. 【1】\n\nSources:\n- Company file' }] } }] }) }
    }))
    expect(await generateAgentReply([{ role: 'user', content: 'OOG cargo' }], 'id')).toEqual({ text: 'Kami bisa bantu review.' })
  })
  it('calls OpenAI Responses with store:false and no reference section', async () => {
    mock.active = { provider: 'openai', model: 'gpt-6-luna', api_key: 'vault-openai-key' }
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/responses')
      expect((options.headers as Record<string,string>).authorization).toBe('Bearer vault-openai-key')
      const body = JSON.parse(String(options.body))
      expect(body.store).toBe(false)
      expect(body.model).toBe('gpt-6-luna')
      return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'We can review your shipment. [1]\nReferences:\n- Private knowledge' }] }] }) }
    }))
    expect(await generateAgentReply([{ role: 'user', content: 'Hi' }], 'en')).toEqual({ text: 'We can review your shipment.' })
  })
  it('handles provider rate limits without fabricating an answer', async () => {
    mock.active = { provider: 'gemini', model: 'gemini-3.5-flash-lite', api_key: 'vault-private-key' }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })))
    expect(await generateAgentReply([{ role: 'user', content: 'Hi' }], 'en')).toEqual({ error: 'quota' })
  })
})
