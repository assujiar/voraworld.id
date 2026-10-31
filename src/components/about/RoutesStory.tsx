'use client'
import { useEffect, useRef, useState } from 'react'
import { AboutRoutes, ROUTES } from '@/motion/about'
import { useReducedMotion } from './hooks'
import { Stage } from './Stage'

/** The statement, a word at a time, while routes are drawn around the mark: both follow the scroll (the page holds still for a stretch and they advance together). */
export function RoutesStory({ label, text }: { label: string; text: string }) {
  const section = useRef<HTMLElement>(null)
  const [p, setP] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const read = () => {
      raf = 0
      const el = section.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const span = Math.max(1, r.height - window.innerHeight)
      setP(Math.max(0, Math.min(1, -r.top / span)))
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(read) }
    read(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf) }
  }, [reduced])
  const progress = reduced ? 1 : p
  const words = text.split(' ')
  return (
    <section ref={section} className="ab-story" style={{ height: reduced ? 'auto' : '230vh' }} aria-label={label}>
      <div className="ab-story__sticky">
        <Stage component={AboutRoutes as never} w={ROUTES.w} h={ROUTES.h} frames={ROUTES.frames} stillFrame={ROUTES.frames - 1} frame={progress * (ROUTES.frames - 1)} inputProps={{}} className="ab-story__stage"
          fallback={<img src="/static/assets/vora-a-icon-primary.svg" alt="" className="ab-fallback" width={220} height={124} />} />
        <div className="ab-story__copy">
          <p className="ab-eyebrow">{label}</p>
          <p className="ab-story__text">
            {words.map((w, i) => {
              const on = Math.max(0, Math.min(1, (progress - 0.1 - (i / words.length) * 0.55) / 0.07))
              return <span key={i} style={{ opacity: 0.16 + 0.84 * on }}>{w} </span>
            })}
          </p>
        </div>
      </div>
    </section>
  )
}
