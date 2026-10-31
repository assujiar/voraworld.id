'use client'
import type { PlayerRef } from '@remotion/player'
import { useEffect, useRef, useState } from 'react'
import { AboutRail, RAIL } from '@/motion/about'
import { Stage } from './Stage'

export interface FounderItem { title: string; problem: string; answer: string }

/**
 * The problems as points on one shipment path. A problem that is open breaks the path; choosing it shows what VORA does and VORA's mark closes the break. When every problem is
 * closed the path is unbroken. The picture is the rail beside the list (drawn as tall as the list is), the words are the list and the answer.
 */
export function Founder({ items, labels }: { items: FounderItem[]; labels: { problem: string; answer: string; open: string; closed: string; progress: string; complete: string } }) {
  const api = useRef<PlayerRef | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const [focus, setFocus] = useState(-1)
  const [resolvedAt, setResolvedAt] = useState<number[]>(items.map(() => -1))
  const [geo, setGeo] = useState<{ h: number; ys: number[] }>({ h: 0, ys: [] })
  useEffect(() => {
    const ul = list.current
    if (!ul || typeof ResizeObserver === 'undefined') return
    const measure = () => setGeo({ h: ul.offsetHeight, ys: [...ul.children].map((li) => (li as HTMLElement).offsetTop + (li as HTMLElement).offsetHeight / 2) })
    measure()
    const watch = new ResizeObserver(measure); watch.observe(ul)
    return () => watch.disconnect()
  }, [])
  const choose = (i: number) => {
    setFocus(i)
    setResolvedAt((all) => (all[i] >= 0 ? all : all.map((v, k) => (k === i ? api.current?.getCurrentFrame() ?? 0 : v))))
  }
  const closed = resolvedAt.filter((v) => v >= 0).length
  const item = focus >= 0 ? items[focus] : null
  return (
    <div className="ab-founder__grid">
      <div className="ab-rail">
        {geo.h > 0 ? (
          <Stage component={AboutRail as never} w={RAIL.w} h={geo.h} frames={RAIL.frames} stillFrame={300} apiRef={api} inputProps={{ ys: geo.ys, height: geo.h, resolvedAt, focus }} className="ab-rail__stage"
            style={{ aspectRatio: 'auto', width: RAIL.w, height: geo.h }} />
        ) : null}
        <ul role="list" ref={list}>
          {items.map((it, i) => (
            <li key={i}>
              <button type="button" className="ab-problem" aria-pressed={focus === i} data-state={resolvedAt[i] >= 0 ? 'closed' : 'open'} onClick={() => choose(i)}>
                <span className="ab-problem__text"><strong>{it.title}</strong><span>{it.problem}</span></span>
                <span className="ab-problem__state">{resolvedAt[i] >= 0 ? labels.closed : labels.open}</span>
              </button>
              {/* On a phone the answer opens right under the problem (the side column is hidden there). */}
              {focus === i ? <p className="ab-problem__answer"><strong>{labels.answer}</strong>{it.answer}</p> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="ab-answer-col" aria-live="polite">
        <p className="ab-progress">{labels.progress.replace('{n}', String(closed)).replace('{total}', String(items.length))}</p>
        <div className="ab-answer" data-empty={!item}>
          {item ? <><p className="ab-eyebrow">{labels.answer}</p><p className="ab-answer__title">{item.title}</p><p>{item.answer}</p></> : null}
        </div>
        {closed === items.length ? <p className="ab-complete">{labels.complete}</p> : null}
      </div>
    </div>
  )
}
