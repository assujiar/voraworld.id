'use client'
import { useRef } from 'react'
import { useAutomaticFrame } from '@/components/atelier/useAutomaticFrame'

/** A quiet 12-second lift matches the wordmark cycle. Text always remains visible and readable. */
export function FooterTagline({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const frame = useAutomaticFrame(ref, { frames: 360, loop: true, stillFrame: 0 })
  const pulse = Math.sin(Math.PI * frame / 360) ** 2
  return <p ref={ref} lang="en" className="v-footer__tag" data-footer-tagline-motion="breath" style={{ transform: `translateY(${-1.5 * pulse}px)`, opacity: 1 - .04 * pulse }}>{text}</p>
}
