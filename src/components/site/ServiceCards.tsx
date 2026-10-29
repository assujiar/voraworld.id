import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'

export function ServiceCards({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  return (
    <div className="service-portfolio" aria-label="VORA core logistics services">
      {Object.entries(serviceGroups).map(([slug, group], i) => (
        <a key={slug} className={`service-tile service-tile--${i + 1}`} href={`/${locale}/services/${slug}`} aria-label={`${group[locale].name} details`}>
          <span className="tile-index">{group.index} <span>/ 05</span></span>
          <div className="tile-content">
            <span className="eyebrow">{t('Service portfolio', 'Layanan VORA')}</span>
            <h3>{group[locale].name}</h3>
            <p>{group[locale].intro}</p>
            {group.modes.length ? (
              <span className="tile-modes">
                {group.modes.map((mode, n) => (
                  <span key={mode}>{serviceModes[slug][mode][locale][0]}{n < group.modes.length - 1 ? <span className="dot">·</span> : null}</span>
                ))}
              </span>
            ) : null}
          </div>
          <span className="tile-stage" aria-hidden="true" />
          <img className="tile-art" loading="lazy" src={`/static/assets/${encodeURIComponent(group.image)}`} alt="" aria-hidden="true" width={430} height={360} />
          <span className="tile-arrow" aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  )
}
