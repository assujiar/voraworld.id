import { PDFString, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb, setCharacterSpacing, setFillingColor, StandardFonts, fill, degrees, PDFOperator, PDFOperatorNames, closePath, lineTo, moveTo, appendBezierCurve, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'
import { ICON_ART, WORDMARK_ART, type Art } from '../../content/stamp-art'
import { qrMatrix, qrPath } from '../../content/trust-qr'
import { layoutMark, printable, textWidth, type MarkItem, type MarkLayout, type MarkOptions } from '../../content/trust-mark'

/**
 * Draws a VORA Document Verification Mark (the layout decided in content/trust-mark.ts) onto a pdf-lib page. The artwork is the path data of the approved SVGs,
 * filled in one colour; no coordinate of it is changed. The QR code is vector, on its own white square.
 */
export interface MarkFonts { regular: PDFFont; bold: PDFFont }

export async function embedMarkFonts(doc: PDFDocument): Promise<MarkFonts> {
  return { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) }
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

/** `M L Q Z` path data (what the approved SVGs and the QR code use) -> PDF operators, with `at` placing each point. Q becomes the equivalent cubic. */
function pathOperators(d: string, at: (x: number, y: number) => { x: number; y: number }, evenOdd: boolean): PDFOperator[] {
  const tokens = d.match(/[MLQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
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
    } else throw new Error(`Unsupported path command ${cmd}`)
  }
  ops.push(evenOdd ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : fill())
  return ops
}

function drawArt(page: PDFPage, art: Art, item: { x: number; y: number; w: number; h: number }, at: PointMap, color: string): void {
  const [vx, vy, vw, vh] = art.viewBox
  const sx = item.w / vw, sy = item.h / vh          // equal by construction: the item keeps the art's aspect ratio
  page.pushOperators(setFillingColor(rgbOf(color)))
  for (const p of art.paths) page.pushOperators(...pathOperators(p.d, (x, y) => at(item.x + (x - vx) * sx, item.y + (y - vy) * sy), p.evenOdd))
}

function paintItem(page: PDFPage, fonts: MarkFonts, item: MarkItem, at: PointMap, url: string): void {
  switch (item.t) {
    case 'icon': drawArt(page, ICON_ART, item, at, '#B43E31'); break
    case 'wordmark': drawArt(page, WORDMARK_ART, item, at, '#B43E31'); break
    case 'rule': {
      page.pushOperators(setFillingColor(rgbOf(item.color ?? '#B43E31')), ...pathOperators(`M${item.x} ${item.y}L${item.x + item.w} ${item.y}L${item.x + item.w} ${item.y + item.h}L${item.x} ${item.y + item.h}Z`, at, false))
      break
    }
    case 'qr': {
      const s = item.size
      page.pushOperators(setFillingColor(rgbOf('#FFFFFF')), ...pathOperators(`M${item.x} ${item.y}L${item.x + s} ${item.y}L${item.x + s} ${item.y + s}L${item.x} ${item.y + s}Z`, at, false))
      page.pushOperators(setFillingColor(rgbOf('#101720')), ...pathOperators(qrPath(qrMatrix(url), item.x, item.y, s).d, at, false))
      break
    }
    case 'text': {
      // Text is drawn through the same mapping as everything else: its baseline start and its direction come from the mapped points.
      const font = item.bold ? fonts.bold : fonts.regular
      const p0 = at(item.x, item.y), p1 = at(item.x + 1, item.y)
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI
      const text = printable(item.text)
      let spacing = 0
      if (item.fit) spacing = (item.fit - textWidth(text, item.size, item.bold)) / Math.max(1, text.length - 1)      // pdf-lib shows the string without kerning, so the plain glyph widths are what is printed
      if (spacing) page.pushOperators(setCharacterSpacing(spacing))
      page.drawText(text, { x: p0.x, y: p0.y, size: item.size, font, color: rgbOf(item.color), rotate: degrees(angle) })
      if (spacing) page.pushOperators(setCharacterSpacing(0))
      break
    }
  }
}

/** A clickable area over the mark that opens `url` (its rectangle is the box around the four mapped corners, so it is right on a rotated page too). */
export function linkOverMark(page: PDFPage, layout: MarkLayout, url: string, at: PointMap): void {
  const corners = [at(0, 0), at(layout.width, 0), at(layout.width, layout.height), at(0, layout.height)]
  const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y)
  const ctx = page.doc.context
  const annotation = ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], Border: [0, 0, 0], F: 4, A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } })
  page.node.addAnnot(ctx.register(annotation))
}

/** Draws a laid-out mark, and makes the whole of it a link to the verification page. `at` maps the layout's axes to the page; on a rotated page that is `PageView.map`. */
export function paintMark(page: PDFPage, fonts: MarkFonts, layout: MarkLayout, url: string, at: PointMap): void {
  page.pushOperators(pushGraphicsState())
  for (const item of layout.items) paintItem(page, fonts, item, at, url)
  if (layout.badge) paintItem(page, fonts, { t: 'text', x: 0, y: -3, text: layout.badge.text, size: layout.badge.size, bold: true, color: '#B43E31' }, at, url)
  page.pushOperators(popGraphicsState())
  linkOverMark(page, layout, url, at)
}

/** Lays out and draws a mark at (left, top) of an upright page. Returns the layout so the caller knows how much room it took. */
export function drawMark(page: PDFPage, fonts: MarkFonts, o: MarkOptions, left: number, top: number): MarkLayout {
  const layout = layoutMark(o)
  paintMark(page, fonts, layout, o.url, upright(left, top))
  return layout
}

/** Makes `concatTransformationMatrix` available to callers that need to compose their own transform (kept here so pdf-lib is imported in one place). */
export { concatTransformationMatrix }
