import { ActionError } from '@/server/errors'

export const KNOWLEDGE_CATEGORIES = ['company', 'services', 'operations', 'incoterms', 'customs', 'documentation', 'faq', 'other'] as const
export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]
export const MAX_KNOWLEDGE_BODY = 80_000

export interface KnowledgeInput {
  category: KnowledgeCategory
  titleEn: string
  titleId: string
  bodyEn: string
  bodyId: string
  sourceUrl: string
}

const text = (value: unknown, limit: number): string => {
  if (typeof value !== 'string') throw new ActionError('Invalid article data')
  const cleaned = value.replace(/\u0000/g, '').trim()
  if (cleaned.length > limit) throw new ActionError(`Field exceeds ${limit.toLocaleString('en-US')} characters`)
  return cleaned
}

export function validateKnowledgeInput(value: Record<string, unknown>): KnowledgeInput {
  const category = text(value.category, 40)
  if (!KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory)) throw new ActionError('Choose a valid knowledge category')
  const result: KnowledgeInput = {
    category: category as KnowledgeCategory,
    titleEn: text(value.title_en, 200), titleId: text(value.title_id, 200),
    bodyEn: text(value.body_en, MAX_KNOWLEDGE_BODY), bodyId: text(value.body_id, MAX_KNOWLEDGE_BODY),
    sourceUrl: text(value.source_url, 500),
  }
  if ((!result.titleEn !== !result.bodyEn) || (!result.titleId !== !result.bodyId)) {
    throw new ActionError('Every language needs both a title and content')
  }
  if (!result.bodyEn && !result.bodyId) throw new ActionError('Provide content in at least one language')
  if (result.sourceUrl) {
    if (!result.sourceUrl.startsWith('/')) {
      let url: URL
      try { url = new URL(result.sourceUrl) } catch { throw new ActionError('Reference must be an HTTPS URL or a local path') }
      if (url.protocol !== 'https:' || url.username || url.password) throw new ActionError('Use a public HTTPS reference URL')
    } else if (!/^\/(en|id)(\/|$)/.test(result.sourceUrl) || result.sourceUrl.includes('\\') || result.sourceUrl.includes('..') || /[\u0000-\u001f]/.test(result.sourceUrl)) {
      throw new ActionError('Invalid local reference URL')
    }
  }
  return result
}

export function inputFromForm(form: FormData): KnowledgeInput {
  return validateKnowledgeInput(Object.fromEntries(['category','title_en','title_id','body_en','body_id','source_url'].map((key) => [key, form.get(key)])))
}

export function knowledgePayload(input: KnowledgeInput) {
  return {
    category: input.category, title_en: input.titleEn, title_id: input.titleId,
    body_en: input.bodyEn, body_id: input.bodyId, source_url: input.sourceUrl,
  }
}

export function getKnowledgeId(form: FormData): number {
  const n = Number(form.get('record'))
  if (!Number.isSafeInteger(n) || n < 1) throw new ActionError('Invalid knowledge article')
  return n
}
export function getKnowledgeRevision(form: FormData): number {
  const n = Number(form.get('revision'))
  if (!Number.isSafeInteger(n) || n < 1) throw new ActionError('Invalid article revision')
  return n
}
