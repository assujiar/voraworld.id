import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { InsightCards } from '@/components/site/InsightCards'
import { RouteBackdrop } from '@/components/site/RouteBackdrop'
import { ServiceCards } from '@/components/site/ServiceCards'
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
  const locale = await localeOf(params)
  const t = makeT(locale)
  const text = siteText[locale]
  const [articles, custom] = await Promise.all([latestArticles(locale, 3), getPublishedPage('home', locale)])
  const lines = text.home_title.replace(/\.$/, '').split(locale === 'en' ? /(?<=Bringing the) |(?<=World Within) / : /(?<=Membawa Dunia) /)
  const documents: Array<[string, string]> = [
    [t('Quotation', 'Quotation'), t('You review the terms and send it back signed. VORA checks the signature and the stamp before any work or billing relies on it.', 'Anda meninjau ketentuannya dan mengirimkannya kembali bertanda tangan. VORA memeriksa tanda tangan dan capnya sebelum pekerjaan atau penagihan bersandar padanya.')],
    [t('Delivery note', 'Surat jalan'), t('The driver records the handover on their phone: the receiver\'s name and signature, photos of the goods and the place.', 'Pengemudi mencatat serah terima di ponselnya: nama dan tanda tangan penerima, foto barang, dan lokasinya.')],
    [t('Invoice and pre-payment receipt', 'Invoice dan pre-payment receipt'), t('Sent together in one email, tied to the quotation and to the delivery notes the invoice bills.', 'Dikirim bersamaan dalam satu email, terkait dengan quotation dan surat jalan yang ditagih invoice.')],
    [t('Payment receipt', 'Kuitansi pembayaran'), t('Issued only after VORA has confirmed that the funds arrived.', 'Diterbitkan hanya setelah VORA memastikan dana sudah diterima.')],
  ]
  return (
    <>
      <section className="v-hero">
        <div className="v-wrap v-hero__grid">
          <div>
            <h1 className="v-h1">{lines.map((l, i) => <span className="v-line" key={i}><span style={{ ['--i' as string]: i }}>{l}{i === lines.length - 1 ? '.' : ''}</span></span>)}</h1>
            <p className="v-lead v-fade" style={{ ['--d' as string]: '.55s' }}>{text.home_intro}</p>
            <div className="v-actions v-fade" style={{ ['--d' as string]: '.7s' }}>
              <a className="v-btn" href={`/${locale}/request-quote`}>{text.rfq}</a>
              <a className="v-link" href={`/${locale}/services`}>{t('See the services', 'Lihat layanan')}</a>
            </div>
          </div>
          <div className="v-hero__art">
            <RouteBackdrop />
            <img className="v-hero__render" src="/static/assets/vora-visual-59.webp" width={1050} height={1050} fetchPriority="high" alt={t('A globe with routes, an aircraft, a container ship and a truck', 'Globe dengan rute, pesawat, kapal kontainer, dan truk')} />
          </div>
        </div>
      </section>

      <section className="v-section" id="services">
        <div className="v-wrap">
          <div className="v-head">
            <h2 className="v-h2">{text.home_service}</h2>
            <p className="v-muted">{t('Five services, each with its own scope. Ask for one, or for several on the same shipment.', 'Lima layanan, masing-masing dengan cakupannya sendiri. Minta satu, atau beberapa untuk pengiriman yang sama.')}</p>
          </div>
          <ServiceCards locale={locale} variant="tiles" />
        </div>
      </section>

      <section className="v-section v-section--bone">
        <div className="v-wrap v-chain">
          <div className="v-chain__art"><img loading="lazy" src="/static/assets/vora-visual-60.webp" width={420} height={400} alt={t('A document with a shield and a check mark', 'Dokumen dengan perisai dan tanda centang')} /></div>
          <div>
            <h2 className="v-h2">{t('Each step leaves a document you can check.', 'Setiap tahap meninggalkan dokumen yang bisa diperiksa.')}</h2>
            <p className="v-muted" style={{ marginTop: 18, marginBottom: 34 }}>{t('Every document carries a QR code. Scanning it shows the document\'s number, issuer, date and current status, and nothing about your amounts or details.', 'Setiap dokumen memuat kode QR. Memindainya menampilkan nomor, penerbit, tanggal, dan status dokumen saat ini, tanpa jumlah atau data Anda.')}</p>
            <ol className="v-steps">
              {documents.map(([title, body]) => <li key={title}><h3 className="v-h3">{title}</h3><p>{body}</p></li>)}
            </ol>
          </div>
        </div>
      </section>

      <section className="v-dark v-statement">
        <div className="v-wrap">
          <p className="v-quote">{t('Every shipment has its own set of constraints. The right solution starts by understanding them.', 'Setiap pengiriman punya kebutuhan berbeda. Solusi yang tepat dimulai dengan memahami detailnya.')}</p>
          <a className="v-btn v-btn--light" href={`/${locale}/contact`}>{text.cta}</a>
        </div>
      </section>

      <section className="v-section">
        <div className="v-wrap">
          <div className="v-head">
            <h2 className="v-h2">{text.insights_title}</h2>
            <p><a className="v-link" href={`/${locale}/insights`}>{t('All articles', 'Semua artikel')}</a></p>
          </div>
          <InsightCards locale={locale} articles={articles} />
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
