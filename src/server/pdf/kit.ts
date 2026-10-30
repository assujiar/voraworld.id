import { PDFDocument, PDFFont, PDFImage, PDFPage, PDFString, StandardFonts, rgb, setCharacterSpacing, type RGB } from 'pdf-lib'
import QRCode from 'qrcode'
import { ActionError } from '../errors'
import { PDF_ASSETS } from './brand-assets'

/** A4 in PDF points. */
export const W = 595.28
export const H = 841.89
export const INK = '#101720'
export const RED = '#B43E31'
export const SLATE = '#64717C'
export const PALE = '#F7F7F4'
export const RULE = '#DCE0E1'
export const WHITE = '#FFFFFF'
/** Height of the ink header band every document shares, and of the red edge under it. */
export const BAND_H = 110
export const BAND_EDGE = 4
export const TAGLINE = 'Bringing the World Within Reach.'

/** Raised instead of silently clipping: the content does not fit the layout, so shorten it. */
export class PdfLayoutError extends ActionError {
  constructor(message: string) { super(message, 422) }
}

const color = (c: string): RGB => rgb(parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255)

/**
 * Thin drawing layer over pdf-lib that keeps ReportLab's conventions (origin bottom-left, text baseline at `y`, rectangles
 * given by their bottom-left corner), so the layouts read the same as the documents VORA has always issued.
 * Everything uses the built-in Courier faces: nothing is fetched or read from disk, and there is no font to license.
 */
export class Sheet {
  private constructor(
    readonly doc: PDFDocument, private regular: PDFFont, private bold: PDFFont, private chars: Set<number>,
    private logo: PDFImage, private watermarkImage: PDFImage, public page: PDFPage,
  ) {}

  static async create(meta: { title: string; author: string; subject: string }): Promise<Sheet> {
    const doc = await PDFDocument.create()
    doc.setTitle(meta.title); doc.setAuthor(meta.author); doc.setSubject(meta.subject); doc.setCreator('VORA'); doc.setProducer('VORA')
    const regular = await doc.embedFont(StandardFonts.Courier)
    const bold = await doc.embedFont(StandardFonts.CourierBold)
    const logo = await doc.embedPng(Buffer.from(PDF_ASSETS.logoReverse, 'base64'))
    const watermark = await doc.embedPng(Buffer.from(PDF_ASSETS.watermark, 'base64'))
    const sheet = new Sheet(doc, regular, bold, new Set(regular.getCharacterSet()), logo, watermark, doc.addPage([W, H]))
    return sheet
  }

  newPage(): PDFPage { this.page = this.doc.addPage([W, H]); return this.page }

  /** Standard PDF fonts hold Western European text only: anything else prints as "?" rather than failing. */
  clean(value: unknown): string {
    let out = ''
    for (const ch of String(value ?? '').replace(/[\t ]/g, ' ').replace(/[\r\n]+/g, ' ')) out += this.chars.has(ch.codePointAt(0)!) ? ch : '?'
    return out
  }

  width(text: string, size: number, bold = false): number { return (bold ? this.bold : this.regular).widthOfTextAtSize(this.clean(text), size) }

