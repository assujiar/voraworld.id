import { makeT, serviceGroups, serviceModes, siteText, type Locale } from '@/content'
import { serviceExtras } from '@/content/service-extras'
import { jsonLd } from '@/lib/metadata'
import { absoluteUrl } from '@/server/site'

/**
 * One layout per service, because the five are not the same kind of work: forwarding is a choice of lane, customs is a checklist, warehousing is a
 * flow, domestic distribution is a choice of vehicle, and project cargo starts from drawings. A page for one mode (air import, FTL...) is the same
 * hero and the scope of that mode, with the other modes one tap away.
 */
export function ServicePage({ locale, group, mode }: { locale: Locale; group: string; mode?: string }) {
  const t = makeT(locale)
  const g = serviceGroups[group]
  const detail = g[locale]
  const sub = mode ? serviceModes[group][mode][locale] : null
  const extras = serviceExtras[group][locale]
  const name = sub ? sub[0] : detail.name
  const image = sub ? sub[3] : g.image
  const quote = `/${locale}/request-quote?mode=${group}${mode ? '/' + mode : ''}`
  const rfq = siteText[locale].rfq
  const schema = { '@context': 'https://schema.org', '@type': 'Service', name, description: sub ? sub[1] : detail.intro, provider: { '@type': 'Organization', name: 'VORA' }, url: absoluteUrl(`/${locale}/services/${group}${mode ? '/' + mode : ''}`), serviceType: name }
  const needs = (
    <div>
      <h2 className="v-h2" style={{ fontSize: 'clamp(1.6rem,2.6vw,2.2rem)', marginBottom: 22 }}>{extras.needsTitle}</h2>
      <ul className="v-needs">{extras.needs.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  )
  const scope = (
    <div>
      <h2 className="v-h2">{t('Scope', 'Cakupan')}</h2>
      <p style={{ marginTop: 18 }}>{sub ? sub[2] : detail.scope}</p>
      <p className="v-muted">{detail.proof}</p>
      <a className="v-link" href={quote}>{t('Discuss the requirements', 'Diskusikan kebutuhan')}</a>
    </div>
  )
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <section className="v-svc-hero">
        <div className="v-wrap v-svc-hero__grid">
          <div className="v-svc-hero__copy">
            <nav className="v-crumbs" aria-label={t('Breadcrumb', 'Jejak halaman')}>
              <a href={`/${locale}/services`}>{t('Services', 'Layanan')}</a> / {sub ? <><a href={`/${locale}/services/${group}`}>{detail.name}</a> / </> : null}<span>{name}</span>
            </nav>
            <h1>{name}</h1>
            <p className="v-lead" style={{ marginTop: 22 }}>{sub ? sub[1] : detail.strap}</p>
            <p className="v-muted" style={{ maxWidth: '48ch' }}>{sub ? sub[2] : detail.intro}</p>
            <div className="v-actions"><a className="v-btn" href={quote}>{rfq}</a><a className="v-link" href={`/${locale}/services`}>{t('All services', 'Semua layanan')}</a></div>
          </div>
          <div className={`v-svc-hero__art${group === 'project-cargo' && !sub ? ' v-svc-hero__art--wide' : ''}`}>
            <img src={`/static/assets/${encodeURIComponent(image)}`} alt={`${name}`} width={680} height={620} fetchPriority="high" />
          </div>
        </div>
      </section>

      {g.modes.length ? (
        <div className="v-wrap"><nav className="v-modes-bar" aria-label={detail.name}>
          {g.modes.map((m) => <a key={m} href={`/${locale}/services/${group}/${m}`} aria-current={m === mode ? 'page' : undefined}>{serviceModes[group][m][locale][0]}</a>)}
        </nav></div>
      ) : null}

      {sub ? (
        <section className="v-section"><div className="v-wrap v-two">{scope}{needs}</div></section>
      ) : group === 'international-freight-forwarding' ? (
        <>
          <section className="v-section">
            <div className="v-wrap">
              <div className="v-head"><h2 className="v-h2">{t('Pick the lane: air or ocean, in or out.', 'Pilih jalurnya: udara atau laut, masuk atau keluar.')}</h2><p className="v-muted">{detail.scope}</p></div>
              <div className="v-lanes">
                {g.modes.map((m) => { const c = serviceModes[group][m][locale]; return (
                  <article key={m}><img className={m === 'air-export' ? 'is-out' : undefined} src={`/static/assets/${c[3]}`} alt="" width={150} height={150} loading="lazy" /><h3 className="v-h3">{c[0]}</h3><p>{c[1]}</p><a className="v-link" href={`/${locale}/services/${group}/${m}`}>{t('Details', 'Rincian')}</a></article>
                ) })}
              </div>
            </div>
          </section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two"><div><h2 className="v-h2">{t('How a plan is made', 'Cara rencana dibuat')}</h2><p className="v-muted" style={{ marginTop: 18 }}>{detail.process}</p></div>{needs}</div></section>
        </>
      ) : group === 'customs-brokerage' ? (
        <section className="v-section"><div className="v-wrap v-two">{scope}{needs}</div></section>
      ) : group === '3pl-warehousing' ? (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{extras.flowTitle}</h2><p className="v-muted">{detail.scope}</p></div>
            <ol className="v-flow">{(extras.flow ?? []).map(([title, body]) => <li key={title}><h3 className="v-h3">{title}</h3><p>{body}</p></li>)}</ol>
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two"><div><h2 className="v-h2">{t('Before we propose a layout', 'Sebelum kami mengusulkan tata letak')}</h2><p className="v-muted" style={{ marginTop: 18 }}>{detail.process}</p><p className="v-muted">{detail.proof}</p></div>{needs}</div></section>
        </>
      ) : group === 'domestic-distribution' ? (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{t('Five ways to move it. Each fits a different load.', 'Lima cara mengirim. Masing-masing cocok untuk muatan yang berbeda.')}</h2><p className="v-muted">{detail.scope}</p></div>
            <table className="v-table">
              <thead><tr><th>{t('Mode', 'Moda')}</th><th>{t('Use it when', 'Gunakan bila')}</th><th>{t('What is planned', 'Yang direncanakan')}</th></tr></thead>
              <tbody>{g.modes.map((m) => { const c = serviceModes[group][m][locale]; return <tr key={m}><td><a className="v-link" href={`/${locale}/services/${group}/${m}`}>{c[0]}</a></td><td><p>{c[1]}</p></td><td><p>{c[2]}</p></td></tr> })}</tbody>
            </table>
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two"><div><h2 className="v-h2">{t('How we choose', 'Cara kami memilih')}</h2><p className="v-muted" style={{ marginTop: 18 }}>{detail.process}</p><p className="v-muted">{detail.proof}</p></div>{needs}</div></section>
        </>
      ) : (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-two">{scope}{needs}</div>
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two"><h2 className="v-h2">{t('Complex cargo calls for technical planning.', 'Muatan kompleks memerlukan perencanaan teknis.')}</h2><p className="v-muted">{detail.process}</p></div></section>
        </>
      )}

      <section className="v-dark v-statement">
        <div className="v-wrap v-two" style={{ alignItems: 'end' }}>
          <h2 className="v-h2">{t('Send us the details.', 'Kirim detailnya kepada kami.')}</h2>
          <div><p style={{ marginBottom: 26 }}>{detail.audience}</p><a href={quote} className="v-btn v-btn--light">{rfq}</a></div>
        </div>
      </section>
    </>
  )
}
