import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { ServiceCards } from '@/components/site/ServiceCards'
import { makeT, seoDescription, seoTitles, serviceGroups, serviceModes } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/services', title: seoTitles[locale].services, description: seoDescription[locale] })
}

export default async function Services({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const custom = await getPublishedPage('services', locale)
  const modes = Object.entries(serviceGroups).flatMap(([slug, g]) => g.modes.map((m) => ({ slug, mode: m, group: g[locale].name, copy: serviceModes[slug][m][locale] })))
  return (
    <>
      <section className="v-page">
        <div className="v-wrap v-page__grid">
          <div>
            <h1>{t('Five services, each with its own scope.', 'Lima layanan, masing-masing dengan cakupannya sendiri.')}</h1>
            <p className="v-lead">{t('International freight forwarding, customs brokerage, 3PL and warehousing, domestic distribution, and project cargo. Each has its own page, and one inquiry can cover several.', 'International freight forwarding, customs brokerage, 3PL dan pergudangan, distribusi domestik, dan project cargo. Masing-masing punya halaman sendiri, dan satu permintaan bisa mencakup beberapa.')}</p>
          </div>
          <img className="v-page__art" src="/static/assets/vora-visual-65.webp" width={440} height={440} alt={t('Three stacked shipping containers', 'Tiga kontainer pengiriman bertumpuk')} />
        </div>
      </section>
      <section className="v-section v-section--tight"><div className="v-wrap"><ServiceCards locale={locale} /></div></section>
      <section className="v-section v-section--bone">
        <div className="v-wrap">
          <div className="v-head">
            <h2 className="v-h2">{t('Choose the mode after you know the cargo.', 'Pilih moda setelah barangnya jelas.')}</h2>
            <p className="v-muted">{t('Air or ocean, full load or consolidation, inbound or outbound: the right option depends on cost, timing and what the cargo needs.', 'Udara atau laut, muatan penuh atau konsolidasi, impor atau ekspor: pilihan terbaik bergantung pada biaya, waktu, dan kebutuhan barang.')}</p>
          </div>
          <table className="v-table">
            <thead><tr><th>{t('Mode', 'Moda')}</th><th>{t('What it is for', 'Untuk apa')}</th><th>{t('Service', 'Layanan')}</th></tr></thead>
            <tbody>{modes.map((m) => (
              <tr key={`${m.slug}/${m.mode}`}><td><a className="v-link" href={`/${locale}/services/${m.slug}/${m.mode}`}>{m.copy[0]}</a></td><td><p>{m.copy[1]}</p></td><td><p>{m.group}</p></td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