  text(x: number, y: number, value: unknown, size = 8, fill = INK, bold = false): void {
    this.page.drawText(this.clean(value), { x, y, size, font: bold ? this.bold : this.regular, color: color(fill) })
  }
  right(x: number, y: number, value: unknown, size = 8, fill = INK, bold = false): void {
    this.text(x - this.width(String(value ?? ''), size, bold), y, value, size, fill, bold)
  }
  rule(y: number, x1: number, x2: number, stroke = RULE, thickness = 0.65): void {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: color(stroke) })
  }
  rect(x: number, y: number, w: number, h: number, fill: string): void {
    this.page.drawRectangle({ x, y, width: w, height: h, color: color(fill), borderWidth: 0 })
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, fill: string): void {
    const k = Math.min(r, w / 2, h / 2)
    const d = `M ${k} 0 H ${w - k} A ${k} ${k} 0 0 1 ${w} ${k} V ${h - k} A ${k} ${k} 0 0 1 ${w - k} ${h} H ${k} A ${k} ${k} 0 0 1 0 ${h - k} V ${k} A ${k} ${k} 0 0 1 ${k} 0 Z`
    this.page.drawSvgPath(d, { x, y: y + h, color: color(fill), borderWidth: 0 })
  }
  /** A rectangle outline; `dash` (for example [3, 2]) makes it a dashed "put it here" box. */
  outline(x: number, y: number, w: number, h: number, stroke: string, thickness = 1, dash?: number[]): void {
    this.page.drawRectangle({ x, y, width: w, height: h, borderColor: color(stroke), borderWidth: thickness, ...(dash ? { borderDashArray: dash } : {}) })
  }

  /** Greedy word wrap on real font metrics; a word wider than the column is broken, never cut off. */
  wrap(value: unknown, maxWidth: number, size: number, bold = false): string[] {
    const rows: string[] = []
    for (const paragraph of String(value ?? '').replace(/\r/g, '').split('\n')) {
      if (!paragraph.trim()) { rows.push(''); continue }
      let line = ''
      for (let word of this.clean(paragraph).split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word
        if (this.width(candidate, size, bold) <= maxWidth) { line = candidate; continue }
        if (line) { rows.push(line); line = '' }
        while (word && this.width(word, size, bold) > maxWidth) {
          let take = Math.max(1, Math.floor(maxWidth / (size * 0.6)))
          while (take > 1 && this.width(word.slice(0, take), size, bold) > maxWidth) take--
          rows.push(word.slice(0, take)); word = word.slice(take)
        }
        line = word
      }
      if (line) rows.push(line)
    }
    return rows
  }

  /** A QR code image that carries the verification link. It is a lookup token, never a signature. */
  async qr(url: string): Promise<PDFImage> {
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, scale: 4, type: 'png', color: { dark: INK, light: WHITE } })
    return this.doc.embedPng(png)
  }

  /** White page background plus the official A mark as a faint watermark (never a redrawn logo). */
  background(watermark: { x: number; y: number; w: number; h: number }): void {
    this.rect(0, 0, W, H, WHITE)
    this.page.drawImage(this.watermarkImage, { x: watermark.x, y: watermark.y, width: watermark.w, height: watermark.h })
  }
  /**
   * The header every document shares: the official reverse logo on the ink band with a red edge, and a lockup under the logo
   * in which everything lines up with the logo itself. The tagline is spaced out to the logo's exact width, a hairline marks
   * that width, and the address and NPWP are wrapped inside it, all flush with the logo's left edge.
   */
  header(o: { x: number; logoWidth: number; info: { address: string; taxId: string } }): void {
    this.rect(0, H - BAND_H, W, BAND_H, INK)
    this.rect(0, H - BAND_H - BAND_EDGE, W, BAND_EDGE, RED)
    const logoHeight = o.logoWidth * (this.logo.height / this.logo.width)        // the artwork's own proportions, never stretched
    const top = H - 18
    this.page.drawImage(this.logo, { x: o.x, y: top - logoHeight, width: o.logoWidth, height: logoHeight })
    let y = top - logoHeight - 10
    this.tracked(o.x, y, TAGLINE, 7, '#DCE0E1', o.logoWidth + 1.4)        // +1.4: the closing full stop leaves that much room on its right, so the dot itself ends at the logo's edge
    y -= 6.2
    this.rule(y, o.x, o.x + o.logoWidth, '#3B4753', 0.5)
    y -= 9.8
    const size = 5.9
    const rows = this.wrap(o.info.address, o.logoWidth, size)
    const shown = rows.length > 3 ? [...rows.slice(0, 2), this.ellipsize(rows.slice(2).join(' '), o.logoWidth, size)] : rows
    for (const row of shown) { this.text(o.x, y, row, size, '#C9D0D4'); y -= 7.2 }
    if (o.info.taxId) {
      this.text(o.x, y - 0.6, 'NPWP', size, WHITE, true)
      this.text(o.x + this.width('NPWP ', size, true), y - 0.6, o.info.taxId, size, '#C9D0D4')
    }
  }

  /** Cuts `text` so that it, with "...", fits `width`. */
  ellipsize(text: string, width: number, size: number): string {
    let t = this.clean(text)
    while (t.length > 1 && this.width(`${t}...`, size) > width) t = t.slice(0, -1)
    return `${t.trimEnd()}...`
  }

  /**
   * Text spaced out so that it spans exactly `width`, from the left edge of its first letter to the right edge of its last: a
   * line under the logo that is as wide as the logo. (If the text is already wider it is set smaller instead.)
   */
  tracked(x: number, y: number, value: string, size: number, fill: string, width: number, bold = false): void {
    const text = this.clean(value)
    while (this.width(text, size, bold) > width && size > 4) size -= 0.1
    const gaps = Math.max(1, text.length - 1)
    const spacing = (width - this.width(text, size, bold)) / gaps
    this.page.pushOperators(setCharacterSpacing(spacing))
    this.page.drawText(text, { x, y, size, font: bold ? this.bold : this.regular, color: color(fill) })
    this.page.pushOperators(setCharacterSpacing(0))
  }

  /** A clickable area on the current page that opens `url`. */
  link(x: number, y: number, w: number, h: number, url: string): void {
    const annotation = this.doc.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [x, y, x + w, y + h], Border: [0, 0, 0], F: 4,
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    })
    this.page.node.addAnnot(this.doc.context.register(annotation))
  }

  /** How tall `linkLines` is for this URL, so a layout can make room for it before drawing. */
  linkHeight(url: string, maxWidth: number, size: number, bold = false): number {
    return this.wrap(url, maxWidth, size, bold).length * (size + 2.2)
  }

  /**
   * A web address printed as underlined, clickable text. A long address wraps (every line stays clickable). Returns the baseline
   * below the last line.
   */
  linkLines(x: number, y: number, url: string, maxWidth: number, size: number, fill = INK, bold = false): number {
    for (const row of this.wrap(url, maxWidth, size, bold)) {
      const w = this.width(row, size, bold)
      this.text(x, y, row, size, fill, bold)
      this.rule(y - 1.5, x, x + w, RED, 0.6)                    // links are underlined in the brand red
      this.link(x, y - 2.6, w, size + 3, url)
      y -= size + 2.2
    }
    return y
  }

  /**
   * Footer accent shared by every document: the short red tab of the section titles sits on the footer hairline, and a red
   * edge runs along the foot of the page, the counterpart of the red edge under the header band.
   */
  footer(ruleY: number, left: number, right: number, edge = 4): void {
    this.rule(ruleY, left, right)
    this.rect(left, ruleY - 1.1, 31, 2.5, RED)
    this.rect(0, 0, W, edge, RED)
  }

  save(): Promise<Uint8Array> { return this.doc.save() }
}

/** `IDR 1,234,567` -> `1,234,567` (the currency is printed once in the document header). */
export const withoutCurrency = (formatted: string): string => formatted.slice(formatted.indexOf(' ') + 1)
