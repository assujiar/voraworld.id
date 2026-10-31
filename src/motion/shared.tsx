import { Easing, interpolate } from 'remotion'
import { LOGO_ART, MARK_ART, type MotionArt } from '@/content/vora-motion-art'

/**
 * Shared pieces of the About page's motion. Every composition is a pure function of the frame number and its props (no timers, no randomness), so the same code plays in the
 * browser's Player and renders in the Remotion Studio. The artwork is the approved logo and A icon, path data used as it is: only its colours (the reverse logo is white on navy)
 * and the way it appears change.
 */
export const RED = '#B43E31'
export const INK = '#101720'
export const PAPER = '#F7F7F4'
export const SLATE = '#64717C'
export const ease = Easing.bezier(0.22, 0.8, 0.2, 1)
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export type Tone = 'light' | 'dark'
/** Navy letters on paper, white letters on navy: the approved logo and its reverse. */
export const inkOf = (tone: Tone) => (tone === 'dark' ? '#FFFFFF' : INK)

/** 0 to 1 over `[from, to]`, eased. */
export const ramp = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], { ...clamp, easing: ease })

/** The A icon's own geometry (its artwork spans x 0..1000, y -27..520; the apex is at x 500). */
export const MARK = { vb: MARK_ART.viewBox, apexX: 500, top: -27, base: 520, width: 1000, height: 547 }

/**
 * The A icon in three parts that can arrive one by one: the left leg, the right leg (each rising from the foot) and the red wedge (igniting from its base, with a little overshoot).
 * `id` keeps the clip paths of several icons on one page apart.
 */
export const MarkBuild: React.FC<{ id: string; left: number; right: number; wedge: number; tone?: Tone; breathe?: number }> = ({ id, left, right, wedge, tone = 'light', breathe = 1 }) => {
  const rise = (p: number) => ({ y: MARK.base - (MARK.height + 8) * p, height: (MARK.height + 8) * p + 12 })
  const L = rise(left), R = rise(right)
  const overshoot = wedge <= 0 ? 0 : wedge >= 1 ? 1 : Easing.out(Easing.back(2.2))(wedge)
  return (
    <>
      <defs>
        <clipPath id={`${id}-l`}><rect x={-30} width={530} y={L.y} height={L.height} /></clipPath>
        <clipPath id={`${id}-r`}><rect x={500} width={530} y={R.y} height={R.height} /></clipPath>
      </defs>
      <path d={MARK_ART.ink.d} fill={inkOf(tone)} clipPath={`url(#${id}-l)`} />
      <path d={MARK_ART.ink.d} fill={inkOf(tone)} clipPath={`url(#${id}-r)`} />
      <g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%', scale: 0.12 + 0.88 * overshoot * breathe, opacity: Math.min(1, wedge * 6) }}>
        <path d={MARK_ART.red.d} fill={RED} />
      </g>
    </>
  )
}

/** The whole logo (wordmark and A), the red wedge on its own so that it can ignite. `wipe` 0..1 reveals the letters from the left. */
export const LogoParts: React.FC<{ id: string; wipe: number; lift?: number; wedge: number; tone?: Tone; breathe?: number; glint?: number }> = ({ id, wipe, lift = 0, wedge, tone = 'light', breathe = 1, glint = -1 }) => {
  const art: MotionArt = LOGO_ART
  const [x, y, w, h] = art.viewBox
  const overshoot = wedge <= 0 ? 0 : wedge >= 1 ? 1 : Easing.out(Easing.back(2.2))(wedge)
  return (
    <>
      <defs>
        <clipPath id={`${id}-wipe`}><rect x={x} y={y - 20} width={w * wipe} height={h + 40} /></clipPath>
        <clipPath id={`${id}-all`}><path d={art.ink.d} clipRule="evenodd" /><path d={art.red.d} clipRule="evenodd" /></clipPath>
        <linearGradient id={`${id}-glint`} x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <g clipPath={`url(#${id}-wipe)`}><g style={{ translate: `0px ${(1 - lift) * h * 0.08}px`, opacity: lift }}><path d={art.ink.d} fill={inkOf(tone)} fillRule="evenodd" /></g></g>
      <g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%', scale: 0.12 + 0.88 * overshoot * breathe, opacity: Math.min(1, wedge * 6) }}>
        <path d={art.red.d} fill={RED} fillRule="evenodd" />
      </g>
      {glint >= 0 ? (
        <g clipPath={`url(#${id}-all)`}><rect x={x + (w * 1.3) * glint - w * 0.2} y={y - 30} width={w * 0.16} height={h + 60} fill={`url(#${id}-glint)`} transform={`skewX(-18)`} style={{ transformOrigin: `${x + w * 1.3 * glint}px 0px` }} /></g>
      ) : null}
    </>
  )
}
