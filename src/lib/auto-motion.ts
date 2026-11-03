/** Autoplay is gated by decoded artwork, visibility and the visitor's motion preference.
 * Visibility only pauses/resumes time; scrolling and clicking never drive the animation. */
export interface AutoMotionCallbacks {
  play: () => void
  pause: () => void
  reset: () => void
}

export function autoMotion(element: HTMLElement, callbacks: AutoMotionCallbacks, images: HTMLImageElement[] = []) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const cleanups: Array<() => void> = []
  let disposed = false, visible = typeof IntersectionObserver === 'undefined', ready = images.length === 0
  let running = false, reduced = false
  const sync = () => {
    if (disposed) return
    if (media.matches) {
      if (!reduced) callbacks.reset()
      reduced = true; running = false; element.dataset.motionState = 'reduced'
      return
    }
    reduced = false
    const active = ready && visible && document.visibilityState !== 'hidden'
    element.dataset.motionState = active ? 'running' : !ready ? 'waiting-image' : 'paused'
    if (active && !running) callbacks.play()
    if (!active && running) callbacks.pause()
    running = active
  }
  const imageReady = (image: HTMLImageElement) => new Promise<void>((resolve) => {
    let settled = false
    const finish = async () => {
      if (settled) return
      settled = true
      image.removeEventListener('load', finish); image.removeEventListener('error', finish)
      try { if (image.naturalWidth && typeof image.decode === 'function') await image.decode() } catch { /* Failed artwork never hides the surrounding content. */ }
      resolve()
    }
    if (image.complete) void finish()
    else {
      image.addEventListener('load', finish); image.addEventListener('error', finish)
      cleanups.push(() => { image.removeEventListener('load', finish); image.removeEventListener('error', finish); resolve() })
    }
  })
  if (images.length) void Promise.all(images.map(imageReady)).then(() => { ready = true; sync() })
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting; sync()
  }, { threshold: 0.05 })
  observer?.observe(element)
  media.addEventListener('change', sync)
  document.addEventListener('visibilitychange', sync)
  sync()
  return () => {
    disposed = true; observer?.disconnect(); cleanups.forEach(cleanup => cleanup())
    media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync)
    callbacks.reset(); delete element.dataset.motionState
  }
}
