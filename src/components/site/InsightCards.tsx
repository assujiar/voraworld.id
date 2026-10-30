import { makeT, type Locale } from '@/content'
import { today } from '@/server/dates'

export interface ArticleCard { slug: string; title: string | null; excerpt: string; category: string; publishedAt: Date | null }

/** Articles as rows of a journal: date and category on the left, title and the start of the text on the right. */
export function InsightCards({ locale, articles }: { locale: Locale; articles: ArticleCard[] }) {
  const t = makeT(locale)
  if (!articles.length) return <p className="v-note">{t('No articles have been published yet.', 'Belum ada artikel yang dipublikasikan.')}</p>
  return (
    <ul className="v-rows">
      {articles.map((a) => (
        <li key={a.slug}>
          <a href={`/${locale}/insights/${a.slug}`}>
            <div><time dateTime={a.publishedAt ? today(a.publishedAt) : undefined}>{a.publishedAt ? today(a.publishedAt) : ''}</time><div className="v-cat">{a.category}</div></div>
            <div><h3 className="v-h3">{a.title}</h3><p>{a.excerpt.slice(0, 170)}</p></div>
          </a>
        </li>
      ))}
    </ul>
  )
}
