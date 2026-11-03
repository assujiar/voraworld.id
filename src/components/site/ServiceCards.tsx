import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'
import { serviceArt } from '@/content/service-art'
import { ServiceIndex } from './ServiceIndex'
import { ObjectArt } from '@/components/atelier/ObjectArt'
export function ServiceCards({ locale, variant = 'index', context = 'directory' }: { locale: Locale; variant?: 'index' | 'tiles'; context?: 'about' | 'directory' }) {
  const t = makeT(locale)
  const items = Object.entries(serviceGroups).map(([slug, group]) => ({ slug, href: `/${locale}/services/${slug}`, name: group[locale].name, intro: group[locale].intro, image: group.image, modes: group.modes.map((m) => serviceModes[slug][m][locale][0]) }))
  if (variant === 'index') return <ServiceIndex items={items.map(s => ({ ...s, asset: serviceArt[context][s.slug] }))} />
  return <ul className="a-capabilities">{items.map((s, i) => <li key={s.slug} className={`a-capability a-capability--${i + 1}`}><a href={s.href}><span className="a-label">0{i + 1} / {i === 0 ? 'AIR & OCEAN' : i === 1 ? 'DOCUMENTS' : i === 2 ? 'STORAGE & FLOW' : i === 3 ? 'ROAD / SEA / AIR' : 'HEAVY & OVERSIZED'}</span><div className="a-capability__art"><ObjectArt asset={serviceArt.home[s.slug]} sizes="(max-width: 600px) 280px, 420px" /></div><div className="a-capability__copy"><h3>{s.name}</h3><p>{s.intro}</p><span className="a-capability__link">{t('Explore the service', 'Lihat layanan')} <span aria-hidden="true">↗</span></span></div></a></li>)}</ul>
}
