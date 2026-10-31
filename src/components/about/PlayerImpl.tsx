'use client'
import { Player, type PlayerRef } from '@remotion/player'
import { useEffect, useRef, type ComponentType, type MutableRefObject } from 'react'

/** The only module that imports the Remotion Player (it is loaded on demand, see Stage.tsx). */
export interface PlayerProps {
  component: ComponentType<never>
  inputProps: Record<string, unknown>
  w: number; h: number; frames: number
  /** A visitor who asked for less motion gets one settled frame. */
  still: boolean
  stillFrame: number
  /** Scrubbing: the Player does not play, it shows this frame. */
  frame?: number
  /** Start again when it ends (for a loop that never jumps). */
  loop?: boolean
  active: boolean
  apiRef?: MutableRefObject<PlayerRef | null>
}

export default function PlayerImpl({ component, inputProps, w, h, frames, still, stillFrame, frame, loop = false, active, apiRef }: PlayerProps) {
  const player = useRef<PlayerRef>(null)
  const scrubbing = frame !== undefined
  useEffect(() => { if (apiRef) apiRef.current = player.current })
  useEffect(() => {
    const p = player.current
    if (!p) return
    if (still) { p.pause(); p.seekTo(stillFrame); return }
    if (scrubbing) { p.pause(); return }
    if (active) p.play(); else p.pause()
  }, [still, stillFrame, scrubbing, active])
  useEffect(() => { if (scrubbing && !still) player.current?.seekTo(Math.max(0, Math.min(frames - 1, Math.round(frame ?? 0)))) }, [frame, scrubbing, still, frames])
  return (
    <Player
      ref={player} component={component as ComponentType<Record<string, unknown>>} inputProps={inputProps} durationInFrames={frames} fps={30} compositionWidth={w} compositionHeight={h}
      autoPlay={!still && !scrubbing && active} loop={loop} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false}
      initialFrame={still ? stillFrame : scrubbing ? Math.round(frame ?? 0) : 0} style={{ width: '100%', height: '100%' }} numberOfSharedAudioTags={0} acknowledgeRemotionLicense
    />
  )
}
