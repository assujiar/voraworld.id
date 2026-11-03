import { pageDescriptions } from '@/content/page-seo'
import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { ServiceTools } from '@/components/site/ServiceTools'
import { ServiceCards } from '@/components/site/ServiceCards'
import { makeT, seoDescription, seoTitles, serviceGroups, serviceModes } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/services', title: seoTitles[locale].services, description: pageDescriptions[locale].services })
}

export default async function Services({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const custom = await getPublishedPage('services', locale)
  const modes = Object.entries(serviceGroups).flatMap(([slug, g]) => g.modes.map((m) => ({ slug, mode: m, group: g[locale].name, copy: serviceModes[slug][m][locale] })))
  return (
    <>
      <section className="a-cover a-cover--services"><div className="v-wrap a-cover__grid"><div><p className="a-label">SERVICES / VORA</p><h1>{t('Build the service around the shipment.', 'Susun layanan sesuai kebutuhan shipment.')}</h1><p className="a-intro">{t('Five service groups. Different transport, handling and documentation decisions. Begin with the cargo, then choose the scope.', 'Lima kelompok layanan, dengan kebutuhan angkutan, handling, dan dokumentasi yang berbeda. Mulai dari barangnya, lalu tentukan cakupannya.')}</p><div className="v-actions"><a className="v-link" href="#service-help">{t('Help me choose', 'Bantu saya memilih')}</a><a className="v-link" href="#compare-services">{t('Compare services', 'Bandingkan layanan')}</a></div></div><div className="a-cover__index" aria-hidden="true">05<span>AIR / SEA / ROAD / STORAGE / PROJECT</span></div></div></section>
      <section className="v-section v-section--tight"><div className="v-wrap"><ServiceCards locale={locale} /></div></section>
      <ServiceTools locale={locale} />
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
