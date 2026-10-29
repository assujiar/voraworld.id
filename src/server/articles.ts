import { sql } from './db'
import type { Locale } from '@/content'
import type { ArticleCard } from '@/components/site/InsightCards'

export async function latestArticles(locale: Locale, limit: number): Promise<ArticleCard[]> {
  const rows = await sql`select slug, title, excerpt, category, published_at from articles where status = 'published' and locale = ${locale} order by published_at desc nulls last, id desc limit ${limit}`
  return rows as unknown as ArticleCard[]
}

export async function searchArticles(locale: Locale, q: string, page: number, perPage = 12) {
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const where = q ? sql`and (title ilike ${like} or excerpt ilike ${like})` : sql``
  const [{ n }] = await sql`select count(*)::int as n from articles where status = 'published' and locale = ${locale} ${where}`
  const rows = await sql`select slug, title, excerpt, category, published_at from articles where status = 'published' and locale = ${locale} ${where}
                         order by published_at desc nulls last, id desc limit ${perPage} offset ${(page - 1) * perPage}`
  return { articles: rows as unknown as ArticleCard[], totalPages: Math.ceil(n / perPage) }
}

export async function publishedArticle(locale: Locale, slug: string) {
  const [row] = await sql`select * from articles where slug = ${slug} and locale = ${locale} and status = 'published'`
  return row as import('./schema').ArticlesRow | undefined
}
