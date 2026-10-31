import { Commitments } from '@/components/about/Commitments'
import { Constellation } from '@/components/about/Constellation'
import { Founder } from '@/components/about/Founder'
import { Reveal } from '@/components/about/Reveal'
import { HeroStage } from '@/components/about/HeroStage'
import { MarkField } from '@/components/about/MarkField'
import { RoutesStory } from '@/components/about/RoutesStory'
import { VerifyDemo } from '@/components/about/VerifyDemo'
import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { ABOUT, CAPABILITIES, COMMITMENTS, FOUNDER, MEMORY, TRUST, pick } from '@/content/about'
import { makeT, seoDescription, seoTitles, serviceGroups, siteText } from '@/content'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage, getSettings } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/about', title: seoTitles[locale].about, description: seoDescription[locale] })
}

/**
 * About: the brand told through motion. Seven Remotion compositions (see src/motion/about.tsx), each answering the visitor in its own way: the logo follows the pointer, the
 * statement and the routes follow the scroll, the founder's four problems close one by one, five services light up on choice, the three steps build the A, a document is scanned,
 * and a field of marks answers a touch. All the words are real text on the page (the motion is decoration), and nothing here claims more than the rest of the site does.
 */
export default async function About({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const text = siteText[locale]
  const [settings, custom] = await Promise.all([getSettings(), getPublishedPage('about', locale)])
  const facts: Array<[string, string]> = [
    [t('Company', 'Perusahaan'), settings.legal_name || 'PT Satu Arah International'],
    ...(settings.address ? [[t('Office', 'Kantor'), settings.address] as [string, string]] : []),
    ...(settings.email ? [[t('Email', 'Email'), settings.email] as [string, string]] : []),
  ]
  const services = Object.entries(serviceGroups).map(([key, g]) => ({ key, name: g[locale].name, strap: g[locale].strap, intro: g[locale].intro, href: `/${locale}/services/${key}` }))
  const items = FOUNDER.items.map((i) => ({ title: pick(i.title, locale), problem: pick(i.problem, locale), answer: pick(i.answer, locale) }))
  return (
    <>
      <link rel="stylesheet" href="/static/css/about.css?v=4" precedence="default" />
      <HeroStage hint={pick(ABOUT.hint.hero, locale)} hintTouch={pick(ABOUT.hint.hintTouch, locale)}>
        <div className="ab-wrap ab-hero__copy">
          <p className="ab-eyebrow">{pick(ABOUT.eyebrow, locale)}</p>
          <h1 className="ab-hero__title">{text.about_title}</h1>
          <p className="ab-lead">{text.about_body}</p>
          <p className="ab-actions">
            <a className="ab-btn ab-btn--solid" href={`/${locale}/request-quote`}>{pick(ABOUT.cta.quote, locale)}</a>
            <a className="ab-btn ab-btn--ghost" href="#verify">{pick(ABOUT.cta.verify, locale)}</a>
          </p>
        </div>
      </HeroStage>

      <RoutesStory label={pick(ABOUT.manifesto.label, locale)} text={pick(ABOUT.manifesto.words, locale)} />

      <section className="ab-section ab-founder" id="founder">
        <div className="ab-wrap">
          <Reveal>
            <p className="ab-eyebrow">{pick(FOUNDER.label, locale)}</p>
            <h2 className="ab-h">{pick(FOUNDER.title, locale)}</h2>
            <div className="ab-founder__intro">
              <p className="ab-lead">{pick(FOUNDER.lead, locale)}</p>
              <p>{pick(FOUNDER.body, locale)}</p>
            </div>
            <p className="ab-choose">{pick(FOUNDER.choose, locale)}</p>
          </Reveal>
          <Founder items={items} labels={{ problem: pick(FOUNDER.problemLabel, locale), answer: pick(FOUNDER.answerLabel, locale), open: pick(FOUNDER.open, locale), closed: pick(FOUNDER.closed, locale) }} />
          <p className="ab-after">{pick(FOUNDER.after, locale)}</p>
          <p className="ab-byline">{pick(FOUNDER.byline, locale)}</p>
        </div>
      </section>

      <section className="ab-section ab-dark ab-capabilities">
        <div className="ab-wrap">
          <Reveal>
            <p className="ab-eyebrow">{pick(CAPABILITIES.label, locale)}</p>
            <h2 className="ab-h">{pick(CAPABILITIES.title, locale)}</h2>
            <p className="ab-lead">{pick(CAPABILITIES.body, locale)}</p>
          </Reveal>
          <Constellation services={services} more={pick(CAPABILITIES.more, locale)} />
        </div>
      </section>

      <section className="ab-section ab-how">
        <div className="ab-wrap">
          <Reveal>
            <p className="ab-eyebrow">{pick(COMMITMENTS.label, locale)}</p>
            <h2 className="ab-h">{pick(COMMITMENTS.title, locale)}</h2>
          </Reveal>
          <Commitments steps={COMMITMENTS.steps.map((s) => ({ title: pick(s.title, locale), text: pick(s.text, locale) }))} chips={COMMITMENTS.chips.map((c) => pick(c, locale))} hint={pick(COMMITMENTS.hint, locale)} />
        </div>
      </section>

      <section className="ab-section ab-trust" id="verify">
        <div className="ab-wrap ab-trust__grid">
          <Reveal>
            <p className="ab-eyebrow">{pick(TRUST.label, locale)}</p>
            <h2 className="ab-h">{pick(TRUST.title, locale)}</h2>
            <p className="ab-lead">{pick(TRUST.body, locale)}</p>
            <p>{pick(TRUST.body2, locale)}</p>
            <h3 className="ab-who">{pick(TRUST.who, locale)}</h3>
            <dl className="ab-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </Reveal>
          <VerifyDemo scan={pick(TRUST.scan, locale)} caption={pick(TRUST.caption, locale)} record={{ title: pick(TRUST.record.title, locale), rows: [[pick(TRUST.record.issuer, locale), facts[0][1]], [pick(TRUST.record.status, locale), pick(TRUST.record.issued, locale)], [pick(TRUST.record.check, locale), pick(TRUST.record.page, locale)]] }} />
        </div>
      </section>

      <MarkField>
        <p className="ab-eyebrow">VORA</p>
        <h2 className="ab-field__tagline">{MEMORY.tagline}</h2>
        <p>{pick(MEMORY.body, locale)}</p>
        <p className="ab-actions"><a className="ab-btn ab-btn--solid" href={`/${locale}/request-quote`}>{pick(ABOUT.cta.quote, locale)}</a></p>
        <p className="ab-hint" aria-hidden="true">{pick(MEMORY.hint, locale)}</p>
      </MarkField>

      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
