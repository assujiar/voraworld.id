import type { Locale } from '@/content'

/**
 * Archive metadata for an article, kept in the existing `tags` column so the archive works before any schema change:
 * `period:2024-Q3` is the editorial period (a bucket of the collection, never a publication date), `pair:<group>` links the English and Indonesian
 * versions, `reviewed:2026-11-02` is the date an editor actually reviewed the text. Other tags stay ordinary tags.
 */
export interface ArchiveMeta { year: number | null; quarter: number | null; group: string | null; reviewed: string | null; tags: string[] }

export function parseArchiveTags(tags: string | null | undefined): ArchiveMeta {
  const out: ArchiveMeta = { year: null, quarter: null, group: null, reviewed: null, tags: [] }
  for (const raw of String(tags ?? '').split(',')) {
    const tag = raw.trim()
    if (!tag) continue
    const period = /^period:(20\d\d)-Q([1-4])$/i.exec(tag)
    if (period) { out.year = Number(period[1]); out.quarter = Number(period[2]); continue }
    const pair = /^pair:([a-z0-9-]{3,80})$/i.exec(tag)
    if (pair) { out.group = pair[1].toLowerCase(); continue }
    const reviewed = /^reviewed:(\d{4}-\d{2}-\d{2})$/.exec(tag)
    if (reviewed) { out.reviewed = reviewed[1]; continue }
    out.tags.push(tag)
  }
  return out
}

export const periodLabel = (year: number, quarter: number) => `Q${quarter} ${year}`
export const periodTag = (year: number, quarter: number) => `period:${year}-Q${quarter}`

export const ARCHIVE_YEARS = [2023, 2024, 2025, 2026] as const

export const archiveNote: Record<Locale, { title: string; body: string }> = {
  en: {
    title: 'VORA Knowledge Archive, 2023–2026',
    body: "A retrospective editorial collection organized by quarterly themes. Archive periods identify the collection's structure, not the original publication date or the company's operating history.",
  },
  id: {
    title: 'Arsip Pengetahuan VORA, 2023–2026',
    body: 'Kumpulan pengetahuan industri yang disusun berdasarkan tema per kuartal. Periode arsip menunjukkan pengelompokan editorial, bukan tanggal terbit awal atau riwayat operasional perusahaan.',
  },
}

/** Reading time from the visible words of the HTML. */
export const readingMinutes = (html: string) => Math.max(1, Math.round(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220))
