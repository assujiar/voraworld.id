'use client'
import type { PlayerRef } from '@remotion/player'
import { useRef, useState } from 'react'
import { AboutField, FIELD, type Pulse } from '@/motion/about'
import { useReducedMotion } from './hooks'
import { Stage } from './Stage'

/** A field of marks that grow and light toward the pointer, and send a wave outward when pressed. The closing line sits on top of it. */
export function MarkField({ children }: { children: React.ReactNode }) {
  const api = useRef<PlayerRef | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [pt, setPt] = useState({ x: -9999, y: -9999 })
  const [pulses, setPulses] = useState<Pulse[]>([])
  const reduced = useReducedMotion()
  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    // The composition is drawn to cover the box (slice), so work out where the box sits inside it.
    const scale = Math.max(r.width / FIELD.w, r.height / FIELD.h)
    const ox = (FIELD.w * scale - r.width) / 2, oy = (FIELD.h * scale - r.height) / 2
    return { x: (e.clientX - r.left + ox) / scale, y: (e.clientY - r.top + oy) / scale }
  }
  return (
    <div
      ref={box} className="ab-field"
      onPointerMove={(e) => { if (!reduced) setPt(at(e)) }} onPointerLeave={() => setPt({ x: -9999, y: -9999 })}
      onPointerDown={(e) => { if (reduced) return; const p = at(e); setPulses((all) => [...all.slice(-5), { ...p, f: api.current?.getCurrentFrame() ?? 0 }]) }}
    >
      <Stage component={AboutField as never} w={FIELD.w} h={FIELD.h} frames={FIELD.frames} stillFrame={120} apiRef={api} inputProps={{ px: pt.x, py: pt.y, pulses }} className="ab-field__stage"
        style={{ aspectRatio: 'auto', position: 'absolute', inset: 0 }}
        fallback={<img src="/static/assets/vora-a-icon-reverse.svg" alt="" className="ab-fallback" width={120} height={68} />} />
      <div className="ab-field__copy">{children}</div>
    </div>
  )
}
