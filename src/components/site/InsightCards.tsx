import { makeT, type Locale } from '@/content'
import { today } from '@/server/dates'

export interface ArticleCard { slug: string; title: string | null; excerpt: string; category: string; publishedAt: Date | null }

export function InsightCards({ locale, articles }: { locale: Locale; articles: ArticleCard[] }) {
  const t = makeT(locale)
  return (
    <div className="insight-grid">
      {articles.length ? articles.map((a) => (
        <a key={a.slug} className="card insight-card" href={`/${locale}/insights/${a.slug}`}>
          <small className="eyebrow">{a.category}</small>
          <h3>{a.title}</h3>
          <p>{a.excerpt.slice(0, 170)}</p>
          <span className="article-meta">{a.publishedAt ? today(a.publishedAt) : ''} ↗</span>
        </a>
      )) : <div className="note">{t('No articles have been published yet.', 'Belum ada artikel yang dipublikasikan.')}</div>}
    </div>
  )
}
