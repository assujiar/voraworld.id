'use client'
import type { PlayerRef } from '@remotion/player'
import { useRef, useState } from 'react'
import { AboutHero, HERO, type Pulse } from '@/motion/about'
import { useReducedMotion } from './hooks'
import { Stage } from './Stage'

/** The hero's logo: it arrives, then follows the pointer (a soft red light behind it, a little depth between the letters and the wedge) and answers a press with a ring. */
export function HeroStage({ hint, hintTouch }: { hint: string; hintTouch: string }) {
  const api = useRef<PlayerRef | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [pt, setPt] = useState({ x: 0, y: 0 })
  const [pulses, setPulses] = useState<Pulse[]>([])
  const reduced = useReducedMotion()
  const rel = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height } }
  const press = (e: React.PointerEvent | React.KeyboardEvent, at?: { fx: number; fy: number }) => {
    if (reduced) return
    const f = api.current?.getCurrentFrame() ?? 0
    const p = at ?? { fx: 0.5, fy: 0.5 }
    setPulses((all) => [...all.slice(-5), { x: p.fx * HERO.w, y: p.fy * HERO.h, f }])
    void e
  }
  return (
    <div className="ab-hero__logo">
      <div
        ref={box} className="ab-hero__touch" role="button" tabIndex={0} aria-label={hint}
        onPointerMove={(e) => { if (reduced) return; const { fx, fy } = rel(e); setPt({ x: (fx - 0.5) * 2, y: (fy - 0.5) * 2 }) }}
        onPointerLeave={() => setPt({ x: 0, y: 0 })}
        onPointerDown={(e) => press(e, rel(e))}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(e) } }}
      >
        <Stage
          component={AboutHero as never} w={HERO.w} h={HERO.h} frames={HERO.frames} stillFrame={HERO.settled} apiRef={api}
          inputProps={{ px: pt.x, py: pt.y, pulses }}
          fallback={<img src="/static/assets/vora-reverse.svg" alt="" className="ab-fallback" width={640} height={138} />}
        />
      </div>
      <p className="ab-hint" aria-hidden="true"><span className="ab-hint__fine">{hint}</span><span className="ab-hint__touch">{hintTouch}</span></p>
    </div>
  )
}
