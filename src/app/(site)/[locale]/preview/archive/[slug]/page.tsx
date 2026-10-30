import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/site/ArticleView'
import { ALL, rowFor } from '@/content/archive'
import { isLocale } from '@/content'
import { requirePageUser } from '@/server/page-auth'
import type { ArticlesRow } from '@/server/schema'

export const metadata = { title: { absolute: 'Archive draft preview | VORA' }, robots: { index: false, follow: false } }

/**
 * Review adapter for the archive drafts kept in the code base: the real article layout, read from the draft files, no database. Only for signed-in
 * admins and only while ARCHIVE_DRAFT_PREVIEW=1, so it does not exist in production unless the owner turns it on.
 */
export default async function PreviewArchive({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  if (process.env.ARCHIVE_DRAFT_PREVIEW !== '1') notFound()
  await requirePageUser()
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const draft = ALL.find((d) => d[locale].slug === slug)
  if (!draft) notFound()
  const r = rowFor(draft, locale)
  const article = { id: 0, slug: r.slug, title: r.title, excerpt: r.excerpt, body: r.body, category: r.category, tags: r.tags, locale, status: 'draft', cover: '', author: r.author, seoTitle: r.seo_title, seoDescription: r.seo_description, createdAt: new Date(0), publishedAt: null, updatedAt: new Date(0) } as ArticlesRow
  const other = locale === 'en' ? 'id' : 'en'
  return <ArticleView locale={locale} article={article} preview pair={{ slug: draft[other].slug, locale: other }} />
}
