import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'
import { ServiceIndex } from './ServiceIndex'

/**
 * The five services. `tiles` (home) puts each one on a clay card with its render, the first one dark and wide; `index` (the services page) is the
 * plain list with a stage beside it. Both are made of ordinary links.
 */
export function ServiceCards({ locale, variant = 'index' }: { locale: Locale; variant?: 'index' | 'tiles' }) {
  const t = makeT(locale)
  const items = Object.entries(serviceGroups).map(([slug, group]) => ({
    slug, href: `/${locale}/services/${slug}`, name: group[locale].name, intro: group[locale].intro, image: group.image,
    modes: group.modes.map((m) => serviceModes[slug][m][locale][0]),
  }))
  if (variant === 'index') return <ServiceIndex items={items} />
  return (
    <ul className="v-tiles">
      {items.map((s, i) => (
        <li key={s.slug} className={`v-tile v-tile--${i + 1}`}>
          <a href={s.href}>
            <span className="v-tile__stage" aria-hidden="true" />
            <img className="v-tile__art" src={`/static/assets/${s.image}`} alt="" width={520} height={520} loading={i < 2 ? 'eager' : 'lazy'} />
            <span className="v-tile__body">
              <h3>{s.name}</h3>
              <p>{s.intro}</p>
              {s.modes.length ? <span className="v-tile__modes">{s.modes.map((m) => <span key={m}>{m}</span>)}</span> : null}
              <span className="v-tile__more">{t('See the service', 'Lihat layanan')}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
