import { makeT, serviceGroups, serviceModes, siteText, type Locale } from '@/content'
import { serviceExtras } from '@/content/service-extras'
import { modeGuides } from '@/content/service-guides'
import { CustomsSpread, DomesticFit, ForwardingLedger, ProjectStudy, WarehouseSpread } from './ServiceModules'
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
  const guide = mode ? modeGuides[`${group}/${mode}`]?.[locale] : undefined
  const family = ({ 'international-freight-forwarding': 'decision', 'customs-brokerage': 'document', '3pl-warehousing': 'flow', 'domestic-distribution': 'ledger', 'project-cargo': 'study' } as Record<string, string>)[group] ?? 'decision'
  const needs = (
    <div>
      <h2 className="v-h2 v-h2--section">{extras.needsTitle}</h2>
      <ul className="v-needs">{extras.needs.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  )
  const closing = t('Tell us the route and the cargo.', 'Sampaikan rute dan barangnya.')
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <section className={`v-svc-hero v-svc-hero--${family}${sub ? ' v-svc-hero--mode' : ''}`}>
        <div className="v-wrap v-svc-hero__grid">
          <div className="v-svc-hero__copy">
            <nav className="v-crumbs" aria-label={t('Breadcrumb', 'Jejak halaman')}>
              <a href={`/${locale}/services`}>{t('Services', 'Layanan')}</a> / {sub ? <><a href={`/${locale}/services/${group}`}>{detail.name}</a> / </> : null}<span>{name}</span>
            </nav>
            <h1>{name}</h1>
            <p className="v-lead">{sub ? sub[1] : detail.strap}</p>
            <p className="v-muted v-svc-hero__intro">{sub ? sub[2] : detail.intro}</p>
            <div className="v-actions"><a className="v-btn" href={quote}>{rfq}</a><a className="v-link" href={`/${locale}/services`}>{t('All services', 'Semua layanan')}</a></div>
          </div>
          <div className="v-svc-hero__art">
            <img src={`/static/assets/${encodeURIComponent(image)}`} alt={name} width={680} height={620} fetchPriority="high" />
          </div>
        </div>
      </section>

      {g.modes.length ? (
        <div className="v-wrap"><nav className="v-modes-bar" aria-label={detail.name}>
          {g.modes.map((m) => <a key={m} href={`/${locale}/services/${group}/${m}`} aria-current={m === mode ? 'page' : undefined}>{serviceModes[group][m][locale][0]}</a>)}
        </nav></div>
      ) : null}

      {sub && guide ? (
        <>
          <section className="v-section">
            <div className="v-wrap v-guide">
              <div className="v-guide__head"><h2 className="v-h2 v-h2--section">{guide.title}</h2><p className="v-muted">{detail.proof}</p></div>
              <dl className="v-rules">{guide.points.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          </section>
          <section className="v-section v-section--bone">
            <div className="v-wrap v-two">
              <div><h2 className="v-h2 v-h2--section">{t('Have ready for a quotation', 'Siapkan untuk penawaran')}</h2><ul className="v-needs">{guide.ask.map((n) => <li key={n}>{n}</li>)}</ul></div>
              <div><h2 className="v-h2 v-h2--section">{t('What we do not assume', 'Yang tidak kami asumsikan')}</h2><p>{guide.limit}</p><a className="v-link" href={quote}>{t('Discuss the requirements', 'Diskusikan kebutuhan')}</a></div>
            </div>
          </section>
        </>
      ) : group === 'international-freight-forwarding' ? (
        <>
          <section className="v-section">
            <div className="v-wrap">
              <div className="v-head"><h2 className="v-h2">{t('Air or ocean, in or out: what changes.', 'Udara atau laut, masuk atau keluar: apa yang berbeda.')}</h2><p className="v-muted">{detail.scope}</p></div>
              <ForwardingLedger locale={locale} />
              <p className="v-small v-muted" style={{ marginTop: 18 }}>{t('Open a movement for the full list of what decides it:', 'Buka salah satu jenis pengiriman untuk daftar lengkap yang menentukannya:')} {g.modes.map((m, i) => <span key={m}>{i ? ', ' : ''}<a className="v-link" href={`/${locale}/services/${group}/${m}`}>{serviceModes[group][m][locale][0]}</a></span>)}</p>
            </div>
          </section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two"><div><h2 className="v-h2 v-h2--section">{t('How a plan is made', 'Cara rencana dibuat')}</h2><p className="v-muted" style={{ marginTop: 18 }}>{detail.process}</p></div>{needs}</div></section>
        </>
      ) : group === 'customs-brokerage' ? (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{t('Three passes over the documents.', 'Tiga tahap atas dokumen.')}</h2><p className="v-muted">{detail.scope}</p></div>
            <CustomsSpread locale={locale} />
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two">{needs}<div><h2 className="v-h2 v-h2--section">{t('How we work', 'Cara kami bekerja')}</h2><p className="v-muted" style={{ marginTop: 18 }}>{detail.process}</p></div></div></section>
        </>
      ) : group === '3pl-warehousing' ? (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{extras.flowTitle}</h2><p className="v-muted">{detail.scope}</p></div>
            <ol className="v-flow">{(extras.flow ?? []).map(([title, body]) => <li key={title}><h3 className="v-h3">{title}</h3><p>{body}</p></li>)}</ol>
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{t('From the flow to a layout.', 'Dari alur ke tata letak.')}</h2><p className="v-muted">{detail.process}</p></div>
            <WarehouseSpread locale={locale} />
          </div></section>
          <section className="v-section"><div className="v-wrap v-two">{needs}<div /></div></section>
        </>
      ) : group === 'domestic-distribution' ? (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{t('Five arrangements. Each fits a different load.', 'Lima pengaturan. Masing-masing cocok untuk muatan yang berbeda.')}</h2><p className="v-muted">{detail.scope}</p></div>
            <table className="v-table v-table--stack">
              <thead><tr><th scope="col">{t('Mode', 'Moda')}</th><th scope="col">{t('Use it when', 'Gunakan bila')}</th><th scope="col">{t('What is planned', 'Yang direncanakan')}</th></tr></thead>
              <tbody>{g.modes.map((m) => { const c = serviceModes[group][m][locale]; return <tr key={m}><th scope="row"><a className="v-link" href={`/${locale}/services/${group}/${m}`}>{c[0]}</a></th><td data-label={t('Use it when', 'Gunakan bila')}><p>{c[1]}</p></td><td data-label={t('What is planned', 'Yang direncanakan')}><p>{c[2]}</p></td></tr> })}</tbody>
            </table>
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{t('Five questions that choose the mode.', 'Lima pertanyaan yang menentukan moda.')}</h2><p className="v-muted">{detail.process}</p></div>
            <DomesticFit locale={locale} />
          </div></section>
          <section className="v-section"><div className="v-wrap v-two">{needs}<div /></div></section>
        </>
      ) : (
        <>
          <section className="v-section"><div className="v-wrap">
            <div className="v-head"><h2 className="v-h2">{t('Start with the drawings and the site.', 'Mulai dari gambar teknis dan lokasi.')}</h2><p className="v-muted">{detail.process}</p></div>
            <ProjectStudy locale={locale} />
          </div></section>
          <section className="v-section v-section--bone"><div className="v-wrap v-two">{needs}<div><h2 className="v-h2 v-h2--section">{t('Scope', 'Cakupan')}</h2><p className="v-muted" style={{ marginTop: 18 }}>{detail.scope}</p><a className="v-link" href={quote}>{t('Discuss the requirements', 'Diskusikan kebutuhan')}</a></div></div></section>
        </>
      )}

      {sub ? (
        <div className="v-wrap"><p className="v-small v-muted v-siblings">{t('Other movements:', 'Pengiriman lainnya:')} {g.modes.filter((m) => m !== mode).map((m, i) => <span key={m}>{i ? ' · ' : ' '}<a className="v-link" href={`/${locale}/services/${group}/${m}`}>{serviceModes[group][m][locale][0]}</a></span>)}</p></div>
      ) : null}

      <section className="v-dark v-statement v-statement--compact">
        <div className="v-wrap v-two" style={{ alignItems: 'center' }}>
          <h2 className="v-h2">{closing}</h2>
          <div><p style={{ marginBottom: 22 }}>{detail.audience}</p><a href={quote} className="v-btn v-btn--light">{rfq}</a></div>
        </div>
      </section>
    </>
  )
}
