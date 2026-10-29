import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { ServiceCards } from '@/components/site/ServiceCards'
import { makeT, seoDescription, seoTitles, siteText } from '@/content'
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
  return (
    <>
      <section className="page-intro services-intro">
        <div className="wrap"><div className="intro-grid">
          <div><span className="eyebrow">VORA / {t('Service portfolio', 'Portofolio layanan')}</span><h1>{t('Five disciplines. One considered approach.', 'Lima layanan. Satu pendekatan menyeluruh.')}</h1></div>
          <div className="intro-aside"><span className="intro-counter">05</span><p>{t('Explore international freight forwarding, customs brokerage, 3PL and warehousing, domestic distribution, and project cargo. Each service has a dedicated scope and inquiry path.', 'Jelajahi international freight forwarding, customs brokerage, 3PL dan warehousing, domestic distribution serta project cargo. Setiap layanan memiliki cakupan dan jalur inquiry tersendiri.')}</p></div>
        </div></div>
      </section>
      <section className="site-section section-white portfolio-section"><div className="wrap"><ServiceCards locale={locale} /></div></section>
      <section className="site-section section-paper mode-overview">
        <div className="wrap split">
          <div><span className="eyebrow">{t('Your shipment, your mode', 'Pilih moda pengiriman')}</span><h2>{t('Know the cargo. Then choose the movement.', 'Kenali kargo, tentukan pengirimannya.')}</h2></div>
          <div><p>{t('Air or ocean, full-load or consolidation, inbound or outbound: the right option depends on cost, timing and cargo requirements.', 'Udara atau laut, muatan penuh atau konsolidasi, impor atau ekspor: opsi terbaik bergantung pada biaya, waktu dan karakter barang.')}</p><a className="button" href={`/${locale}/request-quote`}>{siteText[locale].rfq} ↗</a></div>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
