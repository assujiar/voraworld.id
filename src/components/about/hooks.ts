'use client'
import { useEffect, useState } from 'react'

/** True when the visitor has asked for less motion (and stays current if they change it while the page is open). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync(); query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return reduced
}

/** True while the element is on screen (or near it, by `margin`). */
export function useInView(ref: React.RefObject<Element | null>, margin = '0px'): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const watch = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: margin })
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref, margin])
  return seen
}
