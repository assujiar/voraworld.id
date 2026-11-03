'use client'
import { useRef, type CSSProperties } from 'react'
import { useAutomaticFrame } from './useAutomaticFrame'
import { BrandFrame, STUDY_NUMBER, type BrandStudy } from '@/motion/studies'

export interface BrandMotionProps { study: BrandStudy; tone?: 'light' | 'dark'; mark?: boolean; loop?: boolean; label?: string; className?: string; style?: CSSProperties }
/** The server always sends the settled official identity. Motion needs no click or pointer. */
export function BrandMotion({ study, tone = 'light', mark = false, loop = false, label = 'VORA', className = '', style }: BrandMotionProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const ambient = study === 'origin' && mark && loop
  const frame = useAutomaticFrame(ref, { frames: study === 'signal' ? 180 : loop ? 360 : 180, loop, loopFrom: ambient ? 180 : 0, stillFrame: study === 'signal' ? 0 : 150 })
  const opacity = loop && !ambient && study !== 'signal' ? Math.min(1, Math.max(0, (360 - frame) / 20)) : 1
  return <span ref={ref} role="img" aria-label={label} className={`vora-brand-motion ${className}`} data-brand-study={STUDY_NUMBER[study]} data-ambient-study={ambient ? '06' : undefined} style={{ aspectRatio: study === 'signal' ? '1' : mark ? '1048 / 590' : '1780 / 384', ...style }}>
    <span className="vora-brand-motion__art" style={{ opacity }}><BrandFrame study={study} tone={tone} mark={mark} frame={frame} /></span>
  </span>
}
