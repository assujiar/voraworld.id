import Image from 'next/image'
import { AgentExamples } from '@/components/site/AgentExamples'
import { AGENT_DOCK_ID, voraAgentPage } from '@/content/vora-agent-page'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const c = voraAgentPage[locale]
  return pageMetadata({ locale, path: '/vora-agent', title: c.title, description: c.description })
}

/**
 * The site-wide chat (components/site/VoraAgent) docks into #vora-agent-dock on this page; minimizing it floats it over the rest of the site with the same conversation.
 * On a desktop the page fits one screen (info, agent figure, chat side by side) so scrolling happens inside the chat; the details sit in accordions.
 */
export default async function VoraAgentPage({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const c = voraAgentPage[locale]
  return (
    <section className="vora-agent-page">
      <div className="v-wrap vora-agent-page__grid">
        <div className="vora-agent-page__first">
          <div className="vora-agent-page__head">
            <p className="a-label">{c.label}</p>
            <h1>{c.h1}</h1>
            <p className="a-intro">{c.intro}</p>
          </div>
          <div id={AGENT_DOCK_ID} className="vora-agent-dock">
            <p className="vora-agent-dock__fallback">{c.fallback} <a className="v-link" href={`/${locale}/request-quote`}>{c.rfq}</a></p>
          </div>
        </div>
        <div className="vora-agent-page__info">
          <details className="vora-agent-acc">
            <summary>{c.examplesTitle}</summary>
            <div className="vora-agent-acc__body"><p className="vora-agent-page__hint">{c.examplesHint}</p><AgentExamples examples={c.examples} /></div>
          </details>
          <details className="vora-agent-acc">
            <summary>{c.keepTitle}</summary>
            <div className="vora-agent-acc__body"><p>{c.keep}</p></div>
          </details>
          <details className="vora-agent-acc">
            <summary>{c.limitsTitle}</summary>
            <div className="vora-agent-acc__body">{c.limits.map((p) => <p key={p}>{p}</p>)}</div>
          </details>
          <details className="vora-agent-acc">
            <summary>{c.teamTitle}</summary>
            <div className="vora-agent-acc__body"><p>{c.team}</p><a className="v-link" href={`/${locale}/request-quote`}>{c.rfq}</a></div>
          </details>
        </div>
        <figure className="vora-agent-page__figure">
          <Image src="/static/assets/vora-agent-figure.webp" alt={c.figureAlt} width={870} height={1239} sizes="(min-width: 1200px) 22vw, 1px" />
        </figure>
      </div>
    </section>
  )
}
