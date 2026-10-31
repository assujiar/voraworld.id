/**
 * The line icons of the verification blocks, as path data in a 24 x 24 box (M, L, C and Z only, so that the PDF and the screen draw the very same shapes). They are drawn as
 * strokes with round caps in VORA red; nothing here is a font glyph, so nothing can turn into a missing-character square.
 */
export type GlyphName = 'document' | 'calendar' | 'user' | 'briefcase' | 'link' | 'external' | 'mail'

const circle = (cx: number, cy: number, r: number) => {
  const k = r * 0.5523
  return `M${cx} ${cy - r}C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}Z`
}
/** A rounded rectangle outline. */
const rrect = (x: number, y: number, w: number, h: number, r: number) => {
  const k = r * 0.4477, x2 = x + w, y2 = y + h
  return `M${x + r} ${y}L${x2 - r} ${y}C${x2 - k} ${y} ${x2} ${y + k} ${x2} ${y + r}L${x2} ${y2 - r}C${x2} ${y2 - k} ${x2 - k} ${y2} ${x2 - r} ${y2}L${x + r} ${y2}C${x + k} ${y2} ${x} ${y2 - k} ${x} ${y2 - r}L${x} ${y + r}C${x} ${y + k} ${x + k} ${y} ${x + r} ${y}Z`
}

export const GLYPHS: Record<GlyphName, string> = {
  document: 'M6 3L14 3L19 8L19 21L6 21Z' + 'M14 3L14 8L19 8' + 'M9 13L16 13' + 'M9 17L16 17',
  calendar: rrect(3.5, 5, 17, 16, 2) + 'M3.5 10L20.5 10' + 'M8 3L8 7' + 'M16 3L16 7',
  user: circle(12, 8, 4) + 'M4.5 21C4.5 16.5 7.8 14 12 14C16.2 14 19.5 16.5 19.5 21',
  briefcase: rrect(3, 7, 18, 13, 2) + 'M9 7L9 4.5L15 4.5L15 7' + 'M3 13L21 13' + 'M10.5 13L10.5 15L13.5 15L13.5 13',
  link: 'M10 8L7 8C4.8 8 3 9.8 3 12C3 14.2 4.8 16 7 16L10 16' + 'M14 8L17 8C19.2 8 21 9.8 21 12C21 14.2 19.2 16 17 16L14 16' + 'M8.5 12L15.5 12',
  external: 'M14 4L20 4L20 10' + 'M20 4L11 13' + 'M18 14L18 20L4 20L4 6L10 6',
  mail: rrect(3, 5, 18, 14, 2) + 'M3.5 7L12 13.5L20.5 7',
}
export const GLYPH_BOX = 24
export const GLYPH_STROKE = 1.7      // in the 24-unit box
