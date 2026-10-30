import type { Locale } from '../index'

/** One block of an article. Text is plain; the renderer escapes it. `**bold**` is the only inline markup. */
export interface Section {
  h: string
  p?: string[]
  list?: string[]
  /** A numbered list (steps, questions to put in order). */
  steps?: string[]
  table?: { head: string[]; rows: string[][] }
  /** A worked example. Always labelled as hypothetical in the section text. */
  example?: { label: string; p: string[] }
  /** Paragraphs after the list, table or example. */
  after?: string[]
}

export interface LangDraft {
  slug: string
  title: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  coverAlt: string
  sections: Section[]
}

export interface SourceRef { id: string; title: string; url: string; /** ISO date the page was actually read while drafting; null when it could not be reached and must be rechecked. */ accessed: string | null }

export interface ArchiveDraft {
  /** Shared by the English and Indonesian versions (the `pair:` tag). */
  group: string
  year: 2023 | 2024 | 2025 | 2026
  quarter: 1 | 2 | 3 | 4
  topic: Record<Locale, string>
  sources: string[]
  en: LangDraft
  id: LangDraft
}
