import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/site/ArticleView'
import { isLocale } from '@/content'
import { pageMetadata } from '@/lib/metadata'
import { pairedArticle, publishedArticle, relatedArticles } from '@/server/articles'

type P = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: P) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const a = await publishedArticle(locale, slug)
  if (!a) return {}
  const pair = await pairedArticle(locale, a.tags)
  // Language alternates are declared only when the other language really has this article, at its own (possibly different) slug.
  const alternates = pair ? { [locale]: `/${locale}/insights/${slug}`, [pair.locale]: `/${pair.locale}/insights/${pair.slug}` } : undefined
  return pageMetadata({
    locale, path: `/insights/${slug}`, title: a.seoTitle || `${a.title} | VORA`, description: a.seoDescription || a.excerpt, type: 'article',
    alternates, languages: pair ? ['en', 'id'] : [locale],
  })
}

export default async function Article({ params }: P) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const a = await publishedArticle(locale, slug)
  if (!a) notFound()
  const [pair, related] = await Promise.all([pairedArticle(locale, a.tags), relatedArticles(locale, slug, a.category, a.tags)])
  return <ArticleView locale={locale} article={a} pair={pair} related={related} />
}
