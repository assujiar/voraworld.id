'use client'
import type { PlayerRef } from '@remotion/player'
import { useEffect, useRef, useState } from 'react'
import { AboutField, FIELD, type Pulse } from '@/motion/about'
import { useReducedMotion } from './hooks'
import { Stage } from './Stage'

/** A field of marks that fills its box, grows and lights toward the pointer, and sends a wave outward when pressed. The closing line sits on top of it. */
export function MarkField({ children }: { children: React.ReactNode }) {
  const api = useRef<PlayerRef | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [pt, setPt] = useState({ x: -9999, y: -9999 })
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [h, setH] = useState(FIELD.h)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width) setH(Math.max(300, Math.round((FIELD.w * r.height) / r.width))) }
    measure()
    const watch = new ResizeObserver(measure); watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const at = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * FIELD.w, y: ((e.clientY - r.top) / r.height) * h } }
  return (
    <div
      ref={box} className="ab-field"
      onPointerMove={(e) => { if (!reduced) setPt(at(e)) }} onPointerLeave={() => setPt({ x: -9999, y: -9999 })}
      onPointerDown={(e) => { if (reduced) return; const p = at(e); setPulses((all) => [...all.slice(-5), { ...p, f: api.current?.getCurrentFrame() ?? 0 }]) }}
    >
      <Stage component={AboutField as never} w={FIELD.w} h={h} frames={FIELD.frames} stillFrame={120} apiRef={api} inputProps={{ px: pt.x, py: pt.y, pulses }} className="ab-field__stage" style={{ aspectRatio: 'auto' }}
        fallback={<img src="/static/assets/vora-a-icon-reverse.svg" alt="" className="ab-fallback" width={120} height={68} />} />
      <div className="ab-field__copy">{children}</div>
    </div>
  )
}
