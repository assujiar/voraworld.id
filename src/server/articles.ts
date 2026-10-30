import { count, ilikeValue, many, one, slice, type Filter } from './data'
import type { Locale } from '@/content'
import type { ArticleCard } from '@/components/site/InsightCards'
import { parseArchiveTags, periodTag } from '@/lib/archive'

const CARD = 'slug,title,excerpt,category,tags,published_at'
const newestFirst = (q: Filter) => q.order('published_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })

export async function latestArticles(locale: Locale, limit: number): Promise<ArticleCard[]> {
  const rows = await many('articles', (q) => newestFirst(q.eq('status', 'published').eq('locale', locale)), CARD, limit)
  return rows as unknown as ArticleCard[]
}

export interface ArchiveFilter { q?: string; topic?: string; year?: number | null; quarter?: number | null }

/** Published articles of one language: newest publication first, filtered by search text, topic and archive period. */
export async function searchArticles(locale: Locale, q: string, page: number, perPage = 12, filter: Omit<ArchiveFilter, 'q'> = {}) {
  const match = (f: Filter) => {
    let base = f.eq('status', 'published').eq('locale', locale)
    if (filter.topic) base = base.eq('category', filter.topic)
    if (filter.year && filter.quarter) base = base.or(`tags.ilike.${ilikeValue(periodTag(filter.year, filter.quarter))}`)
    else if (filter.year) base = base.or(`tags.ilike.${ilikeValue(`period:${filter.year}-Q`)}`)
    return q ? base.or(`title.ilike.${ilikeValue(q)},excerpt.ilike.${ilikeValue(q)}`) : base
  }
  const n = await count('articles', match)
  const from = (page - 1) * perPage
  const rows = await slice('articles', (f) => newestFirst(match(f)), CARD, from, perPage)
  return { articles: rows as unknown as ArticleCard[], totalPages: Math.ceil(n / perPage), total: n }
}

/** The topics that have at least one published article in this language. */
export async function articleTopics(locale: Locale): Promise<string[]> {
  const rows = await many('articles', (q) => q.eq('status', 'published').eq('locale', locale), 'category')
  return [...new Set(rows.map((r) => String(r.category ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export async function publishedArticle(locale: Locale, slug: string) {
  const row = await one('articles', (q) => q.eq('slug', slug).eq('locale', locale).eq('status', 'published'))
  return row as import('./schema').ArticlesRow | undefined
}

/** The same article in the other language, linked by the `pair:` tag; only a published one counts. */
export async function pairedArticle(locale: Locale, tags: string): Promise<{ slug: string; locale: Locale } | null> {
  const { group } = parseArchiveTags(tags)
  if (!group) return null
  const other: Locale = locale === 'en' ? 'id' : 'en'
  const row = await one('articles', (q) => q.eq('status', 'published').eq('locale', other).or(`tags.ilike.${ilikeValue(`pair:${group}`)}`), 'slug,tags')
  if (!row || parseArchiveTags(String(row.tags ?? '')).group !== group) return null
  return { slug: String(row.slug), locale: other }
}

/** Related reading: same topic first, then the nearest archive periods, never the article itself. */
export async function relatedArticles(locale: Locale, slug: string, category: string, tags: string, limit = 3): Promise<ArticleCard[]> {
  const rows = (await many('articles', (q) => newestFirst(q.eq('status', 'published').eq('locale', locale).neq('slug', slug)), CARD, 60)) as unknown as ArticleCard[]
  const me = parseArchiveTags(tags)
  const at = (a: ArticleCard) => { const m = parseArchiveTags(a.tags); return m.year && m.quarter ? m.year * 4 + m.quarter : null }
  const mine = me.year && me.quarter ? me.year * 4 + me.quarter : null
  const score = (a: ArticleCard) => (a.category === category ? 0 : 100) + (mine !== null && at(a) !== null ? Math.abs((at(a) as number) - mine) : 50)
  return rows.sort((a, b) => score(a) - score(b)).slice(0, limit)
}
