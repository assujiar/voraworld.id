/** Model catalog is a UI hint; the provider API remains the authority on availability. */
export type AIProvider = 'gemini' | 'openai'
export const RECOMMENDED_MODELS: Record<AIProvider, Array<{ id: string; label: string }>> = {
  gemini: [
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  ],
  openai: [
    { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
    { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra' },
    { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { id: 'gpt-5.2', label: 'GPT-5.2' },
  ],
}

export const validProvider = (p: unknown): p is AIProvider => p === 'gemini' || p === 'openai'
export function validModel(provider: AIProvider, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 120 || value.includes('..')) return false
  const textOnly = !/(?:^|[-.])(image|tts|live|transcribe|embedding|audio|video|robotics)(?:[-.]|$)/.test(value)
  return textOnly && (provider === 'gemini' ? /^gemini-[a-z0-9.-]+$/.test(value) : /^gpt-[a-z0-9.-]+$/.test(value))
}
