'use client'
import type { PlayerRef } from '@remotion/player'
import { useEffect, useRef, useState } from 'react'
import { AboutVerify, VERIFY } from '@/motion/about'
import { useInView, useReducedMotion } from './hooks'
import { Stage } from './Stage'

export interface RecordLabels { title: string; rows: Array<[string, string]> }

/** A document with its stamp and QR code, and a button that scans it. The answer is real text under the picture (crisp at any size, readable by a screen reader). */
export function VerifyDemo({ scan, caption, record }: { scan: string; caption: string; record: RecordLabels }) {
  const api = useRef<PlayerRef | null>(null)
  const box = useRef<HTMLElement>(null)
  const near = useInView(box, '-15% 0px -15% 0px')
  const reduced = useReducedMotion()
  const [scanAt, setScanAt] = useState<number | null>(null)
  const [found, setFound] = useState(false)
  const timer = useRef<number>(0)
  const ran = useRef(false)
  const run = (frame: number | null) => {
    setScanAt(frame); setFound(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFound(true), 1950)
  }
  // The first time it is on screen it scans once by itself, so that the page shows what the button does.
  useEffect(() => { if (near && !ran.current) { ran.current = true; if (reduced) setFound(true); else { setScanAt(null); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setFound(true), (VERIFY.first / 30 + 1.95) * 1000) } } }, [near, reduced])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <figure className="ab-verify" ref={box}>
      <Stage component={AboutVerify as never} w={VERIFY.w} h={VERIFY.h} frames={VERIFY.frames} stillFrame={260} apiRef={api} inputProps={{ scanAt }}
        fallback={<img src="/static/assets/vora-a-icon-primary.svg" alt="" className="ab-fallback" width={160} height={90} />} />
      <div className="ab-record" data-found={found} role="status" aria-live="polite">
        <span className="ab-record__tick" aria-hidden="true">✓</span>
        <div>
          <strong>{found ? record.title : ' '}</strong>
          <dl>{record.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
      </div>
      <figcaption>
        <button type="button" className="ab-btn" onClick={() => run((api.current?.getCurrentFrame() ?? 0) + 2)}>{scan}</button>
        <span>{caption}</span>
      </figcaption>
    </figure>
  )
}
