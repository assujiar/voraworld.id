import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/site/ArticleView'
import { localeOf } from '@/lib/page'
import { sql } from '@/server/db'
import { requirePageUser } from '@/server/page-auth'
import type { ArticlesRow } from '@/server/schema'

export const metadata = { title: { absolute: 'Preview | VORA' }, robots: { index: false, follow: false } }

/** Draft preview: the real public layout, visible to signed-in admins only, never indexed. */
export default async function PreviewArticle({ params }: { params: Promise<{ locale: string; id: string }> }) {
  await requirePageUser()
  const { id } = await params
  const locale = await localeOf(params)
  const [a] = await sql`select * from articles where id = ${Number(id) || 0}`
  if (!a) notFound()
  return <ArticleView locale={locale} article={a as ArticlesRow} />
}
