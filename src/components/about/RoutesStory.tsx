'use client'
import { useEffect, useRef, useState } from 'react'
import { AboutStory, ROUTES, type StoryLabels } from '@/motion/about'
import { useReducedMotion } from './hooks'
import { Stage } from './Stage'

/**
 * The statement, a word at a time, while a shipment route is built to match it: drawn and confirmed, its scope marked, each step given the name of the party responsible.
 * The page holds still for a stretch and the words and the picture advance together with the scroll.
 */
export function RoutesStory({ label, text, labels }: { label: string; text: string; labels: StoryLabels }) {
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
    <section ref={section} className="ab-story" style={{ height: reduced ? 'auto' : '190vh' }} aria-label={label}>
      <div className="ab-story__sticky">
        <div className="ab-story__copy">
          <p className="ab-eyebrow">{label}</p>
          <p className="ab-story__text">
            {words.map((w, i) => {
              const on = Math.max(0, Math.min(1, (progress - 0.06 - (i / words.length) * 0.6) / 0.07))
              return <span key={i} style={{ opacity: 0.16 + 0.84 * on }}>{w} </span>
            })}
          </p>
        </div>
        <Stage component={AboutStory as never} w={ROUTES.w} h={ROUTES.h} frames={ROUTES.frames} stillFrame={ROUTES.frames - 1} frame={progress * (ROUTES.frames - 1)} inputProps={{ labels }} className="ab-story__stage"
          fallback={<img src="/static/assets/vora-a-icon-primary.svg" alt="" className="ab-fallback" width={220} height={124} />} />
      </div>
    </section>
  )
}
