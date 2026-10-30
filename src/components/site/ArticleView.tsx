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
      <header className="v-article" style={{ paddingTop: 'clamp(40px,6vw,88px)', paddingBottom: 'clamp(24px,3vw,40px)' }}>
        <nav className="v-crumbs"><a href={`/${locale}/insights`}>{t('Insights', 'Wawasan')}</a> / {a.category}</nav>
        <h1 className="v-h2" style={{ fontSize: 'clamp(2.1rem,4.8vw,3.8rem)', lineHeight: 1.02 }}>{a.title}</h1>
        <p className="v-lead v-muted" style={{ marginTop: 20 }}>{a.excerpt}</p>
        <p className="v-meta">{a.author} · {a.publishedAt ? today(a.publishedAt) : ''} · {minutes} {t('min read', 'menit baca')}</p>
      </header>
      <article className="v-article">
        {/* Sanitised on the server when the article is saved. */}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: a.body }} />
        <p style={{ marginTop: 40 }}><a className="v-link" href={`/${locale}/insights`}>{t('Back to the articles', 'Kembali ke artikel')}</a></p>
      </article>
      <CtaBand locale={locale} />
    </>
  )
}
