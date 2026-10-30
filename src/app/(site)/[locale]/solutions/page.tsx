import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { makeT, seoDescription, siteText, solutions } from '@/content'
import { solutionGuides } from '@/content/solution-guides'
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
      <section className="v-page">
        <div className="v-wrap v-page__grid">
          <div>
            <h1>{siteText[locale].solutions_title}</h1>
            <p className="v-lead">{t('Different industries come with different cargo requirements. These examples explain approaches, not claims of contracted customers.', 'Setiap industri memiliki kebutuhan kargo yang berbeda. Contoh ini menjelaskan pendekatan, bukan klaim pelanggan berkontrak.')}</p>
          </div>
          <img className="v-page__art" src="/static/assets/vora-visual-62.webp" width={440} height={440} alt={t('Cartons stacked on a pallet', 'Karton bertumpuk di atas pallet')} />
        </div>
      </section>
      <section className="v-section v-section--tight">
        <div className="v-wrap v-bands">
          {solutions[locale].map(([title, detail], i) => {
            const g = solutionGuides[locale][i]
            return (
              <article key={title} className="v-band" aria-labelledby={`sol-${i}`}>
                <header><h2 className="v-h2--section" id={`sol-${i}`}>{title}</h2><p>{detail}</p></header>
                {g ? (
                  <div className="v-band__cols">
                    <section><h3>{t('What the work looks like', 'Seperti apa pekerjaannya')}</h3><ul>{g.traits.map((x) => <li key={x}>{x}</li>)}</ul></section>
                    <section><h3>{t('What limits the plan', 'Yang membatasi rencana')}</h3><ul>{g.limits.map((x) => <li key={x}>{x}</li>)}</ul></section>
                    <section><h3>{t('Useful to send', 'Yang berguna dikirim')}</h3><ul>{g.inputs.map((x) => <li key={x}>{x}</li>)}</ul></section>
                  </div>
                ) : null}
                <a className="v-link" href={`/${locale}/request-quote`}>{t('Send an inquiry', 'Kirim permintaan')}</a>
              </article>
            )
          })}
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
