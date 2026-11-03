import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { ServiceCards } from '@/components/site/ServiceCards'
import { BrandMotion } from '@/components/atelier/BrandMotion'
import { ProcessRail } from '@/components/atelier/ProcessRail'
import { makeT, seoTitles } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage, getSettings } from '@/server/site'
export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/about', title: seoTitles[locale].about, description: locale === 'en' ? 'Meet VORA, the logistics brand of PT Satu Arah International. Learn how cargo requirements, commercial scope and handovers shape our approach.' : 'Kenali VORA, brand logistik PT Satu Arah International. Kebutuhan kargo, cakupan komersial, dan serah terima menjadi dasar cara kerja kami.' })
}
export default async function About({ params }: LocaleParams) {
  const locale = await localeOf(params), t = makeT(locale)
  const [settings, custom] = await Promise.all([getSettings(), getPublishedPage('about', locale)])
  const facts = [[t('Legal entity', 'Badan usaha'), settings.legal_name || 'PT Satu Arah International'], ['Email', settings.email], [t('Office', 'Kantor'), settings.address]].filter(([,v]) => Boolean(v))
  const steps: Array<[string, string]> = locale === 'en' ? [
    ['Ask for the details that change the plan', 'Commodity, packed dimensions, handling restrictions, trade terms and site access.'],
    ['Write down the responsibilities', 'Specify scope, assumptions, costs and the points where cargo changes hands.'],
    ['Keep the record with the work', 'Connect quotations, delivery evidence and commercial documents to the shipment.'],
  ] : [
    ['Tanyakan detail yang menentukan rencana', 'Komoditas, dimensi kemasan, batasan handling, trade terms, serta akses lokasi.'],
    ['Perjelas pembagian tanggung jawab', 'Tuliskan cakupan, asumsi, biaya, dan titik perpindahan barang.'],
    ['Simpan catatan bersama pekerjaannya', 'Hubungkan quotation, bukti delivery, dan dokumen komersial dengan shipment.'],
  ]
  return <>
    <section className="a-about"><div className="v-wrap">
      <div className="a-about__cover"><div><p className="a-label">ABOUT / VORA</p><h1>{t('A clear direction for complex movements.', 'Arah yang jelas untuk pengiriman yang kompleks.')}</h1><p className="a-intro">{t('VORA is the logistics brand of PT Satu Arah International. We bring cargo requirements, transport choices and commercial responsibilities into one practical conversation.', 'VORA adalah brand logistik PT Satu Arah International. Kami membahas kebutuhan barang, pilihan angkutan, dan tanggung jawab komersial sebagai satu rencana kerja.')}</p><a className="v-link" href={`/${locale}/contact`}>{t('Start a conversation', 'Mulai pembahasan')}</a></div><div className="a-about__mark"><BrandMotion study="origin" mark loop label="VORA A" /></div></div>
      <div className="a-about__principle"><div><p className="a-label">01 / {t('Our approach', 'Pendekatan kami')}</p><h2>{t('Cargo is physical. The details should be concrete.', 'Barangnya nyata. Rencananya harus konkret.')}</h2></div><p>{t('A route on paper becomes a sequence of real handovers. The loading bay, terminal, documentation desk and receiving site each have their own constraints. Our approach starts with those details, then connects the service scope around them.', 'Rute di atas kertas akan dijalankan lewat serangkaian handover di lapangan. Area loading, terminal, meja dokumentasi, dan lokasi penerimaan punya batasan masing-masing. Detail inilah yang menjadi dasar penyusunan cakupan layanan.')}</p></div>
    </div></section>
    <section className="a-brief"><div className="v-wrap a-brief__grid"><div><p className="a-label">02 / {t('Working principles', 'Prinsip kerja')}</p><h2>{t('Useful questions. Explicit responsibilities.', 'Pertanyaan yang tepat. Tanggung jawab yang jelas.')}</h2><p className="a-intro" style={{marginTop:24}}>{t('Operational experience informs the questions we ask. Every proposal still has to fit the actual cargo, route and provider capability.', 'Pengalaman operasional membentuk pertanyaan yang kami ajukan. Setiap proposal tetap perlu sesuai dengan barang, rute, dan kapabilitas pelaksana.')}</p></div><ProcessRail locale={locale} steps={steps} accent="flow-ribbon" /></div></section>
    <section className="v-section"><div className="v-wrap"><div className="a-section-head"><div><p className="a-label">03 / {t('What we coordinate', 'Cakupan layanan')}</p><h2>{t('One shipment can need several kinds of expertise.', 'Satu shipment bisa membutuhkan beberapa layanan.')}</h2></div><p>{t('International freight, customs, warehousing, domestic distribution and project cargo. Choose the stages that belong in your brief.', 'International freight, customs, pergudangan, distribusi domestik, serta project cargo. Pilih tahapan yang memang dibutuhkan.')}</p></div><ServiceCards locale={locale} context="about" /></div></section>
    <section className="a-about"><div className="v-wrap a-about__facts"><div><p className="a-label">04 / {t('Company details', 'Identitas perusahaan')}</p><h2>{t('Know who you are working with.', 'Kenali pihak yang menangani kebutuhan Anda.')}</h2></div><dl>{facts.map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{k === 'Email' ? <a className="v-link" href={`mailto:${v}`}>{v}</a> : v}</dd></div>)}</dl></div></section>
    <CustomSections locale={locale} sections={custom?.sections} /><CtaBand locale={locale} />
  </>
}
