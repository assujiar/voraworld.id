import { AgentExamples } from '@/components/site/AgentExamples'
import { CtaBand } from '@/components/site/CtaBand'
import { AGENT_DOCK_ID, voraAgentPage } from '@/content/vora-agent-page'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const c = voraAgentPage[locale]
  return pageMetadata({ locale, path: '/vora-agent', title: c.title, description: c.description })
}

/** The site-wide chat (components/site/VoraAgent) docks into #vora-agent-dock on this page; minimizing it floats it over the rest of the site with the same conversation. */
export default async function VoraAgentPage({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const c = voraAgentPage[locale]
  return <>
    <section className="vora-agent-page">
      <div className="v-wrap vora-agent-page__grid">
        <div className="vora-agent-page__head">
          <p className="a-label">{c.label}</p>
          <h1>{c.h1}</h1>
          <p className="a-intro">{c.intro}</p>
          <p className="vora-agent-page__keep">{c.keep}</p>
        </div>
        <div id={AGENT_DOCK_ID} className="vora-agent-dock">
          <p className="vora-agent-dock__fallback">{c.fallback} <a className="v-link" href={`/${locale}/request-quote`}>{c.rfq}</a></p>
        </div>
        <div className="vora-agent-page__examples">
          <h2>{c.examplesTitle}</h2>
          <p className="vora-agent-page__hint">{c.examplesHint}</p>
          <AgentExamples examples={c.examples} />
        </div>
      </div>
    </section>
    <section className="v-section vora-agent-page__notes">
      <div className="v-wrap vora-agent-page__notes-grid">
        <div><h2>{c.limitsTitle}</h2>{c.limits.map((p) => <p key={p}>{p}</p>)}</div>
        <div><h2>{c.teamTitle}</h2><p>{c.team}</p><a className="v-btn v-btn--red" href={`/${locale}/request-quote`}>{c.rfq}<span aria-hidden="true">↗</span></a></div>
      </div>
    </section>
    <CtaBand locale={locale} />
  </>
}
