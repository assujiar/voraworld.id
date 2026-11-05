import { RouteBackdrop } from '@/components/site/RouteBackdrop'
import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { InsightCards } from '@/components/site/InsightCards'
import { ServiceCards } from '@/components/site/ServiceCards'
import { IllustrationFigure } from '@/components/atelier/IllustrationFigure'
import { ObjectArt } from '@/components/atelier/ObjectArt'
import { Arrival } from '@/components/atelier/Arrival'
import { ProcessRail } from '@/components/atelier/ProcessRail'
import { makeT, seoDescription, seoTitles, siteText } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { latestArticles } from '@/server/articles'
import { getPublishedPage } from '@/server/site'
export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/', title: seoTitles[locale].home, description: seoDescription[locale] })
}
export default async function Home({ params }: LocaleParams) {
  const locale = await localeOf(params), t = makeT(locale)
  const [articles, custom] = await Promise.all([latestArticles(locale, 3), getPublishedPage('home', locale)])
  const phases: Array<[string, string]> = locale === 'en' ? [
    ['Understand the cargo', 'Commodity, dimensions, handling and delivery requirements set the brief.'],
    ['Define the movement', 'Match routing and capacity to the cargo. Put the responsibilities and cost basis in writing.'],
    ['Connect the handovers', 'Coordinate pickup, transport, documents and receiving around the agreed milestones.'],
  ] : [
    ['Kenali kebutuhan barang', 'Jenis barang, ukuran, handling, dan kebutuhan tiba menjadi dasar pembahasan.'],
    ['Susun rencana pengiriman', 'Cocokkan rute dan kapasitas. Perjelas tanggung jawab serta dasar biaya dalam penawaran.'],
    ['Hubungkan setiap handover', 'Selaraskan pickup, angkutan, dokumen, dan penerimaan sesuai milestone yang disepakati.'],
  ]
  return <>
    <section className="a-home">
      <div className="v-wrap">
        <div className="a-home__grid">
          <div className="a-home__copy"><p className="a-label">VORA <span>FREIGHT & LOGISTICS</span></p>
            <h1>{t('Freight, with every detail in place.', 'Pengiriman terencana sampai serah terima.')}</h1>
            <p className="a-intro">{t('Air, ocean and domestic freight. Customs, warehousing and project cargo. Built around your load, your route and the handovers that matter.', 'Udara, laut, dan distribusi domestik. Customs, pergudangan, serta project cargo. Direncanakan sesuai muatan, rute, dan kebutuhan serah terima Anda.')}</p>
            <div className="v-actions"><a className="v-btn v-btn--red" href={`/${locale}/request-quote`}>{siteText[locale].rfq}<span aria-hidden="true">↗</span></a><a className="v-link" href={`/${locale}/services`}>{t('Explore our services', 'Kenali layanan kami')}</a></div>
          </div>
          <Arrival signature="air" className="a-home__visual a-stage">
            <div className="a-home__relief" aria-hidden="true"><i /><i /><i /></div>
            <div className="a-home__routes" aria-hidden="true"><RouteBackdrop /></div>
            <p className="a-home__edition" aria-hidden="true">AIR / OCEAN / ROAD</p>
            <ObjectArt asset="multimodal" priority alt={t('Illustration of connected air, ocean and road freight', 'Ilustrasi angkutan udara, laut, dan darat yang saling terhubung')} />
            <div className="a-home__note" data-assembly><span className="a-label">{t('Every shipment starts here', 'Awal setiap pengiriman')}</span><p>{t('Tell us the cargo and the route. We’ll ask what the quotation depends on.', 'Ceritakan barang dan rutenya. Kami tanyakan detail yang menentukan penawaran.')}</p><a href={`/${locale}/contact`} aria-label={t('Discuss your shipment', 'Bahas pengiriman Anda')}>↗</a></div>
            <div className="a-stage__measure" aria-hidden="true"><i /><span>VORA / 01</span><i /></div>
          </Arrival>
        </div>
        <div className="a-home__foot"><span>{t('International perspective. Practical execution.', 'Perspektif internasional. Eksekusi yang terencana.')}</span><a href="#services">{t('Find the right service', 'Pilih layanan yang sesuai')} <span aria-hidden="true">↓</span></a></div>
      </div>
    </section>
    <section className="a-portfolio" id="services"><div className="v-wrap">
      <div className="a-section-head"><div><p className="a-label">01 / {t('Our capabilities', 'Layanan kami')}</p><h2>{t('Different cargo. A considered approach.', 'Beda muatan, beda cara menanganinya.')}</h2></div><p>{t('Start with one service or combine the stages your shipment needs. The scope stays explicit.', 'Pilih satu layanan atau gabungkan tahapan yang dibutuhkan shipment Anda. Cakupannya dibuat jelas sejak awal.')}</p></div>
      <ServiceCards locale={locale} variant="tiles" />
    </div></section>
    <section className="a-brief"><div className="v-wrap a-brief__grid">
      <div className="a-brief__visual"><p className="a-label">02 / {t('Before the pickup', 'Sebelum pickup')}</p><h2>{t('Good logistics starts before anything moves.', 'Pengiriman yang baik dimulai sebelum barang bergerak.')}</h2><div className="a-brief__tray"><ObjectArt asset="export-crate" /><span>PACK / PLAN / MOVE</span></div></div>
      <div><p className="a-intro">{t('A workable plan brings the commercial terms and physical cargo together. We ask about both.', 'Rencana yang bisa dijalankan mempertemukan kebutuhan komersial dengan kondisi barang di lapangan. Keduanya perlu dibahas.')}</p><ProcessRail locale={locale} steps={phases} /></div>
    </div></section>
    <section className="a-records"><div className="v-wrap"><div><p className="a-label">03 / {t('A clear record', 'Dokumentasi yang jelas')}</p><h2>{t('The terms. The handover. The record.', 'Ketentuannya jelas. Serah terimanya tercatat.')}</h2><p>{t('Review the quotation before work is confirmed. Keep delivery evidence with the shipment. Check an issued document’s current status through its verification link.', 'Tinjau quotation sebelum pekerjaan dikonfirmasi. Simpan bukti delivery bersama data pengiriman. Status dokumen yang diterbitkan bisa diperiksa melalui tautan verifikasinya.')}</p><a className="v-btn v-btn--light" href={`/${locale}/about`}>{t('How VORA works', 'Cara kerja VORA')} <span aria-hidden="true">↗</span></a></div><div className="a-records__sheet"><IllustrationFigure asset="n11-shipment-records" locale={locale} className="illustration-figure--records" sizes="(max-width: 600px) 92vw, 46vw" caption={t('Illustrative document workflow.', 'Ilustrasi alur dokumen.')} /><ol><li><strong>{t('Commercial', 'Komersial')}</strong>{t('Quotation & agreed scope', 'Quotation & cakupan kerja')}</li><li><strong>{t('Operational', 'Operasional')}</strong>{t('Delivery & handover evidence', 'Delivery & bukti serah terima')}</li><li><strong>{t('Financial', 'Keuangan')}</strong>{t('Invoice & payment record', 'Invoice & catatan pembayaran')}</li></ol></div></div></section>
    <section className="v-section"><div className="v-wrap"><div className="a-section-head"><div><p className="a-label">04 / {t('Working knowledge', 'Catatan operasional')}</p><h2>{t('Useful before you ship.', 'Baca sebelum mengirim.')}</h2></div><a className="v-link" href={`/${locale}/insights`}>{t('Read our insights', 'Baca insight kami')}</a></div><InsightCards locale={locale} articles={articles} /></div></section>
    <CustomSections locale={locale} sections={custom?.sections} /><CtaBand locale={locale} />
  </>
}
