import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { LOGO_ART } from '@/content/vora-motion-art'
import { LogoParts, RED, clamp } from './shared'

/**
 * The footer logo, a loop that never jumps: 210 frames at 30 fps (seven seconds), one small story that happens once per loop and then rests.
 *   1. a soft red wave crosses the letters from the left, and a red dot travels along a hairline under them at the same pace (the route);
 *   2. where the wave reaches the red wedge of the A, the wedge rises, a glow opens behind it and two rings leave it (arrival);
 *   3. everything settles and the logo rests until the loop begins again.
 * Frame 0 and frame 209 are the same picture, the plain logo, which is also what a visitor who asked for less motion sees. The canvas is larger than the logo (PAD) so that the
 * rings and the glow have room; CSS in feedback.css gives the extra room back with negative margins, so the logo sits where the old image sat.
 */
export const PAD = { x: 130, top: 110, bottom: 70 }
const LOGO_BOX = { w: 890, h: 222 }                 // the room the logo takes in the page
export const FOOTER_LOGO = { w: LOGO_BOX.w + 2 * PAD.x, h: PAD.top + LOGO_BOX.h + PAD.bottom, frames: 210 }

const [AX, AY, AW, AH] = LOGO_ART.viewBox
const S = LOGO_BOX.w / AW                            // canvas units per art unit
const WEDGE = { x: 1580, y: 470 }                    // the red wedge's centre in art units
const SWEEP = { from: 24, to: 112 }                  // frames in which the wave and the dot travel
const BAND = { from: -0.14, to: 1.06, width: 0.24 }  // wave centre, as a share of the logo width, and its width
const wedgeShare = (WEDGE.x - AX) / AW
const travel = (f: number) => interpolate(f, [SWEEP.from, SWEEP.to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })
const shareAt = (p: number) => BAND.from + (BAND.to - BAND.from) * p
// the frame at which the wave's centre is over the wedge
const ARRIVAL = (() => { for (let f = SWEEP.from; f <= SWEEP.to; f++) if (shareAt(travel(f)) >= wedgeShare) return f; return SWEEP.to })()

const ring = (frame: number, start: number) => {
  const k = clamp01((frame - start) / 62)
  const e = Easing.out(Easing.cubic)(k)
  return { r: 60 + 360 * e, op: k <= 0 || k >= 1 ? 0 : 0.8 * Math.pow(1 - k, 1.4) * Math.min(1, k * 8), w: 14 - 9 * e }
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export const FooterLogoLoop: React.FC = () => {
  const frame = useCurrentFrame()
  const p = travel(frame)
  const bandX = AX + AW * shareAt(p)
  const bandW = AW * BAND.width
  const moving = frame > SWEEP.from && frame < SWEEP.to
  const q = clamp01((frame - ARRIVAL) / 48)
  const rise = Math.sin(Math.PI * q)                                        // the wedge rises and settles
  const glow = Math.pow(Math.sin(Math.PI * clamp01((frame - ARRIVAL + 4) / 86)), 1.4)
  const waveOpacity = moving ? 0.9 * Math.min(1, (frame - SWEEP.from) / 8, (SWEEP.to - frame) / 10) : 0
  const lineY = PAD.top + LOGO_BOX.h - 8
  const carrierX = PAD.x + LOGO_BOX.w * clamp01(shareAt(p))
  const carrierOpacity = moving ? Math.min(1, (frame - SWEEP.from) / 8, (SWEEP.to - frame) / 10) : 0
  const track = 0.2 * Math.sin(Math.PI * clamp01((frame - 14) / (SWEEP.to - 14 + 20)))
  const rings = [ring(frame, ARRIVAL + 2), ring(frame, ARRIVAL + 20)]
  const skew = Math.tan((18 * Math.PI) / 180)
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${FOOTER_LOGO.w} ${FOOTER_LOGO.h}`} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="ft-glow"><stop offset="0" stopColor={RED} stopOpacity=".6" /><stop offset=".55" stopColor={RED} stopOpacity=".18" /><stop offset="1" stopColor={RED} stopOpacity="0" /></radialGradient>
          <linearGradient id="ft-band" gradientUnits="userSpaceOnUse" x1={bandX - bandW / 2} x2={bandX + bandW / 2} y1="0" y2="0" gradientTransform={`translate(${skew * (AY + AH / 2)} 0) skewX(-18)`}>
            <stop offset="0" stopColor="#000" /><stop offset=".5" stopColor="#fff" /><stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id="ft-wave" maskUnits="userSpaceOnUse" x={AX - 60} y={AY - 60} width={AW + 120} height={AH + 120}><rect x={AX - 60} y={AY - 60} width={AW + 120} height={AH + 120} fill="url(#ft-band)" /></mask>
          <linearGradient id="ft-trail" gradientUnits="userSpaceOnUse" x1={carrierX - 320} x2={carrierX} y1="0" y2="0"><stop offset="0" stopColor={RED} stopOpacity="0" /><stop offset="1" stopColor={RED} stopOpacity=".95" /></linearGradient>
        </defs>
        <svg x={PAD.x} y={PAD.top} width={LOGO_BOX.w} height={AH * S} viewBox={`${AX} ${AY} ${AW} ${AH}`} style={{ overflow: 'visible' }}>
          <circle cx={WEDGE.x} cy={WEDGE.y} r={300} fill="url(#ft-glow)" opacity={0.95 * glow} />
          {rings.map((g, i) => <circle key={i} cx={WEDGE.x} cy={WEDGE.y} r={g.r} fill="none" stroke={RED} strokeWidth={g.w} opacity={g.op} />)}
          <LogoParts id="ft" wipe={1} lift={1} wedge={1} tone="dark" breathe={1 + 0.26 * rise} />
          <path d={LOGO_ART.ink.d} fill={RED} fillRule="evenodd" mask="url(#ft-wave)" opacity={waveOpacity} />
        </svg>
        <line x1={PAD.x} y1={lineY} x2={PAD.x + LOGO_BOX.w} y2={lineY} stroke="#fff" strokeOpacity={track} strokeWidth={6} strokeLinecap="round" />
        <line x1={Math.max(PAD.x, carrierX - 320)} y1={lineY} x2={carrierX} y2={lineY} stroke="url(#ft-trail)" strokeWidth={7} strokeLinecap="round" opacity={carrierOpacity} />
        <circle cx={carrierX} cy={lineY} r={12} fill={RED} opacity={carrierOpacity} />
      </svg>
    </AbsoluteFill>
  )
}
