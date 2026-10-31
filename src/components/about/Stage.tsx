'use client'
import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, type ReactNode } from 'react'
import type { PlayerProps } from './PlayerImpl'
import { useInView, useReducedMotion } from './hooks'

const PlayerImpl = dynamic(() => import('./PlayerImpl'), { ssr: false })

/**
 * A Remotion composition on the page. It is decorative (hidden from assistive technology: what it shows is also said in text next to it), it is fetched and started only when it
 * comes near the screen, it stops while it is off screen, and for a visitor who asked for less motion it stays on one settled frame. `fallback` is what shows until it is ready.
 */
export function Stage(props: Omit<PlayerProps, 'still' | 'active'> & { className?: string; fallback?: ReactNode; style?: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null)
  const near = useInView(box, '240px')
  const [mounted, setMounted] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => { if (near) setMounted(true) }, [near])
  const { className = '', fallback, style, ...rest } = props
  return (
    <div ref={box} className={`ab-stage ${className}`} aria-hidden="true" style={{ aspectRatio: `${props.w} / ${props.h}`, ...style }}>
      {mounted ? null : fallback}
      {mounted ? <PlayerImpl {...rest} still={reduced} active={near} /> : null}
    </div>
  )
}
