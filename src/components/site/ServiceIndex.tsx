'use client'
import { useState } from 'react'

export interface IndexItem { slug: string; href: string; name: string; intro: string; modes: string[]; image: string }

/**
 * The five services as a list. Looking at one (pointer or keyboard) brings its render forward on the plinth beside the list; on a phone each row
 * carries its own render instead. Every row is an ordinary link, so nothing depends on the hover.
 */
export function ServiceIndex({ items }: { items: IndexItem[] }) {
  const [on, setOn] = useState(0)
  return (
    <div className="v-index">
      <ol className="v-index__list">
        {items.map((s, i) => (
          <li key={s.slug} className={`v-index__item${on === i ? ' is-active' : ''}`} onMouseEnter={() => setOn(i)}>
            <a href={s.href} onFocus={() => setOn(i)}>
              <img className="v-index__thumb" src={`/static/assets/${s.image}`} alt="" width={260} height={260} loading="lazy" />
              <h3>{s.name}</h3>
              <p>{s.intro}</p>
              {s.modes.length ? <span className="v-index__modes">{s.modes.join(' · ')}</span> : null}
              <span className="v-index__go" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
      <div className="v-index__stage" aria-hidden="true">
        {items.map((s, i) => <img key={s.slug} className={on === i ? 'is-on' : ''} src={`/static/assets/${s.image}`} alt="" width={520} height={520} loading={i === 0 ? 'eager' : 'lazy'} />)}
      </div>
    </div>
  )
}
