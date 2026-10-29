import { notFound } from 'next/navigation'
import { CtaBand } from '@/components/site/CtaBand'
import { isLocale, makeT } from '@/content'
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
  const t = makeT(locale)
  const a = await publishedArticle(locale, slug)
  if (!a) notFound()
  const minutes = Math.max(1, Math.floor(a.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 230))
  return (
    <>
      <section className="page-intro"><div className="wrap">
        <div className="nav-trail"><a href={`/${locale}/insights`}>{t('Insights', 'Wawasan')}</a> / {a.category}</div>
        <span className="eyebrow">{a.category}</span><h1>{a.title}</h1><p>{a.excerpt}</p>
        <p className="article-meta">{a.author} · {a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : ''} · {minutes} {t('min read', 'menit baca')}</p>
      </div></section>
      <section className="site-section section-white"><article className="wrap">
        {/* Sanitised on the server when the article is saved. */}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: a.body }} />
        <div className="actions" style={{ justifyContent: 'center' }}><a className="button-outline" href={`/${locale}/insights`}>← {t('Back to insights', 'Kembali ke wawasan')}</a></div>
      </article></section>
      <CtaBand locale={locale} />
    </>
  )
}
