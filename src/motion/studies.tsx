import { useId } from 'react'
import { LOGO_ART, MARK_ART } from '@/content/vora-motion-art'

/** Adapted from the user's VORA Motion Studies source, studies 01, 02, 04 and 06 only.
 * The approved paths are unchanged. No backgrounds, replacement lettering or invented logos. */
export type BrandStudy = 'trace' | 'origin' | 'editorial' | 'signal'
export interface BrandFrameProps { frame: number; study: BrandStudy; tone?: 'light' | 'dark'; mark?: boolean }
export const STUDY_NUMBER: Record<BrandStudy, string> = { trace: '01', origin: '02', editorial: '04', signal: '06' }
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const progress = (frame: number, from: number, to: number) => clamp((frame - from) / (to - from))
const out = (frame: number, from: number, to: number) => 1 - Math.pow(1 - progress(frame, from, to), 3)
const smooth = (frame: number, from: number, to: number) => { const value = progress(frame, from, to); return value * value * (3 - 2 * value) }

export function BrandFrame({ frame: f, study, tone = 'light', mark = false }: BrandFrameProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ink = tone === 'dark' ? '#FFFFFF' : '#101720', red = '#B43E31'
  const art = mark ? MARK_ART : LOGO_ART, [x, y, w, h] = art.viewBox
  const rule = art.ink.evenOdd ? 'evenodd' : 'nonzero'
  const quiet = study === 'origin' && mark && f >= 180
  const phase = (f - 180) / 180 * Math.PI * 2
  if (study === 'signal') {
    const phase = f / 180 * Math.PI * 2
    return <svg viewBox="0 0 320 320" width="100%" height="100%" aria-hidden="true" focusable="false" data-study-frame={f}>
      <circle cx="160" cy="160" r="130" fill="none" stroke={ink} opacity=".14" />
      <circle cx="160" cy="160" r="130" fill="none" stroke={red} strokeWidth="2.5" strokeDasharray="80 737" transform={`rotate(${-90 + f / 180 * 360} 160 160)`} />
      <circle cx={160 + 130 * Math.cos(phase - Math.PI / 2)} cy={160 + 130 * Math.sin(phase - Math.PI / 2)} r="4.5" fill={red} />
      <svg x="67" y="107.5" width="186" height="105" viewBox={MARK_ART.viewBox.join(' ')} overflow="visible">
        <path d={MARK_ART.ink.d} fill={ink} />
        <path d={MARK_ART.red.d} fill={red} transform={`translate(0 ${-12 * (1 - Math.cos(phase))})`} opacity={.84 + .16 * (1 + Math.cos(phase)) / 2} />
      </svg>
    </svg>
  }
  return <svg viewBox={art.viewBox.join(' ')} width="100%" height="100%" aria-hidden="true" focusable="false" data-study-frame={f}>
    {quiet ? <g data-logo-study="06">
      <circle cx="500" cy="260" r="520" fill="none" stroke={ink} opacity=".09" strokeWidth="2" />
      <circle cx="500" cy="260" r="520" fill="none" stroke={red} opacity=".55" strokeWidth="5" strokeDasharray="320 2948" transform={`rotate(${-90 + (f - 180) / 180 * 360} 500 260)`} />
      <circle cx={500 + 520 * Math.cos(phase - Math.PI / 2)} cy={260 + 520 * Math.sin(phase - Math.PI / 2)} r="8" fill={red} opacity=".7" />
    </g> : null}
    {study === 'trace' ? <>
      <path d={art.ink.d} fill="none" stroke={ink} strokeWidth="2.8" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - smooth(f, 5, 86)} opacity={1 - out(f, 83, 108)} fillRule={rule} />
      <path d={art.ink.d} fill={ink} opacity={smooth(f, 66, 96)} fillRule={rule} />
      <path d={art.red.d} fill="none" stroke={red} strokeWidth="3" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - smooth(f, 45, 81)} opacity={1 - out(f, 81, 99)} />
      <path d={art.red.d} fill={red} transform={`translate(0 ${22 * (1 - out(f, 75, 101))})`} opacity={smooth(f, 75, 99)} fillRule={rule} />
    </> : study === 'origin' ? <>
      <defs><clipPath id={`${id}-reveal`}><rect x={x + w * (1 - out(f, 27, 94))} y={y} width={w * out(f, 27, 94)} height={h} /></clipPath></defs>
      <path d={art.ink.d} fill={ink} fillRule={rule} clipPath={`url(#${id}-reveal)`} />
      <g transform={`translate(${-w * .3 * (1 - out(f, 10, 66))} ${-h * .2 * (1 - out(f, 10, 66)) - (quiet ? 12 * (1 - Math.cos(phase)) : 0)}) translate(${mark ? 500 : 1580} 440) scale(${1 + .55 * (1 - out(f, 10, 66))}) translate(${mark ? -500 : -1580} -440)`} opacity={out(f, 0, 12)}><path d={art.red.d} fill={red} fillRule={rule} /></g>
    </> : <>
      {Array.from({ length: 5 }, (_, index) => {
        const q = out(f, 8 + index * 6, 53 + index * 6)
        return <g key={index}><defs><clipPath id={`${id}-slice-${index}`}><rect x={x - w * .2} y={y + index * h / 5} width={w * 1.4} height={h / 5 + 1} /></clipPath></defs><g clipPath={`url(#${id}-slice-${index})`}><path d={art.ink.d} fill={ink} fillRule={rule} transform={`translate(${(index % 2 === 0 ? -.13 : .13) * w * (1 - q)} 0)`} opacity={q} /></g></g>
      })}
      <path d={art.red.d} fill={red} transform={`translate(0 ${h * .135 * (1 - out(f, 59, 82))})`} opacity={out(f, 59, 82)} fillRule={rule} />
    </>}
  </svg>
}
