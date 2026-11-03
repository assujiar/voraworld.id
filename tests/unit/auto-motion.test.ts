import { afterEach, describe, expect, it, vi } from 'vitest'
import { autoMotion } from '@/lib/auto-motion'

class Signal {
  events = new Map<string, Set<() => void>>()
  addEventListener(name: string, fn: () => void) { const handlers = this.events.get(name) ?? new Set(); handlers.add(fn); this.events.set(name, handlers) }
  removeEventListener(name: string, fn: () => void) { this.events.get(name)?.delete(fn) }
  emit(name: string) { this.events.get(name)?.forEach(fn => fn()) }
}
function environment(reduced = false) {
  const media = Object.assign(new Signal(), { matches: reduced })
  const doc = Object.assign(new Signal(), { visibilityState: 'visible' })
  let intersection: (entries: Array<{ isIntersecting: boolean }>) => void = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('window', { matchMedia: () => media })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof intersection) { intersection = callback } observe() {} disconnect = disconnect })
  const el = { dataset: {} } as HTMLElement
  const callbacks = { play: vi.fn(), pause: vi.fn(), reset: vi.fn() }
  return { media, doc, el, callbacks, intersect: (value: boolean) => intersection([{ isIntersecting: value }]), disconnect }
}
afterEach(() => vi.unstubAllGlobals())
describe('autoplay lifecycle', () => {
  it('waits for a slow image to load AND decode before starting, without a click', async () => {
    const e = environment(), img = Object.assign(new Signal(), { complete: false, naturalWidth: 100, decode: vi.fn() })
    let decoded: () => void = () => {}
    img.decode.mockReturnValue(new Promise<void>(resolve => { decoded = resolve }))
    const stop = autoMotion(e.el, e.callbacks, [img as unknown as HTMLImageElement])
    e.intersect(true)
    expect(e.callbacks.play).not.toHaveBeenCalled()
    img.emit('load'); await Promise.resolve()
    expect(e.callbacks.play).not.toHaveBeenCalled()
    decoded(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(e.callbacks.play).toHaveBeenCalledTimes(1)
    expect(e.el.dataset.motionState).toBe('running')
    stop()
  })
  it('pauses off screen and in a hidden tab, then resumes automatically', () => {
    const e = environment(), stop = autoMotion(e.el, e.callbacks)
    e.intersect(true); expect(e.callbacks.play).toHaveBeenCalledTimes(1)
    e.intersect(false); expect(e.callbacks.pause).toHaveBeenCalledTimes(1)
    e.intersect(true); expect(e.callbacks.play).toHaveBeenCalledTimes(2)
    e.doc.visibilityState = 'hidden'; e.doc.emit('visibilitychange')
    expect(e.callbacks.pause).toHaveBeenCalledTimes(2)
    e.doc.visibilityState = 'visible'; e.doc.emit('visibilitychange')
    expect(e.callbacks.play).toHaveBeenCalledTimes(3)
    stop()
  })
  it('respects reduced motion initially and when it changes during playback', () => {
    const e = environment(true), stop = autoMotion(e.el, e.callbacks)
    e.intersect(true); expect(e.callbacks.play).not.toHaveBeenCalled()
    expect(e.el.dataset.motionState).toBe('reduced')
    e.media.matches = false; e.media.emit('change'); expect(e.callbacks.play).toHaveBeenCalledTimes(1)
    e.media.matches = true; e.media.emit('change'); expect(e.callbacks.reset).toHaveBeenCalledTimes(2)
    expect(e.el.dataset.motionState).toBe('reduced')
    stop()
  })
  it('does not start when a component unmounts while its image is pending', async () => {
    const e = environment(), img = Object.assign(new Signal(), { complete: false, naturalWidth: 100, decode: vi.fn() })
    const stop = autoMotion(e.el, e.callbacks, [img as unknown as HTMLImageElement])
    e.intersect(true); stop(); img.emit('load')
    await Promise.resolve(); await Promise.resolve()
    expect(e.callbacks.play).not.toHaveBeenCalled()
    expect(e.disconnect).toHaveBeenCalled()
    expect(e.el.dataset.motionState).toBeUndefined()
  })
  it('allows cached images and gracefully handles decode errors', async () => {
    const e = environment(), img = { complete: true, naturalWidth: 100, decode: vi.fn().mockRejectedValue(new Error('decode failed')), removeEventListener: vi.fn() }
    const stop = autoMotion(e.el, e.callbacks, [img as unknown as HTMLImageElement])
    e.intersect(true)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(e.callbacks.play).toHaveBeenCalledTimes(1)
    stop()
  })
})
