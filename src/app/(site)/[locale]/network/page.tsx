import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { makeT, seoDescription, siteText } from '@/content'
import { many } from '@/server/data'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/network', title: `${siteText[locale].network_title} | VORA`, description: seoDescription[locale] })
}

export default async function Network({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const [coverage, custom] = await Promise.all([many('coverage', (q) => q.eq('active', true).order('id'), 'region,mode'), getPublishedPage('network', locale)])
  return (
    <>
      <section className="v-page">
        <div className="v-wrap v-page__grid">
          <div>
            <h1>{siteText[locale].network_title}</h1>
            <p className="v-lead">{siteText[locale].network_body}</p>
          </div>
          <img className="v-page__art" src="/static/assets/vora-visual-61.webp" width={440} height={440} alt={t('A map with a route between two pins', 'Peta dengan rute di antara dua pin')} />
        </div>
      </section>
      {coverage.length ? (
        <section className="v-section v-section--tight">
          <div className="v-wrap">
            <h2 className="v-h2" style={{ marginBottom: 32 }}>{t('Confirmed coverage', 'Cakupan yang sudah dikonfirmasi')}</h2>
            <ul className="v-regions">{coverage.map((c) => <li key={`${c.region}${c.mode}`}><strong>{c.region as string}</strong><span>{c.mode as string}</span></li>)}</ul>
          </div>
        </section>
      ) : null}
      <section className="v-section v-section--tight" aria-labelledby="lane-h">
        <div className="v-wrap v-lane">
          <div>
            <h2 className="v-h2--section" id="lane-h">{t('How a lane is confirmed', 'Cara rute dikonfirmasi')}</h2>
            <p className="v-muted">{coverage.length
              ? t('Listed regions are the ones approved for display. Any other lane is assessed when you send it.', 'Wilayah di atas adalah yang disetujui untuk ditampilkan. Rute lain dinilai saat Anda mengirimkannya.')
              : t('Share the origin, destination and cargo details. We will confirm the available arrangement for your inquiry.', 'Sampaikan asal, tujuan, dan detail barang. Kami akan mengonfirmasi pilihan layanan untuk kebutuhan pengiriman Anda.')}</p>
          </div>
          <ol className="v-laneflow">
            <li><h3>{t('You send', 'Anda kirim')}</h3><p>{t('Origin and destination at city or port level, the goods, the packing and the date the cargo is ready.', 'Asal dan tujuan sampai tingkat kota atau pelabuhan, barang, kemasan, dan tanggal barang siap.')}</p></li>
            <li><h3>{t('We check', 'Kami periksa')}</h3><p>{t('Which mode and handover points suit that cargo, what the route requires in documents, and what we cannot confirm yet.', 'Moda dan titik serah terima yang cocok untuk barang itu, dokumen yang dibutuhkan rute tersebut, dan hal yang belum bisa kami pastikan.')}</p></li>
            <li><h3>{t('You receive', 'Anda terima')}</h3><p>{t('A quotation that states the scope and its validity, or a plain answer that the lane needs another arrangement.', 'Penawaran yang menyatakan cakupan dan masa berlakunya, atau jawaban terus terang bahwa rute itu perlu pengaturan lain.')}</p></li>
          </ol>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
