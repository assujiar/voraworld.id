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
  return (
    <>
      <section className="subhero"><div className="wrap"><span className="eyebrow">{t('Who we are', 'Tentang kami')}</span><h1>{text.about_title}</h1><p>{text.about_body}</p></div></section>
      <section className="site-section section-white">
        <div className="wrap split">
          <div>
            <span className="eyebrow">{t('Our thinking', 'Cara berpikir kami')}</span>
            <h2>{t('Built for the details that move business.', 'Dibangun untuk detail yang menggerakkan bisnis.')}</h2>
            <p>{settings.company_description || t('VORA is built around clarity, thoughtful coordination and open conversation about shipment requirements.', 'VORA dibangun di atas kejelasan, koordinasi yang cermat, dan percakapan terbuka tentang kebutuhan pengiriman.')}</p>
            <p>{t('Our capability statements and service coverage are verified during quotation, not asserted without supporting operational data.', 'Pernyataan kapabilitas dan cakupan layanan kami diverifikasi saat penawaran, bukan diklaim tanpa dukungan data operasional.')}</p>
          </div>
          <div className="split-figure clay-relief-figure"><span className="sculpture-cutout" aria-hidden="true" /><img loading="lazy" src="/static/assets/vora-visual-53.webp" alt={t('A 3D depiction of network routing and cargo logistics', 'Ilustrasi 3D rute jaringan dan logistik kargo')} /></div>
        </div>
      </section>
      <section className="site-section section-paper">
        <div className="wrap">
          <span className="eyebrow">{t('How we engage', 'Cara kami bekerja')}</span>
          <div className="numbered">
            <div className="step"><b>01</b><h3>{t('Understand', 'Pahami')}</h3><p>{t('Identify shipment, cargo and commercial requirements.', 'Identifikasi kebutuhan pengiriman, kargo, dan komersial.')}</p></div>
            <div className="step"><b>02</b><h3>{t('Validate', 'Validasi')}</h3><p>{t('Assess applicable routing, handling and documentation options.', 'Tinjau pilihan rute, penanganan, dan dokumen yang berlaku.')}</p></div>
            <div className="step"><b>03</b><h3>{t('Coordinate', 'Koordinasikan')}</h3><p>{t('Align responsibilities, milestones and communication.', 'Selaraskan tanggung jawab, tahapan, dan komunikasi.')}</p></div>
          </div>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
