import { count, ilikeValue, many, one, slice, type Filter } from './data'
import type { Locale } from '@/content'
import type { ArticleCard } from '@/components/site/InsightCards'

const CARD = 'slug,title,excerpt,category,published_at'
const newestFirst = (q: Filter) => q.order('published_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })

export async function latestArticles(locale: Locale, limit: number): Promise<ArticleCard[]> {
  const rows = await many('articles', (q) => newestFirst(q.eq('status', 'published').eq('locale', locale)), CARD, limit)
  return rows as unknown as ArticleCard[]
}

export async function searchArticles(locale: Locale, q: string, page: number, perPage = 12) {
  const match = (f: Filter) => {
    const base = f.eq('status', 'published').eq('locale', locale)
    return q ? base.or(`title.ilike.${ilikeValue(q)},excerpt.ilike.${ilikeValue(q)}`) : base
  }
  const n = await count('articles', match)
  const from = (page - 1) * perPage
  const rows = await slice('articles', (f) => newestFirst(match(f)), CARD, from, perPage)
  return { articles: rows as unknown as ArticleCard[], totalPages: Math.ceil(n / perPage) }
}

export async function publishedArticle(locale: Locale, slug: string) {
  const row = await one('articles', (q) => q.eq('slug', slug).eq('locale', locale).eq('status', 'published'))
  return row as import('./schema').ArticlesRow | undefined
}
