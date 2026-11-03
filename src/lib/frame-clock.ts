export interface FrameClockOptions { frames: number; fps?: number; loop?: boolean; loopFrom?: number; onFrame: (frame: number) => void }

/** Elapsed-time SVG clock. No media/audio context, user gesture or scroll position.
 * A low-frequency watchdog lets a reveal settle even when a browser throttles RAF.
 * Both schedulers stop completely when the visibility controller pauses the scene. */
export function frameClock({ frames, fps = 30, loop = false, loopFrom = 0, onFrame }: FrameClockOptions) {
  let elapsed = 0, started = 0, playing = false, finished = false, lastFrame = -1, lastRaf = 0
  let raf: number | undefined, watchdog: ReturnType<typeof setInterval> | undefined
  const stopSchedulers = () => {
    if (raf !== undefined) cancelAnimationFrame(raf)
    if (watchdog !== undefined) clearInterval(watchdog)
    raf = undefined; watchdog = undefined
  }
  const draw = () => {
    const total = Math.floor(Math.max(0, elapsed + (playing ? Date.now() - started : 0)) * fps / 1000)
    const frame = total >= frames ? loop ? loopFrom + (total - loopFrom) % (frames - loopFrom) : frames - 1 : total
    if (frame !== lastFrame) { lastFrame = frame; onFrame(frame) }
    if (!loop && total >= frames - 1) { playing = false; finished = true; stopSchedulers() }
  }
  const tick = () => {
    if (!playing) return
    lastRaf = Date.now(); draw()
    if (playing) raf = requestAnimationFrame(tick)
  }
  return {
    play() {
      if (playing || finished) return
      started = Date.now(); lastRaf = started; playing = true; draw()
      raf = requestAnimationFrame(tick)
      watchdog = setInterval(() => { if (playing && Date.now() - lastRaf > 180) draw() }, 100)
    },
    pause() {
      if (playing) elapsed += Math.max(0, Date.now() - started)
      playing = false; stopSchedulers()
    },
    reset() { playing = false; finished = false; elapsed = 0; lastFrame = -1; stopSchedulers() },
  }
}
