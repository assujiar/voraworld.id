'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const Lines = dynamic(() => import('./RouteLinesPlayer'), { ssr: false })

/**
 * Decorative, so hidden from assistive technology. Loaded after the page is interactive: the hero does not wait for it.
 * Follows the visitor's reduced-motion setting while the page is open, not only when it loads.
 */
export function RouteBackdrop() {
  const [still, setStill] = useState<boolean | null>(null)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setStill(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return <div className="v-hero__routes" aria-hidden="true">{still === null ? null : <Lines still={still} />}</div>
}
