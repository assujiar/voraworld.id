import { CtaBand } from './CtaBand'
import { makeT, type Locale } from '@/content'
import { today } from '@/server/dates'
import type { ArticlesRow } from '@/server/schema'

/** Public article layout; shared by the live page and the admin draft preview. */
export function ArticleView({ locale, article: a }: { locale: Locale; article: ArticlesRow }) {
  const t = makeT(locale)
  const minutes = Math.max(1, Math.floor(a.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 230))
  return (
    <>
      <section className="page-intro"><div className="wrap">
        <div className="nav-trail"><a href={`/${locale}/insights`}>{t('Insights', 'Wawasan')}</a> / {a.category}</div>
        <span className="eyebrow">{a.category}</span><h1>{a.title}</h1><p>{a.excerpt}</p>
        <p className="article-meta">{a.author} · {a.publishedAt ? today(a.publishedAt) : ''} · {minutes} {t('min read', 'menit baca')}</p>
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
