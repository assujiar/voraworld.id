import { pageDescriptions } from '@/content/page-seo'
import { IllustrationFigure } from '@/components/atelier/IllustrationFigure'
import { ObjectArt } from '@/components/atelier/ObjectArt'
import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { FoldOnPhone } from '@/components/site/FoldOnPhone'
import { makeT, seoDescription, siteText, solutions } from '@/content'
import { solutionGuides } from '@/content/solution-guides'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage } from '@/server/site'

/** Industry overview and handling detail have separate, relevant artwork. */
const ART = ['n04-manufacturing', 'n05-ecommerce-fulfillment', 'heavy-cargo', 'export-crate'] as const
const DETAIL_ART = ['loading-bay', 'pallets', 'n03-project-engineering', 'cargo-assortment'] as const

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/solutions', title: `${siteText[locale].solutions_title} | VORA`, description: pageDescriptions[locale].solutions })
}

export default async function Solutions({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const custom = await getPublishedPage('solutions', locale)
  return (
    <div className="hybrid-preserved hybrid-solutions">
      <section className="x-solutions"><div className="v-wrap"><div className="x-solutions__head"><p className="a-label">SOLUTIONS / CARGO FIRST</p><h1>{t('Different industries. Different demands.', 'Beda industri. Beda kebutuhan.')}</h1><p className="a-intro">{t('Start with your operating constraints. Build the transport, handling and documentation scope around them.', 'Mulai dari kebutuhan operasional Anda. Susun cakupan angkutan, handling, dan dokumentasi yang sesuai.')}</p></div><nav className="x-industry-plates" aria-label={t('Explore industry requirements','Kenali kebutuhan industri')}>{solutions[locale].map(([title],i)=><a key={title} href={`#industry-${i+1}`}><span className="a-label">0{i+1} / INDUSTRY</span><ObjectArt asset={ART[i]}/><strong>{title}</strong><span className="x-industry-arrow" aria-hidden="true">↓</span></a>)}</nav></div></section>
      <section className="v-section v-section--tight">
        <div className="v-wrap v-bands">
          {solutions[locale].map(([title, detail], i) => {
            const g = solutionGuides[locale][i]
            return (
              <article key={title} id={`industry-${i+1}`} className={`v-band${i === 2 ? ' v-band--engineering' : ''}`} aria-labelledby={`sol-${i}`}>
                {i === 2 ? <IllustrationFigure asset="n03-project-engineering" locale={locale} className="v-band__art illustration-figure--engineering" sizes="(max-width: 700px) 92vw, 360px" caption={t('Engineering illustration; dimensions are examples.', 'Ilustrasi perencanaan; ukuran yang ditampilkan adalah contoh.')} /> : <ObjectArt className="v-band__art" asset={DETAIL_ART[i]} sizes="120px" />}
                <header><h2 className="v-h2--section" id={`sol-${i}`}>{title}</h2><p>{detail}</p></header>
                {g ? (
                  <div className="v-band__cols">
                    {([
                      [t('What the work looks like', 'Seperti apa pekerjaannya'), g.traits],
                      [t('What limits the plan', 'Yang membatasi rencana'), g.limits],
                      [t('Useful to send', 'Yang berguna dikirim'), g.inputs],
                    ] as Array<[string, string[]]>).map(([h, items]) => (
                      <details key={h} open><summary><h3>{h}</h3></summary><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul></details>
                    ))}
                  </div>
                ) : null}
                <a className="v-link" href={`/${locale}/request-quote`}>{t('Send an inquiry', 'Kirim permintaan')}</a>
              </article>
            )
          })}
        </div>
      </section>
      <FoldOnPhone />
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </div>
  )
}
