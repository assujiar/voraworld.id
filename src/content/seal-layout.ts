/**
 * Where a seal sits on a page. One function decides it, and both the PDF that is made and the preview where the person drags the seal use it, so the
 * preview is the placement. Lengths are PDF points; positions are measured on the page as the reader sees it (rotation already applied).
 */
export const SEAL_SIZES: Record<string, { w: number; h: number; text: number }> = { small: { w: 196, h: 66, text: 5.4 }, medium: { w: 270, h: 108, text: 6.6 } }
export const SEAL_MARGIN = 22
/** The seal may be dragged right up to this distance from the edge. */
const EDGE = 6

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi))

/** "0.5" -> 0.5 when it is a number from 0 to 1, otherwise null. */
export function fraction(value: string | undefined): number | null {
  if (value === undefined || !/^(0|1|0?\.\d{1,6}|1\.0{1,6})$/.test(value.trim())) return null
  const n = Number(value)
  return n >= 0 && n <= 1 ? n : null
}

/**
 * The seal's rectangle: `left` and `bottom` (origin bottom left) and its size, for a page `vw` x `vh` points. `corner` is one of the four corners
 * or "custom", in which case `posX` and `posY` (0 to 1, measured from the page's top left to the seal's top left) say where it was dropped.
 */
export function placeSeal(vw: number, vh: number, size: string, corner: string, posX: number | null, posY: number | null): { left: number; bottom: number; w: number; h: number } {
  const { w, h } = SEAL_SIZES[size] ?? SEAL_SIZES.medium
  if (corner === 'custom' && posX !== null && posY !== null) {
    const left = clamp(posX * vw, EDGE, vw - w - EDGE)
    const top = clamp(posY * vh, EDGE, vh - h - EDGE)
    return { left, bottom: vh - top - h, w, h }
  }
  return { left: corner.endsWith('left') ? SEAL_MARGIN : vw - SEAL_MARGIN - w, bottom: corner.startsWith('top') ? vh - SEAL_MARGIN - h : SEAL_MARGIN, w, h }
}

/** Which pages (zero-based) carry the seal. `one` is a page the person chose; it must exist. */
export function sealedPages(total: number, which: string, pageNumber: number | null): number[] {
  if (which === 'first') return [0]
  if (which === 'all') return Array.from({ length: total }, (_, i) => i)
  if (which === 'one') {
    if (!pageNumber || pageNumber < 1 || pageNumber > total) throw new RangeError(`page ${pageNumber} of ${total}`)
    return [pageNumber - 1]
  }
  return [total - 1]
}
