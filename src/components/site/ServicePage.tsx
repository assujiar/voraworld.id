import { makeT, serviceGroups, serviceModes, siteText, type Locale } from '@/content'
import { jsonLd } from '@/lib/metadata'
import { absoluteUrl } from '@/server/site'
import { CtaBand } from './CtaBand'

export function ServicePage({ locale, group, mode }: { locale: Locale; group: string; mode?: string }) {
  const t = makeT(locale)
  const g = serviceGroups[group]
  const detail = g[locale]
  const sub = mode ? serviceModes[group][mode][locale] : null
  const name = sub ? sub[0] : detail.name
  const image = sub ? sub[3] : g.image
  const quote = `/${locale}/request-quote?mode=${group}${mode ? '/' + mode : ''}`
  const schema = { '@context': 'https://schema.org', '@type': 'Service', name, description: sub ? sub[1] : detail.intro, provider: { '@type': 'Organization', name: 'VORA' }, url: absoluteUrl(`/${locale}/services/${group}${mode ? '/' + mode : ''}`), serviceType: name }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <section className={`service-detail-hero service-detail-hero--${group}`}>
        <div className="wrap service-hero-grid">
          <div className="service-detail-copy">
            <nav className="nav-trail" aria-label={t('Breadcrumb', 'Jejak halaman')}>
              <a href={`/${locale}/services`}>{t('Services', 'Layanan')}</a> <span> / </span>
              {sub ? <><a href={`/${locale}/services/${group}`}>{detail.name}</a><span> / </span></> : null}
              <span>{name}</span>
            </nav>
            <span className="eyebrow">{g.index} / 05 · {t('VORA SERVICE', 'LAYANAN VORA')}</span>
            <h1>{name}</h1>
            <p className="service-lead">{sub ? sub[1] : detail.strap}</p>
            <p className="service-supporting">{sub ? sub[2] : detail.intro}</p>
            <div className="actions"><a className="button" href={quote}>{siteText[locale].rfq} ↗</a><a className="button-outline" href={`/${locale}/services`}>{t('All services', 'Semua layanan')}</a></div>
          </div>
          <div className="service-hero-art">
            <div className="service-art-pedestal" /><span className="service-art-rim" aria-hidden="true" />
            <span className="service-art-marker" aria-hidden="true">VORA / {g.index}</span>
            <img src={`/static/assets/${encodeURIComponent(image)}`} alt={`${name} ${t('cargo handling illustration', 'ilustrasi penanganan kargo')}`} width={680} height={620} />
          </div>
        </div>
      </section>
      {g.modes.length ? (
        <section className="mode-navigation"><div className="wrap">
          <p className="mode-kicker">{t('Explore', 'Jelajahi')} {detail.name}</p>
          <div className="mode-tabs">
            {g.modes.map((m, i) => (
              <a key={m} className={`mode-tab ${m === mode ? 'is-current' : ''}`} href={`/${locale}/services/${group}/${m}`}><span>0{i + 1}</span>{serviceModes[group][m][locale][0]} ↗</a>
            ))}
          </div>
        </div></section>
      ) : null}
      <section className="site-section section-white service-scope">
        <div className="wrap split">
          <div><span className="eyebrow">{t('Scope & requirements', 'Cakupan dan kebutuhan')}</span><h2>{t('A clear scope before the first move.', 'Cakupan yang jelas sebelum pengiriman.')}</h2></div>
          <div className="scope-copy"><p>{sub ? sub[2] : detail.scope}</p><p>{detail.proof}</p><a className="text-link" href={quote}>{t('Discuss the requirements', 'Diskusikan kebutuhan')} ↗</a></div>
        </div>
      </section>
      <section className="site-section section-paper service-process">
        <div className="wrap">
          <div className="section-head"><div><span className="eyebrow">{t('How it works', 'Alur layanan')}</span><h2>{t('From brief to coordinated movement.', 'Dari kebutuhan hingga koordinasi pengiriman.')}</h2></div><p>{detail.process}</p></div>
          <div className="numbered">
            <div className="step"><b>01 / {t('DISCOVER', 'IDENTIFIKASI')}</b><h3>{t('Cargo & route', 'Kargo dan rute')}</h3><p>{t('Provide cargo characteristics, origin, destination, Incoterms when relevant, and requested dates.', 'Sampaikan jenis, berat dan dimensi barang, asal, tujuan, Incoterm bila relevan serta jadwal.')}</p></div>
            <div className="step"><b>02 / {t('DESIGN', 'RENCANA')}</b><h3>{t('Options & quotation', 'Opsi dan penawaran')}</h3><p>{t('Review mode, routing, documentation, operational constraints and commercial inclusions.', 'Tinjau moda, rute, dokumen, batasan operasional dan rincian biaya.')}</p></div>
            <div className="step"><b>03 / {t('COORDINATE', 'KOORDINASI')}</b><h3>{t('Confirm & execute', 'Konfirmasi dan eksekusi')}</h3><p>{t('Once scope is approved, align responsible parties, milestones and shipment handover.', 'Setelah scope disetujui, selaraskan PIC, jadwal, dan serah terima shipment.')}</p></div>
          </div>
        </div>
      </section>
      <section className="service-endnote section-ink">
        <div className="wrap split">
          <div><span className="eyebrow">VORA / {t('Next step', 'Langkah berikutnya')}</span><h2>{t('Let’s make the details work.', 'Rencanakan pengiriman secara tepat.')}</h2></div>
          <div><p>{detail.audience}</p><a href={quote} className="button light-button">{siteText[locale].rfq} ↗</a></div>
        </div>
      </section>
      <CtaBand locale={locale} />
    </>
  )
}
