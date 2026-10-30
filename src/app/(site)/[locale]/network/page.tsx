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
      <section className="page-intro page-intro--network"><div className="wrap">
        <img className="page-art" src="/static/assets/vora-visual-53.webp" width={580} height={580} alt={t('Three-dimensional cargo network illustration', 'Ilustrasi tiga dimensi jaringan kargo')} />
        <span className="eyebrow">{t('Serviceability', 'Jangkauan layanan')}</span><h1>{siteText[locale].network_title}</h1><p>{siteText[locale].network_body}</p>
      </div></section>
      <section className="site-section section-white"><div className="wrap">
        <h2>{t('Verified coverage', 'Cakupan terverifikasi')}</h2>
        {coverage.length ? (
          <div className="editorial-grid">{coverage.map((c) => (
            <div className="card span-4" key={c.region as string}><h3>{c.region as string}</h3><p>{c.mode as string}</p><small>{t('Verified coverage record', 'Catatan cakupan terverifikasi')}</small></div>
          ))}</div>
        ) : <div className="note">{t('No serviceable regions have yet been approved for public display. Submit an inquiry to confirm your lane.', 'Belum ada wilayah layanan yang disetujui untuk ditampilkan. Ajukan permintaan untuk memastikan rute Anda.')}</div>}
      </div></section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
