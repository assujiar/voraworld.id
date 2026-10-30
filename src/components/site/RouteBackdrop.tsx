'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const Lines = dynamic(() => import('./RouteLinesPlayer'), { ssr: false })

/** Decorative, so hidden from assistive technology. Loaded after the page is interactive: the hero does not wait for it. */
export function RouteBackdrop() {
  const [still, setStill] = useState<boolean | null>(null)
  useEffect(() => { setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  return <div className="v-hero__routes" aria-hidden="true">{still === null ? null : <Lines still={still} />}</div>
}
