import { evolvePath, getLength, getPointAtLength } from '@remotion/paths'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { MARK_ART, LOGO_ART } from '@/content/vora-motion-art'
import { INK, LogoParts, MARK, MarkBuild, PAPER, RED, SLATE, clamp, ease, ramp } from './shared'

/**
 * The About page's compositions, one for each thing a visitor does with them: look and press (hero), scroll (routes), choose (gaps, constellation, build) and touch (mark field).
 * All of them are pure functions of the frame and their props. The ones that answer a visitor receive what they did as props (where the pointer is, when a button was pressed, the
 * frame at which a choice was made) and animate from there; the Player runs on, so "since when" is simply `frame - changedAt`.
 */
export interface Pulse { x: number; y: number; f: number }

const W2PI = Math.PI * 2
const ringsOf = (pulses: Pulse[], frame: number, life = 50) =>
  pulses.filter((p) => frame - p.f >= 0 && frame - p.f < life).flatMap((p) => [0, 8].map((late) => ({ ...p, age: frame - p.f - late, life }))).filter((r) => r.age >= 0 && r.age < r.life)

/* ------------------------------------------------------------------------------------------------ 1 · hero: the logo arrives, then answers the pointer */
export const HERO = { w: 1600, h: 900, frames: 36000, settled: 120 }
/** Where the logo sits in a hero box of W x H units: 62% of the width on a wide box, 84% on a tall one (a phone), a little below the middle so that the copy above stays clear. */
export const heroLogo = (W: number, H: number) => {
  const w = H / W > 1.05 ? W * 0.84 : W * 0.62, h = (w * 384) / 1780
  const cy = H > W ? H * 0.74 : Math.max(H * 0.7, 560 + h / 2)
  return { x: (W - w) / 2, y: cy - h / 2, w, h, cy }
}
export const TAGLINE = 'BRINGING THE WORLD WITHIN REACH.'
export const AboutHero: React.FC<{ px?: number; py?: number; pulses?: Pulse[]; revealAt?: number | null; still?: boolean }> = ({ px = 0, py = 0, pulses = [], revealAt = null, still = false }) => {
  const frame = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  const mx = still ? 0 : px, my = still ? 0 : py
  const wipe = ramp(frame, 6, 48), lift = ramp(frame, 6, 30)
  const wedge = interpolate(frame, [40, 60], [0, 1], clamp)
  const settled = ramp(frame, 84, 116)
  const flash = pulses.reduce((m, p) => Math.max(m, frame - p.f >= 0 && frame - p.f < 26 ? 1 - (frame - p.f) / 26 : 0), 0)
  const breathe = 1 + settled * 0.04 * Math.sin(((frame - 84) / 30) * (W2PI / 1.9)) + flash * 0.16
  const glint = frame < 130 ? -1 : ((frame - 130) % 240) / 240
  const rings = still ? [] : ringsOf(pulses, frame)
  const { w: lw, h: lh, cy } = heroLogo(W, H)
  // The line under the logo arrives when the visitor presses the logo (a visitor who asked for less motion has it from the start).
  const reveal = still ? 1 : revealAt == null ? 0 : ramp(frame - revealAt, 0, 34)
  const tall = H / W > 1.05, fs = tall ? lw * 0.04 : lw * 0.026
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="hero-follow"><stop offset="0" stopColor={RED} stopOpacity=".34" /><stop offset=".55" stopColor={RED} stopOpacity=".08" /><stop offset="1" stopColor={RED} stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx={W / 2 + mx * W * 0.35} cy={cy + my * H * 0.2} r={W * 0.26} fill="url(#hero-follow)" opacity={ramp(frame, 40, 90)} />
        <g style={{ translate: `${-mx * 9}px ${-my * 6}px` }}>
          <svg x={(W - lw) / 2} y={cy - lh / 2} width={lw} height={lh} viewBox="132 164 1780 384" style={{ overflow: 'visible' }}>
            <g style={{ translate: `${mx * 16}px ${my * 10}px` }}>
              <LogoParts id="hero" wipe={wipe} lift={lift} wedge={wedge} tone="dark" breathe={breathe} glint={glint} />
            </g>
          </svg>
        </g>
        <g opacity={reveal} style={{ translate: `0px ${(1 - reveal) * 18}px` }}>
          <rect x={W / 2 - lw * 0.07 * reveal} y={cy + lh / 2 + fs * 1.5} width={lw * 0.14 * reveal} height={4} fill={RED} />
          <text x={W / 2} y={cy + lh / 2 + fs * 3.4} textAnchor="middle" fontSize={fs} fontWeight={500} fill="#C9D0D4" fontFamily="inherit" textLength={lw * 0.96} lengthAdjust="spacing">{TAGLINE}</text>
        </g>
        {rings.map((r, i) => (
          <circle key={i} cx={r.x} cy={r.y} r={24 + r.age * 10} fill="none" stroke={RED} strokeWidth={interpolate(r.age, [0, r.life], [5, 0.6])} opacity={0.75 * (1 - r.age / r.life)} />
        ))}
      </svg>
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------------------------------------ 2 · routes: drawn by the scroll */
export const ROUTES = { w: 1200, h: 800, frames: 300 }
const HUB = { x: 600, y: 400 }
const ROUTE_D = [
  'M 600 400 C 650 250, 790 150, 1010 110',
  'M 600 400 C 760 400, 930 360, 1120 420',
  'M 600 400 C 700 520, 840 640, 980 700',
  'M 600 400 C 480 520, 360 640, 210 690',
  'M 600 400 C 450 330, 300 210, 120 150',
]
export const AboutRoutes: React.FC = () => {
  const frame = useCurrentFrame()
  const p = frame / (ROUTES.frames - 1)
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${ROUTES.w} ${ROUTES.h}`} width="100%" height="100%" style={{ display: 'block' }}>
        {ROUTE_D.map((d, i) => {
          const drawn = interpolate(p, [0.34 + i * 0.08, 0.34 + i * 0.08 + 0.3], [0, 1], { ...clamp, easing: ease })
          const ev = evolvePath(drawn, d), len = getLength(d), end = getPointAtLength(d, len) ?? HUB
          const lap = (((p * 5 + i * 0.37) % 1) + 1) % 1
          const car = getPointAtLength(d, len * lap) ?? HUB
          return (
            <g key={d}>
              <path d={d} fill="none" stroke={RED} strokeWidth={3} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={0.85} />
              <circle cx={end.x} cy={end.y} r={11 * drawn} fill={INK} stroke={PAPER} strokeWidth={4} />
              {drawn > 0.98 ? <circle cx={car.x} cy={car.y} r={6} fill={RED} stroke="#fff" strokeWidth={2.5} /> : null}
            </g>
          )
        })}
        <svg x={HUB.x - 130} y={HUB.y - 80} width={260} height={(260 * 590) / 1048} viewBox={MARK.vb.join(' ')} style={{ overflow: 'visible' }}>
          <MarkBuild id="routes" left={ramp(p, 0.0, 0.22)} right={ramp(p, 0.2, 0.42)} wedge={interpolate(p, [0.4, 0.52], [0, 1], clamp)} />
        </svg>
      </svg>
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------------------------------------ 3 · constellation: five services, one chosen */
export const CONSTELLATION = {
  w: 1200, h: 900, frames: 36000,
  nodes: [{ x: 600, y: 130 }, { x: 960, y: 340 }, { x: 830, y: 720 }, { x: 370, y: 720 }, { x: 240, y: 340 }],
}
const CHub = { x: 600, y: 450 }
const curve = (n: { x: number; y: number }) => {
  const mx = (CHub.x + n.x) / 2, my = (CHub.y + n.y) / 2, dx = n.x - CHub.x, dy = n.y - CHub.y
  return `M ${CHub.x} ${CHub.y} Q ${mx - dy * 0.16} ${my + dx * 0.16} ${n.x} ${n.y}`
}
export const AboutConstellation: React.FC<{ active?: number; prev?: number; changedAt?: number; still?: boolean }> = ({ active = 0, prev = 0, changedAt = 0, still = false }) => {
  const frame = useCurrentFrame()
  const t = still ? 1 : ramp(frame - changedAt, 0, 18)
  const emphasis = (i: number) => (i === active ? t : i === prev ? 1 - t : 0)
  const settled = ramp(frame, 60, 90)
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${CONSTELLATION.w} ${CONSTELLATION.h}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs><radialGradient id="cn-glow"><stop offset="0" stopColor={RED} stopOpacity=".5" /><stop offset="1" stopColor={RED} stopOpacity="0" /></radialGradient></defs>
        {[0, 1, 2].map((k) => {
          const a = (((frame + k * 40) % 120) / 120)
          return <circle key={k} cx={CHub.x} cy={CHub.y} r={90 + a * 160} fill="none" stroke={RED} strokeWidth={1.5} opacity={0.22 * (1 - a) * settled} />
        })}
        {CONSTELLATION.nodes.map((n, i) => {
          const d = curve(n), e = emphasis(i)
          const drawn = interpolate(frame, [4 + i * 9, 4 + i * 9 + 56], [0, 1], { ...clamp, easing: ease })
          const ev = evolvePath(drawn, d), len = getLength(d)
          const car = getPointAtLength(d, len * (((frame / 70) % 1 + 1) % 1)) ?? CHub
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={e > 0 ? RED : 'rgba(255,255,255,.3)'} strokeWidth={2 + 3 * e} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={0.4 + 0.6 * e} />
              {e > 0.05 && drawn > 0.98 ? <circle cx={car.x} cy={car.y} r={7 * e} fill={RED} stroke="#fff" strokeWidth={2.5} /> : null}
            </g>
          )
        })}
        {CONSTELLATION.nodes.map((n, i) => {
          const e = emphasis(i), pop = ramp(frame, 40 + i * 9, 60 + i * 9)
          return (
            <g key={i} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%', scale: pop * (1 + 0.22 * e) }}>
              <circle cx={n.x} cy={n.y} r={52 * e} fill="url(#cn-glow)" opacity={e} />
              <circle cx={n.x} cy={n.y} r={36} fill={e > 0.5 ? RED : '#1B2633'} stroke="#fff" strokeOpacity={0.55 + 0.45 * e} strokeWidth={2.5} />
              <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize={22} fontWeight={700} fill="#fff" fontFamily="inherit">{String(i + 1).padStart(2, '0')}</text>
            </g>
          )
        })}
        <svg x={CHub.x - 140} y={CHub.y - 80} width={280} height={(280 * 590) / 1048} viewBox={MARK.vb.join(' ')} style={{ overflow: 'visible' }}>
          <MarkBuild id="cn" left={ramp(frame, 0, 26)} right={ramp(frame, 8, 34)} wedge={interpolate(frame, [26, 44], [0, 1], clamp)} tone="dark" breathe={1 + settled * 0.04 * Math.sin((frame / 30) * (W2PI / 1.9))} />
        </svg>
      </svg>
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------------------------------------ 4 · build: the A is assembled by three commitments */
export const BUILD = { w: 1000, h: 700, frames: 36000 }
const targets = (step: number) => [step >= 1 ? 1 : 0, step >= 2 ? 1 : 0, step >= 3 ? 1 : 0]
export const AboutBuild: React.FC<{ step?: number; prev?: number; changedAt?: number; still?: boolean }> = ({ step = 0, prev = 0, changedAt = 0, still = false }) => {
  const frame = useCurrentFrame()
  const from = targets(prev), to = targets(step)
  const age = still ? 99 : frame - changedAt
  const mix = (i: number, span: number) => interpolate(ramp(age, 0, span), [0, 1], [from[i], to[i]])
  const ignited = step >= 3 && prev < 3 ? age : -1
  const x0 = 180, w = 640, h = (w * 590) / 1048, y0 = 150
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${BUILD.w} ${BUILD.h}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs><radialGradient id="bd-glow"><stop offset="0" stopColor={RED} stopOpacity=".55" /><stop offset="1" stopColor={RED} stopOpacity="0" /></radialGradient></defs>
        {ignited >= 0 && ignited < 60 ? (
          <>
            <circle cx={x0 + w * 0.5} cy={y0 + h * 0.78} r={interpolate(ignited, [0, 36], [60, 330], clamp)} fill="url(#bd-glow)" opacity={interpolate(ignited, [0, 8, 56], [0, 1, 0], clamp)} />
            <circle cx={x0 + w * 0.5} cy={y0 + h * 0.78} r={interpolate(ignited, [2, 44], [40, 430], clamp)} fill="none" stroke={RED} strokeWidth={interpolate(ignited, [2, 44], [8, 1], clamp)} opacity={interpolate(ignited, [2, 10, 44], [0, 0.6, 0], clamp)} />
          </>
        ) : null}
        <svg x={x0} y={y0} width={w} height={h} viewBox={MARK.vb.join(' ')} style={{ overflow: 'visible' }}>
          <path d={MARK_ART.ink.d} fill="none" stroke={SLATE} strokeOpacity={0.45} strokeWidth={5} strokeDasharray="16 14" strokeDashoffset={-(frame * 0.6)} />
          <MarkBuild id="bd" left={mix(0, 24)} right={mix(1, 24)} wedge={mix(2, 34)} tone="light" breathe={1 + 0.03 * Math.sin((frame / 30) * (W2PI / 1.9)) * (to[2] ? 1 : 0)} />
        </svg>
        {[0, 1, 2].map((i) => {
          const lit = interpolate(ramp(age, 0, 20), [0, 1], [from[i], to[i]])
          const cx = 330 + i * 170
          return <circle key={i} cx={cx} cy={600} r={9 + 4 * lit} fill={lit > 0.5 ? RED : 'transparent'} stroke={lit > 0.5 ? RED : SLATE} strokeWidth={2.5} />
        })}
      </svg>
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------------------------------------ 6 · field: a grid of marks that answers a touch */
export const FIELD = { w: 1600, h: 700, frames: 36000, cell: 100 }
export const AboutField: React.FC<{ px?: number; py?: number; pulses?: Pulse[]; still?: boolean }> = ({ px = -9999, py = -9999, pulses = [], still = false }) => {
  const frame = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  const reveal = ramp(frame, 0, 50)
  const cols = Math.ceil(W / FIELD.cell), rows = Math.ceil(H / FIELD.cell)
  const x0 = (W - cols * FIELD.cell) / 2, y0 = (H - rows * FIELD.cell) / 2
  const cells: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x0 + c * FIELD.cell + FIELD.cell / 2, cy = y0 + r * FIELD.cell + FIELD.cell / 2
      const d = still ? 9999 : Math.hypot(cx - px, cy - py)
      let influence = Math.max(0, 1 - d / 280)
      if (!still) for (const p of pulses) { const a = frame - p.f; if (a >= 0 && a < 60) influence += 0.9 * Math.max(0, 1 - Math.abs(Math.hypot(cx - p.x, cy - p.y) - a * 30) / 90) * (1 - a / 60) }
      influence = Math.min(1.4, influence)
      const wave = 0.5 + 0.5 * Math.sin(frame / 36 + (c + r * 0.6) * 0.55)
      const entry = ramp(frame, (c + r) * 1.6, (c + r) * 1.6 + 26) * reveal
      const k = (54 / MARK.width) * (1 + 0.85 * influence) * entry
      cells.push(
        <g key={`${r}-${c}`} transform={`translate(${cx} ${cy}) scale(${k}) translate(${-MARK.apexX} ${-(MARK.top + MARK.base) / 2})`}>
          <path d={MARK_ART.ink.d} fill="#fff" opacity={0.13 + 0.1 * wave + 0.6 * Math.min(1, influence)} />
          <path d={MARK_ART.red.d} fill={RED} opacity={0.3 + 0.7 * Math.min(1, influence + 0.2 * wave)} />
        </g>,
      )
    }
  }
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>{cells}</svg>
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------------------------------------ 7 · gaps: four routes with a break in them, closed one by one */
export const GAPS = { w: 1200, h: 720, frames: 36000, gap: [540, 660] as const, x0: 100, x1: 1100, top: 70, bottom: 650 }
const rowY = (i: number, n: number) => (n <= 1 ? 360 : GAPS.top + (i * (GAPS.bottom - GAPS.top)) / (n - 1))
/** `resolvedAt[i]` is the frame at which row i was closed (-1: still open); `focus` is the row the visitor is looking at. */
export const AboutGaps: React.FC<{ resolvedAt?: number[]; focus?: number; still?: boolean }> = ({ resolvedAt = [-1, -1, -1, -1, -1, -1], focus = -1, still = false }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${GAPS.w} ${GAPS.h}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        {resolvedAt.map((_, i) => {
          const y = rowY(i, resolvedAt.length)
          const drawn = ramp(frame, 4 + i * 10, 52 + i * 10)
          const at = still ? -1 : resolvedAt[i] ?? -1
          const closed = still ? 0 : at >= 0 ? ramp(frame - at, 0, 22) : 0
          const age = at >= 0 ? frame - at : -1
          const dim = focus < 0 || focus === i ? 1 : 0.45
          const left = GAPS.x0 + (GAPS.gap[0] - GAPS.x0) * drawn, right = GAPS.gap[1] + (GAPS.x1 - GAPS.gap[1]) * drawn
          const lap = ((frame / 80 + i * 0.23) % 1 + 1) % 1
          const cx = GAPS.x0 + (GAPS.x1 - GAPS.x0) * lap
          const mid = (GAPS.gap[0] + GAPS.gap[1]) / 2
          const warn = 0.5 + 0.5 * Math.sin(frame / 7 + i)
          return (
            <g key={i} opacity={dim} style={{ transition: 'none' }}>
              <circle cx={GAPS.x0} cy={y} r={11 * drawn} fill={INK} stroke={PAPER} strokeWidth={4} />
              <circle cx={GAPS.x1} cy={y} r={11 * ramp(frame, 40 + i * 10, 56 + i * 10)} fill={INK} stroke={PAPER} strokeWidth={4} />
              <line x1={GAPS.x0} y1={y} x2={left} y2={y} stroke={closed > 0 ? RED : SLATE} strokeWidth={4} strokeLinecap="round" />
              <line x1={GAPS.gap[1]} y1={y} x2={right} y2={y} stroke={closed > 0 ? RED : SLATE} strokeWidth={4} strokeLinecap="round" />
              <line x1={GAPS.gap[0]} y1={y} x2={GAPS.gap[0] + (GAPS.gap[1] - GAPS.gap[0]) * closed} y2={y} stroke={RED} strokeWidth={4} strokeLinecap="round" />
              {closed < 1 && drawn > 0.9 ? (
                <g opacity={(1 - closed) * (0.55 + 0.45 * warn)}>
                  <circle cx={mid} cy={y} r={22} fill="none" stroke={RED} strokeWidth={2.5} strokeDasharray="5 6" />
                  <text x={mid} y={y + 8} textAnchor="middle" fontSize={26} fontWeight={800} fill={RED} fontFamily="inherit">!</text>
                </g>
              ) : null}
              {age >= 0 && age < 40 ? <circle cx={mid} cy={y} r={20 + age * 5} fill="none" stroke={RED} strokeWidth={interpolate(age, [0, 40], [6, 0.5])} opacity={1 - age / 40} /> : null}
              {closed >= 1 ? <circle cx={cx} cy={y} r={7} fill={RED} stroke="#fff" strokeWidth={3} /> : null}
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}

export { LOGO_ART }
