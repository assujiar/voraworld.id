import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { LOGO_ART } from '@/content/vora-motion-art'
import { LogoParts, RED, clamp } from './shared'

/**
 * The footer logo, a loop that never jumps: 180 frames at 30 fps, and every movement in it is periodic or starts and ends out of sight, so frame 179 flows into frame 0.
 *   the wedge of the A breathes twice per loop and sends a thin ring outward on each breath (a beacon); a soft light crosses the letters once; and under the logo a carrier
 *   runs along a hairline route, fading in at one end and out at the other. At frame 0 everything is at rest, which is the frame shown to a visitor who asked for less motion.
 */
export const FOOTER_LOGO = { w: 890, h: 222, frames: 180 }
const WEDGE = { cx: 1580, cy: 470 }                 // the red wedge's centre, in the logo's own coordinates
export const FooterLogoLoop: React.FC = () => {
  const frame = useCurrentFrame()
  const t = frame / FOOTER_LOGO.frames
  const breathe = 1 + 0.06 * Math.sin(t * Math.PI * 4)
  const beat = (frame % 90) / 90
  const ringOpacity = 0.55 * Math.sin(Math.PI * beat) * (1 - beat)
  const glow = 0.5 - 0.5 * Math.cos(t * Math.PI * 4)
  const glint = interpolate(frame, [40, 104], [0, 1], clamp)
  const carrier = FOOTER_LOGO.w * t
  const [vx, vy, vw, vh] = LOGO_ART.viewBox
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${FOOTER_LOGO.w} ${FOOTER_LOGO.h}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id="ft-glow"><stop offset="0" stopColor={RED} stopOpacity=".55" /><stop offset="1" stopColor={RED} stopOpacity="0" /></radialGradient>
        </defs>
        <svg x={0} y={0} width={FOOTER_LOGO.w} height={(FOOTER_LOGO.w * vh) / vw} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{ overflow: 'visible' }}>
          <circle cx={WEDGE.cx} cy={WEDGE.cy} r={210} fill="url(#ft-glow)" opacity={0.1 + 0.3 * glow} />
          <circle cx={WEDGE.cx} cy={WEDGE.cy} r={90 + 230 * beat} fill="none" stroke={RED} strokeWidth={7 - 5 * beat} opacity={ringOpacity} />
          <LogoParts id="ft" wipe={1} lift={1} wedge={1} tone="dark" breathe={breathe} glint={glint} />
        </svg>
        <line x1={0} y1={FOOTER_LOGO.h - 8} x2={FOOTER_LOGO.w} y2={FOOTER_LOGO.h - 8} stroke="#fff" strokeOpacity={0.16} strokeWidth={2} strokeLinecap="round" />
        <circle cx={carrier} cy={FOOTER_LOGO.h - 8} r={5.5} fill={RED} opacity={Math.sin(Math.PI * t)} />
      </svg>
    </AbsoluteFill>
  )
}
