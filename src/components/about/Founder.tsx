'use client'
import type { PlayerRef } from '@remotion/player'
import { useRef, useState } from 'react'
import { AboutGaps, GAPS } from '@/motion/about'
import { Stage } from './Stage'

export interface FounderItem { title: string; problem: string; answer: string }

/** Four problems, each a broken route. Choosing one shows what VORA does about it, and the break closes. */
export function Founder({ items, labels }: { items: FounderItem[]; labels: { problem: string; answer: string; open: string; closed: string } }) {
  const api = useRef<PlayerRef | null>(null)
  const [focus, setFocus] = useState(-1)
  const [resolvedAt, setResolvedAt] = useState<number[]>(items.map(() => -1))
  const choose = (i: number) => {
    setFocus(i)
    setResolvedAt((all) => (all[i] >= 0 ? all : all.map((v, k) => (k === i ? api.current?.getCurrentFrame() ?? 0 : v))))
  }
  const item = focus >= 0 ? items[focus] : null
  return (
    <div className="ab-founder__grid">
      <div className="ab-founder__list">
        <ul role="list">
          {items.map((it, i) => (
            <li key={i}>
              <button type="button" className="ab-problem" aria-pressed={focus === i} data-state={resolvedAt[i] >= 0 ? 'closed' : 'open'} onClick={() => choose(i)}>
                <span className="ab-problem__no">{String(i + 1).padStart(2, '0')}</span>
                <span className="ab-problem__text"><strong>{it.title}</strong><span>{it.problem}</span></span>
                <span className="ab-problem__state">{resolvedAt[i] >= 0 ? labels.closed : labels.open}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="ab-answer" aria-live="polite">{item ? <><p className="ab-eyebrow">{labels.answer}</p><p>{item.answer}</p></> : null}</div>
      </div>
      <Stage component={AboutGaps as never} w={GAPS.w} h={GAPS.h} frames={GAPS.frames} stillFrame={400} apiRef={api} inputProps={{ resolvedAt, focus }} className="ab-founder__stage"
        fallback={<img src="/static/assets/vora-a-icon-primary.svg" alt="" className="ab-fallback" width={160} height={90} />} />
    </div>
  )
}
