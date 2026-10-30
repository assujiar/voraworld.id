import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths'

/**
 * The hero's route drawing, a Remotion composition (1000 x 1000, 30 fps, 10 s, looping). Four routes leave one hub, draw themselves one after another,
 * and a carrier keeps travelling along each; the whole fades before the loop restarts. It is abstract on purpose: no place is named and no route is
 * claimed, it only says "freight moves along lines". Everything is driven by the frame number, so the same code renders in the Player and in a still.
 */
export const ROUTE_FRAMES = 300
export const ROUTE_STILL_FRAME = 190

// The hub is the centre: the globe stands on it, and the routes leave from under the render and carry on over the paper.
const HUB = { x: 500, y: 470 }
const ROUTES = [
  { d: 'M 500 470 C 600 300, 760 170, 930 120', start: 8 },
  { d: 'M 500 470 C 700 520, 850 640, 950 800', start: 26 },
  { d: 'M 500 470 C 400 660, 320 800, 270 925', start: 44 },
  { d: 'M 500 470 C 380 330, 290 230, 130 160', start: 62 },
]
const RED = '#B43E31'
const INK = '#101720'

export const RouteLines: React.FC = () => {
  const frame = useCurrentFrame()
  const whole = interpolate(frame, [0, 10, 250, 292], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity: whole }}>
      <svg viewBox="0 0 1000 1000" width="100%" height="100%" fill="none">
        {ROUTES.map((r, i) => {
          const drawn = interpolate(frame, [r.start, r.start + 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1) })
          const evolution = evolvePath(drawn, r.d)
          const length = getLength(r.d)
          const lap = ((frame - r.start - 40 + i * 37) % 150 + 150) % 150 / 150
          const carrier = getPointAtLength(r.d, length * lap) ?? HUB
          const end = getPointAtLength(r.d, length) ?? HUB
          const landed = interpolate(frame, [r.start + 70, r.start + 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <g key={r.d}>
              <path d={r.d} stroke={RED} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} strokeDasharray={evolution.strokeDasharray} strokeDashoffset={evolution.strokeDashoffset} />
              <circle cx={end.x} cy={end.y} r={7 * landed} fill={INK} stroke="#F7F7F4" strokeWidth={3} />
              {frame > r.start + 40 ? <circle cx={carrier.x} cy={carrier.y} r={5} fill={RED} stroke="#fff" strokeWidth={2} /> : null}
            </g>
          )
        })}
        <circle cx={HUB.x} cy={HUB.y} r={9} fill={INK} stroke="#F7F7F4" strokeWidth={4} />
        {[0, 1].map((k) => {
          const t = ((frame + k * 45) % 90) / 90
          return <circle key={k} cx={HUB.x} cy={HUB.y} r={9 + 34 * t} stroke={RED} strokeWidth={1.6} opacity={0.5 * (1 - t)} />
        })}
      </svg>
    </AbsoluteFill>
  )
}
