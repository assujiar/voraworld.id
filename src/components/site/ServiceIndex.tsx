import { ObjectArt } from '@/components/atelier/ObjectArt'
import type { VisualAsset } from '@/content/visual-assets'

export interface IndexItem { slug: string; href: string; name: string; intro: string; modes: string[]; image: string; asset: VisualAsset }

/**
 * A full-width editorial directory. Each service has one illustration and one
 * ordinary link; the same content remains readable without hover or JavaScript.
 */
export function ServiceIndex({ items }: { items: IndexItem[] }) {
  return (
    <div className="v-index">
      <ol className="v-index__list">
        {items.map((s, i) => (
          <li key={s.slug} className="v-index__item">
            <a href={s.href}>
              <span className="v-index__number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <div className="v-index__art"><ObjectArt className="v-index__thumb" asset={s.asset} sizes="(max-width: 600px) 88px, 200px" /></div>
              <h3>{s.name}</h3>
              <p>{s.intro}</p>
              {s.modes.length ? <span className="v-index__modes">{s.modes.join(' · ')}</span> : null}
              <span className="v-index__go" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}
