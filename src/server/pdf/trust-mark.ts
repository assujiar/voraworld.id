import { PDFString, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb, setCharacterSpacing, setFillingColor, setStrokingColor, setLineWidth, setLineCap, setLineJoin, stroke, fillAndStroke, LineCapStyle, LineJoinStyle, StandardFonts, fill, degrees, PDFOperator, PDFOperatorNames, closePath, lineTo, moveTo, appendBezierCurve, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'
import { ICON_ART, WORDMARK_ART, type Art } from '../../content/stamp-art'
import { qrMatrix, qrPath } from '../../content/trust-qr'
import { GLYPHS, GLYPH_BOX, GLYPH_STROKE } from '../../content/glyphs'
import { monoWidth, printable, textWidth, INK, RED, type MarkItem, type MarkLayout } from '../../content/trust-mark'

/**
 * Draws a VORA Document Verification Mark (the layout decided in content/trust-mark.ts) onto a pdf-lib page. The artwork is the path data of the approved SVGs,
 * filled in one colour; no coordinate of it is changed. The QR code is vector, on its own white square.
 */
export interface MarkFonts { regular: PDFFont; bold: PDFFont; mono: PDFFont; monoBold: PDFFont }

export async function embedMarkFonts(doc: PDFDocument): Promise<MarkFonts> {
  return { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold), mono: await doc.embedFont(StandardFonts.Courier), monoBold: await doc.embedFont(StandardFonts.CourierBold) }
}

const rgbOf = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)

/** Where a point of the mark lands on the page: `x` right and `y` DOWN from the mark's top left (the layout's own axes), in page coordinates. */
export type PointMap = (x: number, y: number) => { x: number; y: number }

/** The placement on an upright page: the mark's top left is at (left, top), measured from the page's bottom left. */
export const upright = (left: number, top: number): PointMap => (x, y) => ({ x: left + x, y: top - y })

/** A page as the reader sees it, whatever its /Rotate and crop box say. */
export class PageView {
  private x: number; private y: number; private pw: number; private ph: number
  readonly angle: number; readonly width: number; readonly height: number
  constructor(page: PDFPage) {
    const crop = page.getCropBox()
    this.x = crop.x; this.y = crop.y; this.pw = crop.width; this.ph = crop.height
    this.angle = ((Math.round(page.getRotation().angle / 90) * 90) % 360 + 360) % 360
    this.width = this.angle % 180 ? this.ph : this.pw
    this.height = this.angle % 180 ? this.pw : this.ph
  }
  /** A point of the page as the reader sees it (origin bottom left) -> the same point in the page's own coordinates. */
  at(vx: number, vy: number): { x: number; y: number } {
    switch (this.angle) {
      case 90: return { x: this.x + this.pw - vy, y: this.y + vx }
      case 180: return { x: this.x + this.pw - vx, y: this.y + this.ph - vy }
      case 270: return { x: this.x + vy, y: this.y + this.ph - vx }
      default: return { x: this.x + vx, y: this.y + vy }
    }
  }
  /** The mark's top left is at (left, top) of the page as the reader sees it, origin bottom left. */
  map(left: number, top: number): PointMap { return (x, y) => this.at(left + x, top - y) }
}

type Paint = 'fill' | 'evenodd' | 'stroke' | 'fillstroke'

/** `M L C Q Z` path data (the approved SVGs, the QR code and the line icons use only these) -> PDF operators, with `at` placing each point. Q becomes the equivalent cubic. */
function pathOperators(d: string, at: (x: number, y: number) => { x: number; y: number }, paint: Paint): PDFOperator[] {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
  const ops: PDFOperator[] = []
  let i = 0, cmd = '', cx = 0, cy = 0
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++].toUpperCase()
    if (cmd === 'Z') { ops.push(closePath()); continue }
    if (cmd === 'M' || cmd === 'L') {
      const x = num(), y = num(), p = at(x, y)
      ops.push(cmd === 'M' ? moveTo(p.x, p.y) : lineTo(p.x, p.y)); cx = x; cy = y
      if (cmd === 'M') cmd = 'L'
    } else if (cmd === 'Q') {
      const qx = num(), qy = num(), x = num(), y = num()
      const c1 = at(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)), c2 = at(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y)), p = at(x, y)
      ops.push(appendBezierCurve(c1.x, c1.y, c2.x, c2.y, p.x, p.y)); cx = x; cy = y
    } else if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
      const a = at(x1, y1), b = at(x2, y2), p = at(x, y)
      ops.push(appendBezierCurve(a.x, a.y, b.x, b.y, p.x, p.y)); cx = x; cy = y
    } else throw new Error(`Unsupported path command ${cmd}`)
  }
  ops.push(paint === 'evenodd' ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : paint === 'stroke' ? stroke() : paint === 'fillstroke' ? fillAndStroke() : fill())
  return ops
}

