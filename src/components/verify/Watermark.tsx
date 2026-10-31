import { ICON_ART, WORDMARK_ART, type Art } from '@/content/stamp-art'
import { lockup, RED } from '@/content/trust-mark'

/**
 * The repeating VORA corporate watermark of the verification pages: the approved stamp (icon, wordmark, rule, PT SATU ARAH INTERNATIONAL, one red, no box) tiled in a
 * staggered, slightly rotated pattern. It is an <svg> element, not a CSS background, so that it prints even where "background graphics" is off, and it is a pattern
 * (patternTransform) so that it repeats without seams at every size. It sits behind (layer `back`) or, much fainter, in front of (layer `front`) the information, never
 * takes a click or a touch (pointer-events: none), is hidden from assistive technology, and cannot be selected.
 *
 * A WATERMARK IS A DETERRENT, NOT PROOF. It does not stop a screenshot from being edited and it establishes nothing: the findings on the page and the file check do.
 */
const LOCK_W = 100
const LOCK_H = LOCK_W * 0.684                       // the lockup is 118 wide and 80.7 high, whatever its size
/** One cell holds one stamp with a narrow margin; a tile is two cells across and two down, the second stamp in the opposite corner, so the pattern is close and staggered. */
const CELL_W = 116, CELL_H = 82
const TILE_W = CELL_W * 2, TILE_H = CELL_H * 2
const ROTATE = -24

function Art({ art, x, y, w, h }: { art: Art; x: number; y: number; w: number; h: number }) {
  const [vx, vy, vw, vh] = art.viewBox
  return <g transform={`translate(${x} ${y}) scale(${w / vw} ${h / vh}) translate(${-vx} ${-vy})`}>{art.paths.map((p, i) => <path key={i} d={p.d} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />)}</g>
}

/** One lockup, laid out by the same function the PDF mark uses (no QR code: the watermark carries no address and nothing to scan). */
function Stamp({ x, y }: { x: number; y: number }) {
  const l = lockup(LOCK_W, 0.58, x, y)
  return (
    <g fill={RED}>
      {l.items.map((i, k) => {
        if (i.t === 'icon') return <Art key={k} art={ICON_ART} x={i.x} y={i.y} w={i.w} h={i.h} />
        if (i.t === 'wordmark') return <Art key={k} art={WORDMARK_ART} x={i.x} y={i.y} w={i.w} h={i.h} />
        if (i.t === 'rule') return <rect key={k} x={i.x} y={i.y} width={i.w} height={i.h} />
        if (i.t === 'text') return <text key={k} x={i.x} y={i.y} fontFamily="Helvetica, Arial, sans-serif" fontWeight={700} fontSize={i.size} textLength={i.fit} lengthAdjust="spacing">{i.text}</text>
        return null
      })}
    </g>
  )
}

export function Watermark({ layer, id }: { layer: 'back' | 'front'; id: string }) {
  const pid = `vf-wm-${id}`
  return (
    <svg className={`vf-wm vf-wm-${layer}`} aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" data-watermark={layer}>
      <defs>
        {/* Two stamps per tile, the second shifted half a tile across and down: a staggered pattern that repeats exactly. */}
        <pattern id={pid} width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse" patternTransform={`rotate(${ROTATE})`}>
          <Stamp x={(CELL_W - LOCK_W) / 2} y={(CELL_H - LOCK_H) / 2} />
          <Stamp x={CELL_W + (CELL_W - LOCK_W) / 2} y={CELL_H + (CELL_H - LOCK_H) / 2} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  )
}
