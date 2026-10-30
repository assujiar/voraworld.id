import type { Locale } from '../index'
import { periodTag } from '@/lib/archive'
import { renderBody } from './render'
import type { ArchiveDraft } from './types'

export interface ArchiveRow {
  slug: string; title: string; excerpt: string; body: string; category: string; tags: string; locale: Locale
  status: 'draft'; cover: string; author: string; seo_title: string; seo_description: string
}

/**
 * The `articles` row for one language of a draft, in the columns that exist today. Archive period and the English/Indonesian link travel in `tags`
 * (`period:`, `pair:`), the source list is part of the body, and the byline stays empty until the owner approves "VORA Editorial". Status is always
 * draft and no publication date is set: that is decided when the owner publishes.
 */
export function rowFor(draft: ArchiveDraft, locale: Locale): ArchiveRow {
  const l = draft[locale]
  return {
    slug: l.slug, title: l.title, excerpt: l.excerpt, body: renderBody(l, draft.sources, locale), category: draft.topic[locale],
    tags: [periodTag(draft.year, draft.quarter), `pair:${draft.group}`, 'archive'].join(','), locale, status: 'draft', cover: '', author: '',
    seo_title: l.seoTitle, seo_description: l.seoDescription,
  }
}

export const allRows = (drafts: ArchiveDraft[]): ArchiveRow[] => drafts.flatMap((d) => (['en', 'id'] as const).map((l) => rowFor(d, l)))
