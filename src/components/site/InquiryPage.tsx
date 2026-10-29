import { CtaBand } from './CtaBand'
import { InquiryForm } from './InquiryForm'
import { makeT, siteText, type Locale } from '@/content'
import { getSettings } from '@/server/site'

export async function InquiryPage({ locale, kind, sp }: { locale: Locale; kind: 'contact' | 'quote'; sp: { sent?: string; mode?: string; error?: string } }) {
  const t = makeT(locale)
  const settings = await getSettings()
  const quote = kind === 'quote'
  return (
    <>
      <section className={`page-intro page-intro--${kind}`}><div className="wrap">
        <img className="page-art" src={`/static/assets/${quote ? 'vora-visual-51.webp' : 'vora-visual-61.webp'}`} width={580} height={580} alt={t('Three-dimensional logistics route illustration', 'Ilustrasi tiga dimensi rute logistik')} />
        <span className="eyebrow">{quote ? t('Request for quotation', 'Permintaan penawaran') : t('Get in touch', 'Hubungi kami')}</span>
        <h1>{quote ? t('Tell us what needs to move.', 'Ceritakan apa yang perlu dikirim.') : siteText[locale].contact_title}</h1>
        <p>{t('Information is used to review the inquiry and respond. No shipment or price is confirmed solely by submitting this form.', 'Informasi digunakan untuk meninjau dan menanggapi permintaan Anda. Pengiriman atau harga tidak dikonfirmasi hanya dengan mengirim formulir ini.')}</p>
      </div></section>
      <section className="site-section section-white"><div className="wrap two-col">
        <div>
          <h2>{quote ? t('Shipment inquiry', 'Permintaan pengiriman') : t('Contact details', 'Detail kontak')}</h2>
          {settings.email ? <p><strong>Email</strong><br /><a href={`mailto:${settings.email}`}>{settings.email}</a></p> : null}
          {settings.address ? <p><strong>{t('Address', 'Alamat')}</strong><br />{settings.address}</p> : null}
        </div>
        <div className="form-panel">
          {sp.sent ? <div className="alert" role="status">{t('Inquiry submitted successfully. Our team will review it.', 'Permintaan berhasil dikirim dan akan ditinjau tim kami.')}</div> : null}
          {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
          <InquiryForm locale={locale} kind={kind} mode={sp.mode} />
        </div>
      </div></section>
      <CtaBand locale={locale} />
    </>
  )
}
