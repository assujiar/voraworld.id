import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { InsightCards } from '@/components/site/InsightCards'
import { makeT, seoTitles, seoDescription, siteText } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { searchArticles } from '@/server/articles'
import { getPublishedPage } from '@/server/site'

type P = LocaleParams & { searchParams: Promise<{ q?: string; page?: string }> }

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/insights', title: seoTitles[locale].insights, description: seoDescription[locale] })
}

export default async function Insights({ params, searchParams }: P) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 100)
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.page ?? '1', 10) || 1))
  const [{ articles, totalPages }, custom] = await Promise.all([searchArticles(locale, q, page), getPublishedPage('insights', locale)])
  return (
    <>
      <section className="v-page">
        <div className="v-wrap v-page__grid">
          <div>
            <h1>{siteText[locale].insights_title}</h1>
            <p className="v-lead">{t('Articles and updates, published and maintained by the VORA team.', 'Artikel dan pembaruan yang diterbitkan dan dikelola oleh tim VORA.')}</p>
            <form method="get" className="v-search">
              <input name="q" aria-label={t('Search articles', 'Cari artikel')} placeholder={t('Search articles', 'Cari artikel')} defaultValue={q} />
              <button className="v-btn">{t('Search', 'Cari')}</button>
            </form>
          </div>
          <img className="v-page__art" src="/static/assets/vora-visual-54.webp" width={440} height={366} alt={t('A tracking dashboard with a map and charts', 'Dasbor pelacakan dengan peta dan grafik')} />
        </div>
      </section>
      <section className="v-section v-section--tight"><div className="v-wrap">
        <InsightCards locale={locale} articles={articles} />
        {totalPages > 1 ? <nav className="v-pages" aria-label={t('Pages', 'Halaman')}>{Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <a key={n} aria-current={n === page ? 'page' : undefined} href={`?page=${n}&q=${encodeURIComponent(q)}`}>{n}</a>)}</nav> : null}
      </div></section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
