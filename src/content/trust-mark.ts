import { HELVETICA_WIDTHS } from './helvetica-metrics'
import { ICON_ART, WORDMARK_ART } from './stamp-art'

/**
 * The shared primitives of VORA's verification components (content/verification-blocks.ts builds the components from them): the colours, text measurement, the layout item
 * types that both the PDF painter (server/pdf/trust-mark.ts) and the browser preview (components/trust/TrustMark.tsx) draw, and the corporate lockup: the approved A icon,
 * the approved wordmark, a rule and PT SATU ARAH INTERNATIONAL, in one red, with no box. Lengths are PDF points, the origin is the top left and y grows downwards.
 */
export const RED = '#B43E31'
export const INK = '#101720'
export const SLATE = '#64717C'
export const CORPORATE_NAME = 'PT SATU ARAH INTERNATIONAL'

export type Lang = 'id' | 'en'

export type MarkItem =
  | { t: 'qr'; x: number; y: number; size: number }
  | { t: 'icon' | 'wordmark'; x: number; y: number; w: number; h: number }
  | { t: 'rule'; x: number; y: number; w: number; h: number; color?: string }
  | { t: 'text'; x: number; y: number; text: string; size: number; bold: boolean; color: string; /** Spread the letters so that the text is exactly this wide. */ fit?: number; /** Monospaced (Courier) instead of Helvetica. */ font?: 'sans' | 'mono' }
  /** A rounded rectangle: filled, outlined, or both. */
  | { t: 'frame'; x: number; y: number; w: number; h: number; r: number; stroke: string; width: number; fill?: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  /** A line icon from content/glyphs.ts, drawn as strokes in `size` x `size`. */
  | { t: 'glyph'; name: import('./glyphs').GlyphName; x: number; y: number; size: number; color: string }
  /** The approved wordmark in its primary two-tone colours (navy letters, red counterform). */
  | { t: 'logo'; x: number; y: number; w: number; h: number }
  /** A clickable area (PDF link annotation) that opens `url`. It draws nothing. */
  | { t: 'hotspot'; x: number; y: number; w: number; h: number; url: string }

export interface MarkLayout {
  width: number; height: number; qrSize: number; items: MarkItem[]; kind: 'signature-1' | 'signature-2' | 'footer'
  /** A preview is labelled just above the box; the label is not part of the box, so a preview and the finished component occupy exactly the same space. */
  badge?: { text: string; size: number }
}

/** About 20 mm: under this a QR code of this density stops scanning reliably from a printout. */
export const MIN_QR_POINTS = 56.7
/** The icon is this fraction of the lockup's width (the approved reference has it a little over half). */
export const ICON_RATIO = 0.58
const CAP_HEIGHT = 0.718      // Helvetica Bold

const [, , iw, ih] = ICON_ART.viewBox
const [, , ww, wh] = WORDMARK_ART.viewBox
export const ICON_ASPECT = ih / iw
export const WORDMARK_ASPECT = wh / ww

/** Courier: every glyph is 600/1000 em wide. */
export const monoWidth = (text: string, size: number): number => [...text].length * 0.6 * size

/** The width of text in a standard PDF font, as the PDF will set it. A character the font cannot print counts (and prints) as "?". */
export function textWidth(text: string, size: number, bold = false): number {
  const table = HELVETICA_WIDTHS[bold ? 'bold' : 'regular']
  let total = 0
  for (const ch of text) total += table[ch] ?? table['?']
  return (total * size) / 1000
}

/** Text the standard fonts can print: anything else becomes "?" (what the PDF would do), line breaks and runs of spaces become one space. */
export function printable(value: string): string {
  const table = HELVETICA_WIDTHS.regular
  let out = ''
  for (const ch of value.replace(/\s+/g, ' ').trim()) out += table[ch] !== undefined ? ch : '?'
  return out
}

/** `text`, cut with "..." so that it is at most `max` wide. */
export function fitText(text: string, size: number, bold: boolean, max: number): string {
  let t = printable(text)
  if (textWidth(t, size, bold) <= max) return t
  while (t.length > 1 && textWidth(`${t}...`, size, bold) > max) t = t.slice(0, -1)
  return `${t.trimEnd()}...`
}

export interface Lockup { width: number; height: number; items: MarkItem[] }

/** The corporate lockup at `lw` wide, from (x, y): icon, wordmark, a rule as wide as the wordmark, and the name spread to the same width. Close together, so that it reads as one stamp. */
export function lockup(lw: number, iconRatio: number, x = 0, y = 0): Lockup {
  const iconW = lw * iconRatio, iconH = iconW * ICON_ASPECT
  const wordH = lw * WORDMARK_ASPECT
  const g1 = lw * 0.03, g2 = lw * 0.028, ruleH = Math.max(0.6, lw * 0.0105), g3 = lw * 0.028
  // The name is set at the size where its natural width is the lockup's width, as in the approved reference (so it is not letter-spaced at all).
  const size = lw / textWidth(CORPORATE_NAME, 1, true)
  const cap = CAP_HEIGHT * size
  let cy = y
  const items: MarkItem[] = []
  items.push({ t: 'icon', x: x + (lw - iconW) / 2, y: cy, w: iconW, h: iconH }); cy += iconH + g1
  items.push({ t: 'wordmark', x, y: cy, w: lw, h: wordH }); cy += wordH + g2
  items.push({ t: 'rule', x, y: cy, w: lw, h: ruleH }); cy += ruleH + g3
  items.push({ t: 'text', x, y: cy + cap, text: CORPORATE_NAME, size, bold: true, color: RED, fit: lw }); cy += cap
  return { width: lw, height: cy - y, items }
}

/** The lockup's height is proportional to its width: this is the width at which it is `height` tall. */
export const lockupWidthForHeight = (height: number, iconRatio = ICON_RATIO): number => (height * 100) / lockup(100, iconRatio).height     // measured at 100 wide: the hairline rule has a minimum thickness
