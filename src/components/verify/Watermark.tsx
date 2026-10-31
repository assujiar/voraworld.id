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
const LOCK_W = 84
const LOCK_H = LOCK_W * 0.684                       // the lockup is 118 wide and 80.7 high, whatever its size
const ICON_W = 38                                    // the icon above the web address
/** One cell holds one stamp with a narrow margin. A row alternates the VORA stamp and the web address; the next row is shifted by half a cell and starts with the other one. */
const CELL_W = 96, CELL_H = 66
const TILE_W = CELL_W * 2, TILE_H = CELL_H * 2
const ROTATE = -24
const ADDRESS = 'voraworld.id'

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

/** The web address as a stamp of the same kind: the icon, a red rule, the address, one red, no box. */
function Site({ x, y }: { x: number; y: number }) {
  const [, , vw, vh] = ICON_ART.viewBox
  const ih = (ICON_W * vh) / vw
  return (
    <g fill={RED}>
      <Art art={ICON_ART} x={x + (LOCK_W - ICON_W) / 2} y={y} w={ICON_W} h={ih} />
      <rect x={x} y={y + ih + 5} width={LOCK_W} height={1.1} />
      <text x={x} y={y + ih + 5 + 1.1 + 11} fontFamily="Helvetica, Arial, sans-serif" fontWeight={700} fontSize={11} textLength={LOCK_W} lengthAdjust="spacing">{ADDRESS}</text>
    </g>
  )
}
const SITE_H = (ICON_W * 0.5629) + 5 + 1.1 + 11      // the icon's own proportions (68.44 x 38.53), then the rule and the line of text

/** A stamp or the address, drawn twice (once a tile to the left) when it runs over the tile's right edge, so that the pattern has no gap there. */
function Cell({ kind, col, row }: { kind: 'vora' | 'site'; col: number; row: number }) {
  const h = kind === 'vora' ? LOCK_H : SITE_H
  const x = col * CELL_W + (CELL_W - LOCK_W) / 2, y = row * CELL_H + (CELL_H - h) / 2
  const draw = (dx: number) => (kind === 'vora' ? <Stamp x={x + dx} y={y} /> : <Site x={x + dx} y={y} />)
  return <>{draw(0)}{x + LOCK_W > TILE_W ? draw(-TILE_W) : null}</>
}

export function Watermark({ layer, id }: { layer: 'back' | 'front'; id: string }) {
  const pid = `vf-wm-${id}`
  return (
    <svg className={`vf-wm vf-wm-${layer}`} aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" data-watermark={layer}>
      <defs>
        {/* Four cells to a tile, the second row shifted by half a cell: VORA, address / address, VORA, repeating exactly in both directions. */}
        <pattern id={pid} width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse" patternTransform={`rotate(${ROTATE})`}>
          <Cell kind="vora" col={0} row={0} />
          <Cell kind="site" col={1} row={0} />
          <Cell kind="site" col={0.5} row={1} />
          <Cell kind="vora" col={1.5} row={1} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  )
}
