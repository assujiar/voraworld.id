/** Server-only AI provider integration. Never expose credentials or raw upstream responses to browsers. */
import { rpc } from '@/server/data'
import { makeLiveAgentInstructions, type AgentSource } from './knowledge'
import type { Locale } from '@/content'

import { validProvider, validModel, type AIProvider } from '@/lib/agent-models'
export { RECOMMENDED_MODELS, validProvider, validModel } from '@/lib/agent-models'
export type { AIProvider } from '@/lib/agent-models'
export type AgentTurn = { role: 'user' | 'assistant'; content: string }
export type AgentAiResult = { text: string } | { error: 'quota' | 'unavailable' }
export type ActiveAI = { provider: AIProvider; model: string; api_key: string }

/** Read the active credential from Vault through a service-role-only function. */
export async function activeAgentAI(): Promise<ActiveAI | null> {
  try {
    const row = await rpc<ActiveAI | null>('agent_ai_active')
    if (!row || !validProvider(row.provider) || !validModel(row.provider, row.model) || !row.api_key) return null
    return row
  } catch (error) {
    console.error('VORA AI settings unavailable', error instanceof Error ? error.message : 'error')
    return null
  }
}

export async function agentReady(): Promise<boolean> {
  if (process.env.VORA_AGENT_ENABLED === 'false') return false
  return Boolean(await activeAgentAI())
}

/** Admin-only usage: caller must validate session & admin role before calling. */
export async function providerKey(provider: AIProvider): Promise<string | null> {
  return await rpc<string | null>('agent_ai_get_key', { p_provider: provider })
}

function normalizeAnswer(value: string): string {
  // References are stored in the internal KB for validation. Visitor answers never display citations/bibliography.
  const withoutReferences = value.split(/\n\s*(?:#{1,4}\s*)?(?:sources|references|sumber|referensi|rujukan)(?:\s*:\s*|\s*\n)/im)[0]
  return withoutReferences
    .replace(/cite[^]*/g, '')
    .replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?(?:iccwbo\.org|imo\.org|iata\.org|wcoomd\.org|fiata\.org)[^)]*\)/gi, '$1')
    .replace(/https?:\/\/(?:www\.)?(?:iccwbo\.org|imo\.org|iata\.org|wcoomd\.org|fiata\.org)\/\S*/gi, '')
    .replace(/【[^】]{1,100}】/g, '')
    .replace(/\s*\[(?:\d{1,2}(?:\s*,\s*\d{1,2})*|source:[^\]]+)\]/gi, '')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, 3900)
}

function timeoutSignal() { return AbortSignal.timeout(24_000) }

async function callGemini(ai: ActiveAI, messages: AgentTurn[], instructions: string): Promise<AgentAiResult> {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 1000 }
  if (/^gemini-2\.5-/.test(ai.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
  else if (/^gemini-3\./.test(ai.model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ai.model}:generateContent`, {
    method: 'POST', cache: 'no-store', signal: timeoutSignal(),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': ai.api_key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig,
    }),
  })
  if (res.status === 429) return { error: 'quota' }
  if (!res.ok) { console.error('VORA Gemini HTTP', res.status); return { error: 'unavailable' } }
  const result = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = normalizeAnswer((result.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || '').join(''))
  return text ? { text } : { error: 'unavailable' }
}

async function callOpenAI(ai: ActiveAI, messages: AgentTurn[], instructions: string): Promise<AgentAiResult> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', cache: 'no-store', signal: timeoutSignal(),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ai.api_key}` },
    body: JSON.stringify({
      model: ai.model, instructions, store: false, max_output_tokens: 1200,
      input: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    }),
  })
  if (res.status === 429) return { error: 'quota' }
  if (!res.ok) { console.error('VORA OpenAI HTTP', res.status); return { error: 'unavailable' } }
  const result = await res.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }
  const rawText = result.output_text || (result.output ?? []).filter((i) => i.type === 'message').flatMap((i) => i.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('')
  const text = normalizeAnswer(rawText)
  return text ? { text } : { error: 'unavailable' }
}

export async function generateAgentReply(messages: AgentTurn[], locale: Locale, preview?: AgentSource): Promise<AgentAiResult> {
  const ai = await activeAgentAI()
  if (!ai) return { error: 'unavailable' }
  const latest = messages.filter((m) => m.role === 'user').slice(-3).map((m) => m.content).join(' ').slice(-1100)
  try {
    const instructions = await makeLiveAgentInstructions(latest, locale, preview)
    return ai.provider === 'gemini' ? await callGemini(ai, messages, instructions) : await callOpenAI(ai, messages, instructions)
  } catch (error) {
    console.error('VORA agent provider unavailable', error instanceof Error ? error.name : 'error')
    return { error: 'unavailable' }
  }
}

/** Publicly safe labels only; never return API keys or other data from the provider. */
export async function listProviderModels(provider: AIProvider): Promise<Array<{ id: string; label: string }>> {
  const key = await providerKey(provider)
  if (!key) throw new Error('Save an API key for this provider first')
  const data = provider === 'gemini'
    ? await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
        headers: { 'x-goog-api-key': key }, cache: 'no-store', signal: AbortSignal.timeout(12000),
      })
    : await fetch('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(12000),
      })
  if (!data.ok) throw new Error(`Provider returned HTTP ${data.status}; verify your API key and API access`)
  const result = await data.json() as { models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>; data?: Array<{ id: string }> }
  const models = provider === 'gemini'
    ? (result.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
    : (result.data ?? []).map((m) => ({ id: m.id, label: m.id }))
  return models.filter((m) => validModel(provider, m.id)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 200)
}
