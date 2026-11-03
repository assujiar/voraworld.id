import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { frameClock } from '@/lib/frame-clock'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('automatic frame clock', () => {
  it('settles on the exact final frame without resetting to a partial logo', () => {
    const frames: number[] = [], clock = frameClock({ frames: 180, onFrame: frame => frames.push(frame) })
    clock.play(); vi.advanceTimersByTime(7000)
    expect(frames.at(-1)).toBe(179)
    expect(vi.getTimerCount()).toBe(0)
    clock.play(); vi.advanceTimersByTime(500)
    expect(frames.at(-1)).toBe(179)
  })
  it('pauses time and resumes at the same point', () => {
    let frame = 0
    const clock = frameClock({ frames: 300, onFrame: value => { frame = value } })
    clock.play(); vi.advanceTimersByTime(1000); clock.pause()
    const paused = frame
    vi.advanceTimersByTime(10000); expect(frame).toBe(paused)
    clock.play(); vi.advanceTimersByTime(1000)
    expect(frame).toBeGreaterThan(paused + 25)
    expect(frame).toBeLessThan(65)
    clock.reset(); expect(vi.getTimerCount()).toBe(0)
  })
  it('continues a quiet ambient loop after a one-time intro', () => {
    let frame = 0
    const clock = frameClock({ frames: 360, loop: true, loopFrom: 180, onFrame: value => { frame = value } })
    clock.play(); vi.advanceTimersByTime(13500)
    expect(frame).toBeGreaterThanOrEqual(180)
    expect(frame).toBeLessThan(230)
    clock.reset()
  })
  it('finishes even when animation-frame callbacks stall', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    let frame = 0
    const clock = frameClock({ frames: 180, onFrame: value => { frame = value } })
    clock.play(); vi.advanceTimersByTime(6500)
    expect(frame).toBe(179)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not schedule or redraw twice when play is called repeatedly', () => {
    const draw = vi.fn(), clock = frameClock({ frames: 180, onFrame: draw })
    clock.play(); clock.play(); clock.play()
    expect(draw).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(2)
    clock.reset(); expect(vi.getTimerCount()).toBe(0)
  })
})