/** A rounded rectangle as path data. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const k = r * 0.4477, x2 = x + w, y2 = y + h
  return `M${x + r} ${y}L${x2 - r} ${y}C${x2 - k} ${y} ${x2} ${y + k} ${x2} ${y + r}L${x2} ${y2 - r}C${x2} ${y2 - k} ${x2 - k} ${y2} ${x2 - r} ${y2}L${x + r} ${y2}C${x + k} ${y2} ${x} ${y2 - k} ${x} ${y2 - r}L${x} ${y + r}C${x} ${y + k} ${x + k} ${y} ${x + r} ${y}Z`
}

function drawArt(page: PDFPage, art: Art, item: { x: number; y: number; w: number; h: number }, at: PointMap, colors: string[]): void {
  const [vx, vy, vw, vh] = art.viewBox
  const sx = item.w / vw, sy = item.h / vh          // equal by construction: the item keeps the art's aspect ratio
  art.paths.forEach((p, i) => {
    page.pushOperators(setFillingColor(rgbOf(colors[Math.min(i, colors.length - 1)])), ...pathOperators(p.d, (x, y) => at(item.x + (x - vx) * sx, item.y + (y - vy) * sy), p.evenOdd ? 'evenodd' : 'fill'))
  })
}

function rectPath(x: number, y: number, w: number, h: number): string { return `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z` }

function paintItem(page: PDFPage, fonts: MarkFonts, item: MarkItem, at: PointMap, url: string): void {
  switch (item.t) {
    case 'icon': drawArt(page, ICON_ART, item, at, [RED]); break
    case 'wordmark': drawArt(page, WORDMARK_ART, item, at, [RED]); break
    case 'logo': drawArt(page, WORDMARK_ART, item, at, [INK, RED]); break
    case 'rule': page.pushOperators(setFillingColor(rgbOf(item.color ?? RED)), ...pathOperators(rectPath(item.x, item.y, item.w, item.h), at, 'fill')); break
    case 'frame': {
      const ops: PDFOperator[] = [setLineWidth(item.width), setStrokingColor(rgbOf(item.stroke))]
      if (item.fill) ops.push(setFillingColor(rgbOf(item.fill)))
      page.pushOperators(...ops, ...pathOperators(roundedRect(item.x, item.y, item.w, item.h, item.r), at, item.fill ? 'fillstroke' : 'stroke'))
      break
    }
    case 'line': {
      const a = at(item.x1, item.y1), b = at(item.x2, item.y2)
      page.pushOperators(setLineWidth(item.width), setStrokingColor(rgbOf(item.color)), moveTo(a.x, a.y), lineTo(b.x, b.y), stroke())
      break
    }
    case 'glyph': {
      const k = item.size / GLYPH_BOX
      page.pushOperators(setStrokingColor(rgbOf(item.color)), setLineWidth(GLYPH_STROKE * k), setLineCap(LineCapStyle.Round), setLineJoin(LineJoinStyle.Round),
        ...pathOperators(GLYPHS[item.name], (x, y) => at(item.x + x * k, item.y + y * k), 'stroke'))
      break
    }
    case 'qr': {
      const s = item.size
      page.pushOperators(setFillingColor(rgbOf('#FFFFFF')), ...pathOperators(rectPath(item.x, item.y, s, s), at, 'fill'))
      page.pushOperators(setFillingColor(rgbOf(INK)), ...pathOperators(qrPath(qrMatrix(url), item.x, item.y, s).d, at, 'fill'))
      break
    }
    case 'hotspot': linkOver(page, at, item.x, item.y, item.w, item.h, item.url); break
    case 'text': {
      // Text is drawn through the same mapping as everything else: its baseline start and its direction come from the mapped points.
      const mono = item.font === 'mono'
      const font = mono ? (item.bold ? fonts.monoBold : fonts.mono) : (item.bold ? fonts.bold : fonts.regular)
      const p0 = at(item.x, item.y), p1 = at(item.x + 1, item.y)
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI
      const text = printable(item.text)
      let spacing = 0
      // pdf-lib shows the string without kerning, so the plain glyph widths are what is printed.
      if (item.fit && !mono) spacing = (item.fit - textWidth(text, item.size, item.bold)) / Math.max(1, text.length - 1)
      if (spacing) page.pushOperators(setCharacterSpacing(spacing))
      page.drawText(text, { x: p0.x, y: p0.y, size: item.size, font, color: rgbOf(item.color), rotate: degrees(angle) })
      if (spacing) page.pushOperators(setCharacterSpacing(0))
      void monoWidth
      break
    }
  }
}

/** A clickable rectangle (a real PDF link annotation) that opens `url`; on a rotated page its box is the one around the four mapped corners. */
function linkOver(page: PDFPage, at: PointMap, x: number, y: number, w: number, h: number, url: string): void {
  const corners = [at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)]
  const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y)
  const ctx = page.doc.context
  const annotation = ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], Border: [0, 0, 0], F: 4, A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } })
  page.node.addAnnot(ctx.register(annotation))
}

/**
 * Draws a laid-out component. `wholeLink`: the whole box is also a link to `url` (a signature block is; the footer links only its address and its QR code, so that
 * the text around them stays plain).
 */
export function paintMark(page: PDFPage, fonts: MarkFonts, layout: MarkLayout, url: string, at: PointMap, wholeLink = true): void {
  page.pushOperators(pushGraphicsState())
  for (const item of layout.items) paintItem(page, fonts, item, at, url)
  if (layout.badge) paintItem(page, fonts, { t: 'text', x: 0, y: -3, text: layout.badge.text, size: layout.badge.size, bold: true, color: RED }, at, url)
  page.pushOperators(popGraphicsState())
  if (wholeLink) linkOver(page, at, 0, 0, layout.width, layout.height, url)
}

/** Makes `concatTransformationMatrix` available to callers that need to compose their own transform (kept here so pdf-lib is imported in one place). */
export { concatTransformationMatrix }
