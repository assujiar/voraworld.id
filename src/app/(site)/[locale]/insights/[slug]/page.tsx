import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/site/ArticleView'
import { isLocale } from '@/content'
import { pageMetadata } from '@/lib/metadata'
import { publishedArticle } from '@/server/articles'

type P = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: P) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const a = await publishedArticle(locale, slug)
  if (!a) return {}
  return pageMetadata({ locale, path: `/insights/${slug}`, title: a.seoTitle || `${a.title} | VORA`, description: a.seoDescription || a.excerpt, type: 'article' })
}

export default async function Article({ params }: P) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const a = await publishedArticle(locale, slug)
  if (!a) notFound()
  return <ArticleView locale={locale} article={a} />
}
