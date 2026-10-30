'use client'
import { Player, type PlayerRef } from '@remotion/player'
import { useEffect, useRef } from 'react'
import { ROUTE_FRAMES, ROUTE_STILL_FRAME, RouteLines } from './RouteLines'

/** Plays the route drawing while the hero is on screen; for a visitor who prefers less motion it shows one still frame and never plays. */
export default function RouteLinesPlayer({ still }: { still: boolean }) {
  const player = useRef<PlayerRef>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (still || !box.current || typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver(([e]) => { if (e.isIntersecting) player.current?.play(); else player.current?.pause() }, { threshold: 0.05 })
    watch.observe(box.current)
    return () => watch.disconnect()
  }, [still])
  return (
    <div ref={box} style={{ width: '100%', height: '100%' }}>
      <Player ref={player} component={RouteLines} durationInFrames={ROUTE_FRAMES} fps={30} compositionWidth={1000} compositionHeight={1000}
        autoPlay={!still} loop={!still} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false}
        initialFrame={still ? ROUTE_STILL_FRAME : 0} style={{ width: '100%', height: '100%' }} numberOfSharedAudioTags={0} acknowledgeRemotionLicense />
    </div>
  )
}
