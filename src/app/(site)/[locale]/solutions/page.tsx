import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { makeT, seoDescription, siteText, solutions } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/solutions', title: `${siteText[locale].solutions_title} | VORA`, description: seoDescription[locale] })
}

export default async function Solutions({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const custom = await getPublishedPage('solutions', locale)
  return (
    <>
      <section className="page-intro page-intro--solutions"><div className="wrap">
        <img className="page-art" src="/static/assets/vora-visual-62.webp" width={580} height={580} alt={t('Sculptural parcels representing cargo flows', 'Paket berbentuk patung yang melambangkan arus kargo')} />
        <span className="eyebrow">{t('Use cases', 'Contoh penerapan')}</span><h1>{siteText[locale].solutions_title}</h1>
        <p>{t('Different industries come with different cargo requirements. These examples explain approaches, not claims of contracted customers.', 'Setiap industri memiliki kebutuhan kargo yang berbeda. Contoh ini menjelaskan pendekatan, bukan klaim pelanggan berkontrak.')}</p>
      </div></section>
      <section className="site-section section-white"><div className="wrap editorial-grid">
        {solutions[locale].map(([title, detail], i) => (
          <div className="card span-6" key={title}><small className="eyebrow">{t('Use case', 'Contoh')} {i + 1}</small><h3>{title}</h3><p>{detail}</p><a href={`/${locale}/request-quote`}>{t('Explore an inquiry', 'Ajukan permintaan')} ↗</a></div>
        ))}
      </div></section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
