import { InquiryForm } from './InquiryForm'
import { makeT, siteText, type Locale } from '@/content'
import { getSettings } from '@/server/site'

export async function InquiryPage({ locale, kind, sp }: { locale: Locale; kind: 'contact' | 'quote'; sp: { sent?: string; mode?: string; error?: string } }) {
  const t = makeT(locale)
  const settings = await getSettings()
  const quote = kind === 'quote'
  return (
    <>
      <section className="v-section v-section--tight">
        <div className="v-wrap v-form">
          <div>
            <h1 className="v-h2" style={{ fontSize: 'clamp(2.2rem,4.8vw,4rem)', lineHeight: 1 }}>{quote ? t('Tell us what needs to move.', 'Ceritakan apa yang perlu dikirim.') : siteText[locale].contact_title}</h1>
            <p className="v-muted" style={{ marginTop: 20 }}>{t('We use what you send to review the inquiry and reply. Submitting this form does not confirm a shipment or a price.', 'Informasi Anda kami gunakan untuk meninjau dan menjawab permintaan. Mengirim formulir ini tidak mengonfirmasi pengiriman atau harga.')}</p>
            <address className="v-address">
              {settings.email ? <><strong>Email</strong><a className="v-link" href={`mailto:${settings.email}`}>{settings.email}</a></> : null}
              {settings.address ? <><strong>{t('Office', 'Kantor')}</strong>{settings.address}</> : null}
            </address>
            <img src={`/static/assets/${quote ? 'vora-visual-51.webp' : 'vora-visual-61.webp'}`} width={300} height={300} alt="" aria-hidden="true" style={{ marginTop: 28, maxWidth: 260, filter: 'drop-shadow(0 22px 20px rgba(16,23,32,.2))' }} />
          </div>
          <div className="v-formcard">
            {sp.sent ? <div className="alert" role="status">{t('Inquiry submitted successfully. Our team will review it.', 'Permintaan berhasil dikirim dan akan ditinjau tim kami.')}</div> : null}
            {sp.error ? <div className="alert" role="alert" id="form-error" tabIndex={-1}>{sp.error}</div> : null}
            <InquiryForm locale={locale} kind={kind} mode={sp.mode} error={sp.error} />
          </div>
        </div>
      </section>
    </>
  )
}
