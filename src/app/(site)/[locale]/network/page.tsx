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
      <section className="v-section v-section--tight">
        <div className="v-wrap">
          <h2 className="v-h2" style={{ marginBottom: 32 }}>{t('Confirmed coverage', 'Cakupan yang sudah dikonfirmasi')}</h2>
          {coverage.length ? (
            <ul className="v-regions">{coverage.map((c) => <li key={`${c.region}${c.mode}`}><strong>{c.region as string}</strong><span>{c.mode as string}</span></li>)}</ul>
          ) : <p className="v-note">{t('No region has been approved for public display yet. Send an inquiry and we will confirm your lane.', 'Belum ada wilayah yang disetujui untuk ditampilkan. Kirim permintaan dan kami akan mengonfirmasi rute Anda.')}</p>}
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
