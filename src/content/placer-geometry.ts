import { placeSeal, placementFractions } from './seal-layout'

/**
 * The arithmetic of the placement editor, with no DOM in it, so that it is tested like any other function. Everything is in PDF points on the page as the reader
 * sees it, or in CSS pixels of the drawn page; `scale` is CSS pixels per point (drawn width / page width in points) and never depends on the device pixel ratio
 * (the canvas bitmap is scaled by it, the overlay is not).
 */
export interface Dims { w: number; h: number }
export interface PageBox { pw: number; ph: number; cssW: number }
export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1))
export const scaleOf = (box: PageBox) => box.cssW / box.pw

/** A pointer position (client pixels) -> a point of the page in CSS pixels from its top left, given the page element's rectangle. */
export function pagePoint(clientX: number, clientY: number, rect: { left: number; top: number }): { x: number; y: number } {
  return { x: clientX - rect.left, y: clientY - rect.top }
}

/**
 * Where the mark's top left goes (as stored fractions) when it is held by the point (`holdX`, `holdY`) of itself, in CSS pixels, and the pointer is at `p`.
 * Kept inside the page by the same rule the PDF uses.
 */
export function dragTo(box: PageBox, dims: Dims, p: { x: number; y: number }, hold: { x: number; y: number }): { x: number; y: number } {
  const s = scaleOf(box)
  const r = placeSeal(box.pw, box.ph, dims, 'custom', (p.x - hold.x) / box.cssW, (p.y - hold.y) / (box.ph * s))
  return placementFractions(box.pw, box.ph, r)
}

/** A tap places the mark centred on the tap. */
export const tapTo = (box: PageBox, dims: Dims, p: { x: number; y: number }) => dragTo(box, dims, p, { x: (dims.w * scaleOf(box)) / 2, y: (dims.h * scaleOf(box)) / 2 })

/** Moves the mark by (dx, dy) points (right and down are positive), kept inside the page. */
export function nudge(box: PageBox, dims: Dims, at: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  const r = placeSeal(box.pw, box.ph, dims, 'custom', at.x + dx / box.pw, at.y + dy / box.ph)
  return placementFractions(box.pw, box.ph, r)
}

/** The mark's rectangle in CSS pixels from the page's top left, for stored fractions or a corner. */
export function cssRect(box: PageBox, dims: Dims, corner: string, pos: { x: number; y: number }): { left: number; top: number; width: number; height: number } {
  const s = scaleOf(box)
  const r = placeSeal(box.pw, box.ph, dims, corner, corner === 'custom' ? pos.x : null, corner === 'custom' ? pos.y : null)
  return { left: r.left * s, top: (box.ph - r.bottom - r.h) * s, width: r.w * s, height: r.h * s }
}

/**
 * Where the floating copy of the mark goes while a finger is down: above the finger when there is room (a finger and a hand hide what is under and below it), else
 * below it, and always inside the visible window (`view`), horizontally centred on the finger and pulled back from the edges.
 */
export function loupePosition(finger: { x: number; y: number }, view: { width: number; height: number }, loupe: { w: number; h: number }, gap = 28, margin = 8): { left: number; top: number; side: 'above' | 'below' } {
  const left = Math.min(Math.max(finger.x - loupe.w / 2, margin), Math.max(margin, view.width - loupe.w - margin))
  const above = finger.y - gap - loupe.h
  if (above >= margin) return { left, top: above, side: 'above' }
  const below = finger.y + gap
  return { left, top: Math.min(below, Math.max(margin, view.height - loupe.h - margin)), side: 'below' }
}

/** What a person is told after placing: the position as they can picture it. */
export function describePlacement(page: number, pos: { x: number; y: number }): { en: string; id: string } {
  const x = Math.round(pos.x * 100), y = Math.round(pos.y * 100)
  return { en: `Page ${page}: ${x}% from the left, ${y}% from the top`, id: `Halaman ${page}: ${x}% dari kiri, ${y}% dari atas` }
}
