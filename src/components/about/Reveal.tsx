'use client'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useReducedMotion } from './hooks'

/** A block that settles into place (a short rise and fade) the first time it is scrolled to. Blocks that are already in view when the page loads are not hidden at all, and without script everything is simply there. */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'p' | 'ul' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'plain' | 'armed' | 'in'>('plain')
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || reduced || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
    setState('armed')
    const watch = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState('in'); watch.disconnect() } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    watch.observe(el)
    return () => watch.disconnect()
  }, [reduced])
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined
  const Element = Tag as 'div'
  return <Element ref={ref} className={`ab-reveal ${state === 'armed' ? 'is-armed' : state === 'in' ? 'is-in' : ''} ${className}`} style={style}>{children}</Element>
}
