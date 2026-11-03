"use client"
import { useRef } from 'react'
import { useAutomaticFrame } from '@/components/atelier/useAutomaticFrame'
import { ROUTE_FRAMES, ROUTE_STILL_FRAME, RouteLinesFrame } from './RouteLines'

/** Original route choreography, on the shared image-ready automatic SVG clock. */
export default function RouteLinesPlayer({ still: _still }: { still: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useAutomaticFrame(ref, { frames: ROUTE_FRAMES, loop: true, stillFrame: ROUTE_STILL_FRAME, waitForImage: true })
  return <div ref={ref} data-route-frame={frame} style={{ width: '100%', height: '100%', position: 'relative' }}><RouteLinesFrame frame={frame} /></div>
}
