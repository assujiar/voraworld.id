import { InsightCards, type ArticleCard } from './InsightCards'
import { jsonLd } from '@/lib/metadata'
import { archiveNote, parseArchiveTags, periodLabel, readingMinutes } from '@/lib/archive'
import { articleHtml } from '@/lib/contents'
import { makeT, type Locale } from '@/content'
import { today } from '@/server/dates'
import { absoluteUrl } from '@/server/site'
import type { ArticlesRow } from '@/server/schema'

interface Props {
  locale: Locale
  article: ArticlesRow
  related?: ArticleCard[]
  /** The same article in the other language, when it is published. */
  pair?: { slug: string; locale: Locale } | null
  /** True for the admin draft preview: no structured data, no publication claims. */
  preview?: boolean
}

/** Public article layout; shared by the live page and the admin draft preview. */
export async function ArticleView({ locale, article: a, related = [], pair = null, preview = false }: Props) {
  const t = makeT(locale)
  const meta = parseArchiveTags(a.tags)
  const { html, toc } = articleHtml(a.body, t('Table, scroll sideways to read all columns', 'Tabel, geser ke samping untuk membaca semua kolom'))
  const minutes = readingMinutes(a.body)
  const ld = !preview && a.publishedAt ? {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt, inLanguage: locale,
    datePublished: a.publishedAt.toISOString(), dateModified: (a.updatedAt ?? a.publishedAt).toISOString(),
    mainEntityOfPage: absoluteUrl(`/${locale}/insights/${a.slug}`),
    author: { '@type': 'Organization', name: a.author || 'VORA Editorial' }, publisher: { '@type': 'Organization', name: 'VORA' },
    articleSection: a.category,
  } : null
  return (
    <>
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} /> : null}
      <header className="v-articlehead">
        <div className="v-wrap">
          <nav className="v-crumbs" aria-label={t('Breadcrumb', 'Jejak halaman')}><a href={`/${locale}/insights`}>{t('Insights', 'Wawasan')}</a> / {a.category}</nav>
          <h1 className="v-articlehead__title">{a.title}</h1>
          <p className="v-articlehead__stand">{a.excerpt}</p>
          <dl className="v-articlemeta">
            {meta.year && meta.quarter ? <div><dt>{t('Archive period', 'Periode arsip')}</dt><dd>{periodLabel(meta.year, meta.quarter)}</dd></div> : null}
            <div><dt>{t('Published', 'Terbit')}</dt><dd>{a.publishedAt ? <time dateTime={a.publishedAt.toISOString()}>{today(a.publishedAt)}</time> : t('Not published', 'Belum diterbitkan')}</dd></div>
            {meta.reviewed ? <div><dt>{t('Last reviewed', 'Terakhir ditinjau')}</dt><dd><time dateTime={meta.reviewed}>{meta.reviewed}</time></dd></div> : null}
            <div><dt>{t('Reading time', 'Waktu baca')}</dt><dd>{minutes} {t('min', 'menit')}</dd></div>
            {a.author ? <div><dt>{t('By', 'Oleh')}</dt><dd>{a.author}</dd></div> : null}
          </dl>
          {meta.year ? <p className="v-note v-articlehead__archive">{archiveNote[locale].body}</p> : null}
          {pair ? <p className="v-articlehead__pair"><a className="v-link" hrefLang={pair.locale} lang={pair.locale} href={`/${pair.locale}/insights/${pair.slug}`}>{pair.locale === 'id' ? 'Baca dalam bahasa Indonesia' : 'Read in English'}</a></p> : null}
        </div>
      </header>
      <div className="v-wrap v-articlegrid">
        {toc.length > 2 ? (
          <aside className="v-articletoc">
            <details open>
              <summary>{t('Contents', 'Isi artikel')}</summary>
              <ol>{toc.map((i) => <li key={i.id}><a href={`#${i.id}`}>{i.text}</a></li>)}</ol>
            </details>
          </aside>
        ) : null}
        <article className="v-articlebody">
          {/* Sanitised on the server when the article is saved. */}
          <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
      {related.length ? (
        <section className="v-section v-section--tight" aria-labelledby="related-h">
          <div className="v-wrap">
            <h2 className="v-h2--section" id="related-h">{t('Related reading', 'Bacaan terkait')}</h2>
            <InsightCards locale={locale} articles={related} />
          </div>
        </section>
      ) : null}
      <section className="v-section v-section--tight">
        <div className="v-wrap v-articlecta">
          <p>{t('Have a shipment in mind? Send the route and the cargo and we will confirm the arrangement for that inquiry.', 'Punya pengiriman yang sedang direncanakan? Kirim rute dan barangnya, kami akan mengonfirmasi pilihan layanannya.')}</p>
          <a className="v-btn" href={`/${locale}/request-quote`}>{t('Request a quote', 'Minta penawaran')}</a>
          <a className="v-link" href={`/${locale}/insights`}>{t('All articles', 'Semua artikel')}</a>
        </div>
      </section>
    </>
  )
}
