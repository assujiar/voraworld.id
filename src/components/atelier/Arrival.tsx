'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { animate } from 'motion'
import { gsap } from 'gsap'
import { autoMotion } from '@/lib/auto-motion'

export type MotionSignature = 'air' | 'air-out' | 'sea' | 'sea-out' | 'road' | 'warehouse' | 'document' | 'heavy' | 'type' | 'network'
const rhythms: Record<MotionSignature, { entrance: [number, number]; drift: [number, number]; seconds: number }> = {
  air: { entrance: [-18, 12], drift: [-4, -7], seconds: 9 },
  'air-out': { entrance: [14, 8], drift: [4, -5], seconds: 8.5 },
  sea: { entrance: [18, 6], drift: [4, 2], seconds: 11 },
  'sea-out': { entrance: [0, 16], drift: [0, -3], seconds: 10 },
  road: { entrance: [-24, 0], drift: [5, 0], seconds: 8 },
  warehouse: { entrance: [0, 12], drift: [0, -2], seconds: 12 },
  document: { entrance: [0, 10], drift: [0, -3], seconds: 10.5 },
  heavy: { entrance: [0, 8], drift: [0, -1.5], seconds: 13 },
  type: { entrance: [0, 8], drift: [0, 0], seconds: 10 },
  network: { entrance: [0, 8], drift: [0, 0], seconds: 12 },
}
/** Image-ready autoplay. Visibility pauses time; scrolling and clicking never drive it. */
export function Arrival({ children, signature = 'type', className = '' }: { children: ReactNode; signature?: MotionSignature; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const object = el.querySelector<HTMLElement>('.a-object')
    const images = object instanceof HTMLImageElement ? [object] : []
    const rail = el.querySelector<HTMLElement>('.a-stage__measure'), rhythm = rhythms[signature]
    let movement: ReturnType<typeof animate> | undefined, context: gsap.Context | undefined
    let entered = false, active = false, generation = 0
    const reset = () => {
      generation++; active = false; entered = false
      movement?.stop(); movement = undefined; context?.revert(); context = undefined
      object?.style.removeProperty('transform'); delete el.dataset.motionEntered
    }
    return autoMotion(el, {
      play: () => {
        active = true
        if (entered) { movement?.play(); context?.getTweens().forEach((tween: gsap.core.Tween) => tween.resume()); return }
        entered = true; el.dataset.motionEntered = 'true'
        const current = generation
        context = gsap.context(() => {
          if (rail) gsap.fromTo(rail, { scaleX: .08, transformOrigin: 'left' }, { scaleX: 1, duration: 1.4, ease: 'power2.out' })
          gsap.fromTo(el.querySelectorAll('[data-assembly]'), { y: 8 }, { y: 0, duration: .85, stagger: .12, ease: 'power2.out' })
        }, el)
        if (!object) return
        movement = animate(object, { x: [rhythm.entrance[0], 0], y: [rhythm.entrance[1], 0] }, { duration: signature === 'heavy' ? 1.6 : 1.2, ease: [.22, 1, .36, 1] })
        void movement.then(() => {
          if (current !== generation || rhythm.drift.every(value => value === 0)) return
          movement = animate(object, { x: [0, rhythm.drift[0], 0], y: [0, rhythm.drift[1], 0] }, { duration: rhythm.seconds, repeat: Infinity, ease: 'easeInOut' })
          if (!active) movement.pause()
        })
      },
      pause: () => { active = false; movement?.pause(); context?.getTweens().forEach((tween: gsap.core.Tween) => tween.pause()) },
      reset,
    }, images)
  }, [signature])
  return <div ref={ref} className={`a-arrival ${className}`} data-motion={signature}>{children}</div>
}
