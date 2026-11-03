import { inquiryError } from '@/lib/inquiry-copy'
import { officeDirectionsUrl } from '@/lib/contact-links'
import { InquiryForm } from './InquiryForm'
import { makeT, type Locale } from '@/content'
import { getSettings } from '@/server/site'
import { IllustrationFigure } from '@/components/atelier/IllustrationFigure'
import { ObjectArt } from '@/components/atelier/ObjectArt'
import { ContactAction } from './ContactAction'
export async function InquiryPage({ locale, kind, sp }: { locale: Locale; kind: 'contact' | 'quote'; sp: { sent?: string; mode?: string; error?: string } }) {
  const t = makeT(locale), settings = await getSettings(), quote = kind === 'quote'
  const error = inquiryError(locale, sp.error)
  return <section className={`a-inquiry a-inquiry--${kind}`}><div className="v-wrap">
    <header className="a-inquiry__head"><div><p className="a-label">{quote ? 'SHIPMENT / RFQ' : 'CONTACT / VORA'}</p><h1>{quote ? t('The right plan starts with your cargo.', 'Rencana yang tepat dimulai dari detail barang.') : t('Let’s talk through the movement.', 'Mari bahas kebutuhan pengiriman Anda.')}</h1></div><p className="a-caption">{t('A quotation follows a scope review.', 'Penawaran disusun setelah cakupan ditinjau.')}</p></header>
    <div className="a-inquiry__grid"><aside className="a-inquiry__aside hybrid-company"><h2>{quote ? t('Give us a working brief.', 'Kirim gambaran kebutuhannya.') : t('A useful first conversation.', 'Mulai dengan informasi yang relevan.')}</h2><p>{quote ? t('Tell us the route, ready date, packaging and delivery constraints. Package dimensions and weights help us review equipment and the charging basis.', 'Ceritakan rute, ready date, kemasan, dan batasan delivery. Dimensi serta berat setiap kemasan membantu penilaian equipment dan dasar biaya.') : t('Discuss a shipment, a service requirement or a document question. Include the reference if you are following up on an existing inquiry.', 'Bahas shipment, kebutuhan layanan, atau pertanyaan dokumen. Cantumkan referensi bila menindaklanjuti inquiry yang sudah ada.')}</p>{quote ? <IllustrationFigure asset="n12-rfq-shipment-brief" locale={locale} className="illustration-figure--rfq" sizes="(max-width: 800px) 92vw, 33vw" caption={t('Illustrative shipment details.', 'Contoh data pengiriman.')} /> : <ObjectArt asset="location" />}<address className="v-address">
          {settings.email ? <div className="ux-contact-detail"><div className="ux-contact-detail__copy"><strong>Email</strong><a className="v-link" href={`mailto:${settings.email}`}>{settings.email}</a></div>
            <ContactAction href={`mailto:${settings.email}`} icon="email" label={t('Send email', 'Kirim email')} description={t('Send an email to VORA', 'Kirim email ke VORA')} />
          </div> : null}
          {settings.address ? <div className="ux-contact-detail"><div className="ux-contact-detail__copy"><strong>{t('Office', 'Kantor')}</strong><span>{settings.address}</span></div>
            <ContactAction href={officeDirectionsUrl(settings.address)} icon="directions" external label={t('Get directions', 'Lihat rute')} description={t('Get directions to VORA on Google Maps', 'Lihat rute ke VORA di Google Maps')} />
          </div> : null}
        </address><p style={{marginTop:24}}>{t('We use your details to review and answer the inquiry. Submission does not confirm a shipment, price or booking.', 'Data digunakan untuk meninjau serta menjawab permintaan. Pengiriman formulir belum mengonfirmasi shipment, harga, atau booking.')}</p></aside>
      <div className="v-formcard">{sp.sent ? <div className="alert" role="status">{quote ? t('Your inquiry has been received. The team will review the details and reply by email. If more information is needed, we will ask you before preparing the quotation.', 'Permintaan Anda sudah diterima. Tim akan meninjau detailnya dan membalas melalui email. Jika ada data yang kurang, kami akan menghubungi Anda sebelum menyusun penawaran.') : t('Your message has been received. The team will review it and reply by email. Please include your inquiry reference if you follow up.', 'Pesan Anda sudah diterima. Tim akan meninjaunya dan membalas melalui email. Saat menindaklanjuti, cantumkan referensi permintaan Anda.')}</div> : null}{error ? <div className="alert" role="alert" id="form-error" tabIndex={-1}>{error}</div> : null}<InquiryForm locale={locale} kind={kind} mode={sp.mode} error={error} /></div>
    </div>
  </div></section>
}
