'use client'
import type { PlayerRef } from '@remotion/player'
import { useEffect, useRef, useState } from 'react'
import { AboutBuild, BUILD } from '@/motion/about'
import { useInView } from './hooks'
import { Stage } from './Stage'

export interface Step { title: string; text: string }

/** Three steps, three parts of the mark: understanding raises the left leg, validating the right, coordinating lights the wedge. It plays through once by itself, then follows the visitor. */
export function Commitments({ steps, chips, hint }: { steps: Step[]; chips: string[]; hint: string }) {
  const api = useRef<PlayerRef | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const near = useInView(box, '-20% 0px -20% 0px')
  const touched = useRef(false)
  const [s, setS] = useState({ step: 0, prev: 0, changedAt: 0 })
  const go = (step: number) => setS((cur) => (cur.step === step ? cur : { step, prev: cur.step, changedAt: api.current?.getCurrentFrame() ?? 0 }))
  useEffect(() => {
    if (!near || touched.current) return
    const timers = [1, 2, 3].map((n, i) => window.setTimeout(() => { if (!touched.current) go(n) }, 700 + i * 1500))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [near])
  return (
    <div className="ab-build" ref={box}>
      <Stage component={AboutBuild as never} w={BUILD.w} h={BUILD.h} frames={BUILD.frames} stillFrame={300} apiRef={api} inputProps={s} className="ab-build__stage"
        fallback={<img src="/static/assets/vora-a-icon-primary.svg" alt="" className="ab-fallback" width={220} height={124} />} />
      <div className="ab-build__side">
        <p className="ab-hint ab-hint--static">{hint}</p>
        <ol className="ab-steps">
          {steps.map((st, i) => (
            <li key={i}>
              <button type="button" className="ab-step" aria-pressed={s.step > i} onClick={() => { touched.current = true; go(s.step === i + 1 ? i : i + 1) }}>
                <span className="ab-step__no">{String(i + 1).padStart(2, '0')}</span>
                <span><strong>{st.title}</strong><span>{st.text}</span></span>
              </button>
            </li>
          ))}
        </ol>
        <ul className="ab-chips" role="list">{chips.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
    </div>
  )
}
