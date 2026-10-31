'use client'
import type { PlayerRef } from '@remotion/player'
import { useRef, useState } from 'react'
import { AboutConstellation, CONSTELLATION } from '@/motion/about'
import { Stage } from './Stage'

export interface Service { key: string; name: string; strap: string; intro: string; href: string }

/** Five services around the mark. Hover, focus or press one: its route lights, a carrier runs along it and the text on the side changes. */
export function Constellation({ services, more }: { services: Service[]; more: string }) {
  const api = useRef<PlayerRef | null>(null)
  const [state, setState] = useState({ active: 0, prev: 0, changedAt: 0 })
  const select = (i: number) => setState((s) => (s.active === i ? s : { active: i, prev: s.active, changedAt: api.current?.getCurrentFrame() ?? 0 }))
  const s = services[state.active]
  return (
    <div className="ab-const">
      <div className="ab-const__map">
        <Stage component={AboutConstellation as never} w={CONSTELLATION.w} h={CONSTELLATION.h} frames={CONSTELLATION.frames} stillFrame={400} apiRef={api} inputProps={state}
          fallback={<img src="/static/assets/vora-a-icon-reverse.svg" alt="" className="ab-fallback" width={180} height={101} />} />
        {services.map((sv, i) => {
          const n = CONSTELLATION.nodes[i]
          return (
            <button
              key={sv.key} type="button" className="ab-node" data-side={i === 0 ? 'top' : 'below'} aria-pressed={state.active === i} aria-label={sv.name}
              style={{ left: `${(n.x / CONSTELLATION.w) * 100}%`, top: `${(n.y / CONSTELLATION.h) * 100}%` }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') select(i) }} onFocus={() => select(i)} onClick={() => select(i)}
            ><span className="ab-node__name">{sv.name}</span></button>
          )
        })}
      </div>
      <div className="ab-const__detail" aria-live="polite">
        <p className="ab-eyebrow">{String(state.active + 1).padStart(2, '0')}</p>
        <h3>{s.name}</h3>
        <p className="ab-const__strap">{s.strap}</p>
        <p>{s.intro}</p>
        <a className="ab-link" href={s.href}>{more}</a>
      </div>
    </div>
  )
}
