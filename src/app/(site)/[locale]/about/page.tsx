import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { makeT, seoDescription, seoTitles, siteText } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage, getSettings } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/about', title: seoTitles[locale].about, description: seoDescription[locale] })
}

export default async function About({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const text = siteText[locale]
  const [settings, custom] = await Promise.all([getSettings(), getPublishedPage('about', locale)])
  const facts: Array<[string, string]> = [
    [t('Company', 'Perusahaan'), settings.legal_name || 'PT Satu Arah International'],
    ...(settings.address ? [[t('Office', 'Kantor'), settings.address] as [string, string]] : []),
    ...(settings.email ? [[t('Email', 'Email'), settings.email] as [string, string]] : []),
  ]
  return (
    <>
      <section className="v-page">
        <div className="v-wrap v-page__grid">
          <div>
            <h1>{text.about_title}</h1>
            <p className="v-lead">{text.about_body}</p>
          </div>
          <img className="v-page__art" src="/static/assets/vora-visual-53.webp" width={440} height={366} alt={t('A globe with routes standing on a platform with cargo', 'Globe dengan rute di atas panggung berisi kargo')} />
        </div>
      </section>
      <section className="v-section v-section--tight">
        <div className="v-wrap v-two">
          <h2 className="v-h2">{t('Clear scope, named responsibilities.', 'Cakupan yang jelas, tanggung jawab yang disebut.')}</h2>
          <div>
            <p>{settings.company_description || t('VORA is built around clarity, thoughtful coordination and open conversation about shipment requirements.', 'VORA dibangun di atas kejelasan, koordinasi yang cermat, dan percakapan terbuka tentang kebutuhan pengiriman.')}</p>
            <p>{t('Our capability statements and service coverage are verified during quotation, not asserted without supporting operational data.', 'Pernyataan kapabilitas dan cakupan layanan kami diverifikasi saat penawaran, bukan diklaim tanpa dukungan data operasional.')}</p>
            <dl className="v-facts" style={{ marginTop: 28 }}>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
        </div>
      </section>
      <section className="v-section v-section--bone">
        <div className="v-wrap">
          <h2 className="v-h2" style={{ marginBottom: 36 }}>{t('How we work with you', 'Cara kami bekerja dengan Anda')}</h2>
          <ol className="v-ledger">
            <li><h3>{t('Understand', 'Pahami')}</h3><p>{t('Identify shipment, cargo and commercial requirements.', 'Identifikasi kebutuhan pengiriman, kargo, dan komersial.')}</p></li>
            <li><h3>{t('Validate', 'Validasi')}</h3><p>{t('Assess applicable routing, handling and documentation options.', 'Tinjau pilihan rute, penanganan, dan dokumen yang berlaku.')}</p></li>
            <li><h3>{t('Coordinate', 'Koordinasikan')}</h3><p>{t('Align responsibilities, milestones and communication.', 'Selaraskan tanggung jawab, tahapan, dan komunikasi.')}</p></li>
          </ol>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
