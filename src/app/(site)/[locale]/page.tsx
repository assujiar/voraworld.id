import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { InsightCards } from '@/components/site/InsightCards'
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
  return (
    <>
      <section className="hero hero-vora">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">VORA / {text.home_eyebrow}</span>
            <h1>{text.home_title}</h1>
            <p>{text.home_intro}</p>
            <div className="actions">
              <a className="button" href={`/${locale}/request-quote`}>{text.rfq} ↗</a>
              <a className="button-outline" href={`/${locale}/services`}>{t('Explore our services', 'Jelajahi layanan')}</a>
            </div>
            <div className="hero-datum"><span>01 / 05</span><span>{t('INTERNATIONAL · DOMESTIC · SPECIAL PROJECTS', 'INTERNASIONAL · DOMESTIK · PROYEK KHUSUS')}</span></div>
            <a className="vora-scroll-cue" href="#services-overview"><span className="vora-scroll-cue__track" aria-hidden="true" />{t('Scroll to explore', 'Lihat layanan')}</a>
          </div>
          <div className="hero-art" aria-label={t('A three-dimensional composition illustrating international freight', 'Komposisi tiga dimensi yang menggambarkan pengiriman internasional')}>
            <div className="clay-stage clay-stage--hero">
              <span className="stage-relief" aria-hidden="true" /><span className="stage-relief stage-relief--inner" aria-hidden="true" />
              <span className="stage-ring" aria-hidden="true" /><span className="stage-ring stage-ring--two" aria-hidden="true" />
              <img src="/static/assets/vora-visual-59.webp" alt={t('Aircraft, cargo vessels and freight routes represented by a sculptural 3D object', 'Pesawat, kapal kargo, dan rute pengiriman dalam satu objek 3D')} width={720} height={670} fetchPriority="high" />
              <span className="float-chip float-chip--top" aria-hidden="true"><span className="chip-light" /> {t('AIR / OCEAN', 'UDARA / LAUT')}</span>
              <span className="float-chip float-chip--bottom" aria-hidden="true">{t('INTERNATIONAL', 'INTERNASIONAL')} <span className="chip-arrow">↗</span> {t('DOMESTIC', 'DOMESTIK')}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="site-section section-white portfolio-section" id="services-overview">
        <div className="wrap">
          <div className="section-head">
            <div><span className="eyebrow">01 / {t('What we do', 'Layanan kami')}</span><h2>{text.home_service}</h2></div>
            <p>{t('Five service groups cover international forwarding, customs coordination, warehousing, domestic distribution and specialised cargo.', 'Lima kelompok layanan mencakup forwarding internasional, customs, pergudangan, distribusi domestik dan kargo khusus.')}</p>
          </div>
          <ServiceCards locale={locale} />
        </div>
      </section>
      <section className="site-section section-paper">
        <div className="wrap split workflow-spotlight">
          <div className="split-figure clay-relief-figure"><span className="sculpture-cutout" aria-hidden="true" /><img loading="lazy" src="/static/assets/vora-visual-53.webp" alt={t('International logistics routing and cargo network concept', 'Konsep rute logistik internasional dan jaringan kargo')} width={640} height={640} /></div>
          <div>
            <span className="eyebrow">02 / {t('How we think', 'Cara kerja')}</span>
            <h2>{text.home_process}</h2>
            <p>{text.home_process_body}</p>
            <div className="workflow-bullets">
              <span>01 <b>{t('Define the scope', 'Tentukan kebutuhan')}</b></span>
              <span>02 <b>{t('Evaluate options', 'Evaluasi pilihan')}</b></span>
              <span>03 <b>{t('Coordinate execution', 'Koordinasi pelaksanaan')}</b></span>
            </div>
            <a className="button-outline" href={`/${locale}/about`}>{t('Our approach', 'Pendekatan kami')} ↗</a>
          </div>
        </div>
      </section>
      <section className="site-section section-ink editorial-statement">
        <div className="wrap">
          <div className="statement-side"><span className="eyebrow">03 / {t('THE VORA APPROACH', 'PENDEKATAN VORA')}</span><p className="statement-aside">FREIGHT &amp; LOGISTICS<br />PT SATU ARAH INTERNATIONAL</p></div>
          <div>
            <p className="large-quote">{t('Every shipment has its own set of constraints. The right solution starts by understanding them.', 'Setiap pengiriman punya kebutuhan berbeda. Solusi yang tepat dimulai dengan memahami detailnya.')}</p>
            <a className="button light-button" href={`/${locale}/contact`}>{text.cta} ↗</a>
          </div>
        </div>
      </section>
      <section className="site-section section-white insights-section">
        <div className="wrap">
          <div className="section-head">
            <div><span className="eyebrow">04 / {t('INSIGHTS', 'WAWASAN')}</span><h2>{text.insights_title}</h2></div>
            <a className="button-outline" href={`/${locale}/insights`}>{t('All insights', 'Semua artikel')} ↗</a>
          </div>
          <InsightCards locale={locale} articles={articles} />
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
