'use client'
import { Player, type PlayerRef } from '@remotion/player'
import { useEffect, useRef } from 'react'
import { ROUTE_FRAMES, ROUTE_STILL_FRAME, RouteLines } from './RouteLines'

/**
 * The route drawing settles once: it plays from the first frame to the frame where every route is drawn, then holds there. It pauses while the hero
 * is off screen and never loops. A visitor who prefers less motion gets the settled frame at once, and if that preference is switched on while the page
 * is open the drawing stops and jumps to the settled frame.
 */
export default function RouteLinesPlayer({ still }: { still: boolean }) {
  const player = useRef<PlayerRef>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (still) { player.current?.pause(); player.current?.seekTo(ROUTE_STILL_FRAME); return }
    if (!box.current || typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver(([e]) => {
      const p = player.current
      if (!p) return
      if (e.isIntersecting) { if (p.getCurrentFrame() < ROUTE_STILL_FRAME) p.play() } else p.pause()
    }, { threshold: 0.05 })
    watch.observe(box.current)
    return () => watch.disconnect()
  }, [still])
  return (
    <div ref={box} style={{ width: '100%', height: '100%' }}>
      <Player ref={player} component={RouteLines} durationInFrames={ROUTE_FRAMES} fps={30} compositionWidth={1000} compositionHeight={1000}
        inFrame={0} outFrame={ROUTE_STILL_FRAME}
        autoPlay={!still} loop={false} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false}
        initialFrame={still ? ROUTE_STILL_FRAME : 0} style={{ width: '100%', height: '100%' }} numberOfSharedAudioTags={0} acknowledgeRemotionLicense />
    </div>
  )
}
