'use client'
import type { PlayerRef } from '@remotion/player'
import { useEffect, useRef, useState } from 'react'
import { AboutHero, HERO, heroLogo, type Pulse } from '@/motion/about'
import { useReducedMotion } from './hooks'
import { Stage } from './Stage'

/**
 * The hero: the composition fills the whole section (its height follows the section's shape, its width is always 1600 units), the copy sits on top of it. The logo arrives, then
 * follows the pointer (a soft red light behind it, a little depth between the letters and the wedge) and answers a press with a ring.
 */
export function HeroStage({ hint, hintTouch, children }: { hint: string; hintTouch: string; children: React.ReactNode }) {
  const api = useRef<PlayerRef | null>(null)
  const box = useRef<HTMLElement>(null)
  const [pt, setPt] = useState({ x: 0, y: 0 })
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [h, setH] = useState(HERO.h)
  const [revealAt, setRevealAt] = useState<number | null>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width) setH(Math.max(480, Math.round((HERO.w * r.height) / r.width))) }
    measure()
    const watch = new ResizeObserver(measure); watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const logo = heroLogo(HERO.w, h)
  const rel = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height } }
  return (
    <section
      ref={box} className="ab-hero"
      onPointerMove={(e) => { if (reduced) return; const { fx, fy } = rel(e); setPt({ x: (fx - 0.5) * 2, y: (fy - 0.5) * 2 }) }}
      onPointerLeave={() => setPt({ x: 0, y: 0 })}
      onPointerDown={(e) => { if (reduced) return; const { fx, fy } = rel(e); const f = api.current?.getCurrentFrame() ?? 0; setPulses((all) => [...all.slice(-5), { x: fx * HERO.w, y: fy * h, f }]) }}
    >
      <Stage
        component={AboutHero as never} w={HERO.w} h={h} frames={HERO.frames} stillFrame={HERO.settled} apiRef={api} inputProps={{ px: pt.x, py: pt.y, pulses, revealAt }} className="ab-hero__stage" style={{ aspectRatio: 'auto' }}
        fallback={<img src="/static/assets/vora-reverse.svg" alt="" className="ab-fallback ab-fallback--logo" width={640} height={138} />}
      />
      <div className="ab-hero__content">{children}</div>
      {/* The logo is also a real button: reachable by keyboard, and pressing it reveals the line under the logo. */}
      <button
        type="button" className="ab-hero__reveal" aria-label={hint} aria-expanded={revealAt !== null || reduced}
        style={{ left: `${(logo.x / HERO.w) * 100}%`, top: `${(logo.y / h) * 100}%`, width: `${(logo.w / HERO.w) * 100}%`, height: `${(logo.h / h) * 100}%` }}
        onClick={() => setRevealAt((cur) => cur ?? api.current?.getCurrentFrame() ?? 0)}
      />
      {revealAt === null && !reduced ? <p className="ab-hint ab-hint--hero" aria-hidden="true"><span className="ab-hint__fine">{hint}</span><span className="ab-hint__touch">{hintTouch}</span></p> : null}
    </section>
  )
}
