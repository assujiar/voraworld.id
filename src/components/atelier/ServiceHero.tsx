import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'
import { visualAssets } from '@/content/visual-assets'
import { serviceDesign } from '@/content/service-design'
import { ObjectArt } from './ObjectArt'
import { Arrival } from './Arrival'
export function ServiceHero({ locale, group, mode }: { locale: Locale; group: string; mode?: string }) {
  const t = makeT(locale), g = serviceGroups[group], d = serviceDesign(group, mode), copy = d[locale]
  const sub = mode ? serviceModes[group][mode][locale] : null
  const name = sub ? sub[0] : g[locale].name
  return <section className={`a-service a-service--${d.family}${mode?.includes('export') ? ' a-service--outbound' : ''}`} data-service={mode ?? group}>
    <div className="v-wrap">
      <nav className="v-crumbs" aria-label={t('Breadcrumb', 'Jejak halaman')}><a href={`/${locale}/services`}>{t('Services', 'Layanan')}</a><span aria-hidden="true"> / </span>{mode ? <><a href={`/${locale}/services/${group}`}>{g[locale].name}</a><span aria-hidden="true"> / </span></> : null}<span>{name}</span></nav>
      <div className="a-service__grid">
        <div className="a-service__copy"><p className="a-label">{d.code} <span>{name}</span></p><h1>{copy.headline}</h1><p className="a-intro">{sub ? sub[1] : g[locale].intro}</p><div className="v-actions"><a className="v-btn v-btn--red" href={`/${locale}/request-quote?mode=${group}${mode ? '/' + mode : ''}`}>{copy.cta}<span aria-hidden="true">↗</span></a></div></div>
        <Arrival signature={d.motion} className="a-stage">
          <div className="a-stage__architecture" aria-hidden="true" />
          <ObjectArt asset={d.asset} priority alt={t(`Sculptural illustration: ${name.toLowerCase()}`, `Ilustrasi 3D: ${name}`)} />
          <div className="a-stage__measure" aria-hidden="true"><i /><span>{d.code}</span><i /></div>
        </Arrival>
      </div>
      {d.asset.startsWith('n') ? <div className="a-hero-illustration-note"><span>{mode === 'lcl' ? t('Illustration; cargo volumes are examples.', 'Ilustrasi; volume kargo hanya contoh.') : mode === 'air-export' ? t('Illustrative rear-ramp loading arrangement.', 'Ilustrasi pemuatan melalui ramp belakang.') : t('Illustration of shared truck capacity.', 'Ilustrasi muatan beberapa shipper dalam satu truk.')}</span><a className="v-link" href={visualAssets[d.asset].src} target="_blank" rel="noopener noreferrer">{t('View full size', 'Lihat ukuran penuh')} ↗</a></div> : null}
      <ul className="a-cues">{copy.cue.map((c, i) => <li key={c}><span aria-hidden="true">0{i + 1}</span>{c}</li>)}</ul>
    </div>
  </section>
}
