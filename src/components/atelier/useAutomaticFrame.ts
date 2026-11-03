'use client'
import { useEffect, useState, type RefObject } from 'react'
import { autoMotion } from '@/lib/auto-motion'
import { frameClock } from '@/lib/frame-clock'

export function useAutomaticFrame<T extends HTMLElement>(ref: RefObject<T | null>, { frames, loop = false, loopFrom = 0, stillFrame = 150, waitForImage = false }: { frames: number; loop?: boolean; loopFrom?: number; stillFrame?: number; waitForImage?: boolean }) {
  const [frame, setFrame] = useState(stillFrame)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const clock = frameClock({ frames, loop, loopFrom, onFrame: setFrame })
    const images = waitForImage ? [...(element.closest('.a-stage')?.querySelectorAll<HTMLImageElement>('img.a-object') ?? [])] : []
    return autoMotion(element, {
      play: clock.play,
      pause: clock.pause,
      reset: () => { clock.reset(); setFrame(stillFrame) },
    }, images)
  }, [ref, frames, loop, loopFrom, stillFrame, waitForImage])
  return frame
}
