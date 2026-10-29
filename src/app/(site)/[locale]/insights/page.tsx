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
      <section className="page-intro page-intro--insights"><div className="wrap">
        <img className="page-art" src="/static/assets/vora-visual-54.webp" width={580} height={580} alt={t('3D freight route and logistics dashboard illustration', 'Ilustrasi 3D rute pengiriman dan dasbor logistik')} />
        <span className="eyebrow">{t('Insights', 'Wawasan')}</span><h1>{siteText[locale].insights_title}</h1>
        <p>{t('Articles and updates, published and maintained by the VORA team.', 'Artikel dan pembaruan yang diterbitkan dan dikelola oleh tim VORA.')}</p>
        <form method="get">
          <input name="q" aria-label={t('Search insights', 'Cari wawasan')} placeholder={t('Search articles', 'Cari artikel')} defaultValue={q} style={{ padding: 11, border: '1px solid #cfd6d8' }} />
          <button className="button">{t('Search', 'Cari')}</button>
        </form>
      </div></section>
      <section className="site-section section-white"><div className="wrap">
        <InsightCards locale={locale} articles={articles} />
        {totalPages > 1 ? <div className="actions">{Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <a key={n} className="button-outline" href={`?page=${n}&q=${encodeURIComponent(q)}`}>{n}</a>)}</div> : null}
      </div></section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
