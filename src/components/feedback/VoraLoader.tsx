import { useId } from 'react'
import { LOGO_ART, MARK_ART, type MotionArt } from '@/content/vora-motion-art'

/**
 * The VORA loading motion, made of the approved logo and A icon exactly as the brand files hold them (nothing is redrawn):
 *   logo   the wordmark wipes in from the left while it rises a little; the red wedge of the A then ignites from its base;
 *   mark   the A icon builds up from its foot; the wedge ignites in the same way.
 * Once it has arrived the motion that stays is small and slow (the wedge breathes, a soft light crosses the letters now and then), so that a long wait is not tiring.
 * Drawn with CSS animation only (see feedback.css, `.vl-*`): it needs no script, it stands still for people who ask for less motion, and it is hidden from assistive technology
 * apart from its label.
 */
export function VoraLoader({ variant = 'logo', width = 220, label = 'Memuat…' }: { variant?: 'logo' | 'mark'; width?: number; label?: string }) {
  const id = useId().replace(/:/g, '')
  const art: MotionArt = variant === 'logo' ? LOGO_ART : MARK_ART
  const [x, y, w, h] = art.viewBox
  const rule = (e: boolean) => (e ? 'evenodd' : 'nonzero')
  return (
    <span className={`vl vl-${variant}`} role="img" aria-label={label} style={{ width }}>
      <svg viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id={`${id}-reveal`}><rect className="vl-reveal" x={x} y={y} width={w} height={h} /></clipPath>
          <clipPath id={`${id}-all`}>
            <path d={art.ink.d} clipRule={rule(art.ink.evenOdd)} />
            <path d={art.red.d} clipRule={rule(art.red.evenOdd)} />
          </clipPath>
          <linearGradient id={`${id}-glint`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${id}-reveal)`}><path className="vl-ink" d={art.ink.d} fill="#101720" fillRule={rule(art.ink.evenOdd)} /></g>
        <path className="vl-red" d={art.red.d} fill="#B43E31" fillRule={rule(art.red.evenOdd)} />
        <g clipPath={`url(#${id}-all)`}><rect className="vl-shine" x={x} y={y - h * 0.1} width={w * 0.22} height={h * 1.2} fill={`url(#${id}-glint)`} /></g>
      </svg>
    </span>
  )
}

/** A whole-page wait: the logo in the middle with a thin line running under it. It appears only after a moment, so that a page that is quick never flashes it. */
export function PageLoader({ variant = 'logo', label = 'Memuat halaman…' }: { variant?: 'logo' | 'mark'; label?: string }) {
  return (
    <div className="vl-page" role="status" aria-live="polite">
      <VoraLoader variant={variant} width={variant === 'logo' ? 240 : 96} label={label} />
      <span className="vl-line" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
