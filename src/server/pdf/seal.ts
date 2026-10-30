import { degrees, PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib'
import QRCode from 'qrcode'
import { ActionError } from '../errors'
import type { Lang } from '../../content/document-types'

/**
 * Adds a VORA seal (a QR code and the endorsement beside it) to a PDF that somebody else issued. The original content is not touched: the seal is drawn
 * on top, on the pages the person chose, in the corner the person chose, whatever the rotation of the page. The QR code opens the document's
 * verification page, which shows the fingerprint (SHA-256) of the sealed file.
 *
 * The seal is VORA's endorsement of the file and a way to detect a changed file.
 */
export interface SealOptions {
  verificationUrl: string; number: string; lang: Lang
  purpose: string; pages: string; corner: string; size: string
  signatoryName: string; signatoryTitle: string; company: string; sealedAt: string; sourceSha256: string
  /** A preview shows where the seal will go and is marked as a preview; it is never stored. */
  preview?: boolean
}

const INK = rgb(16 / 255, 23 / 255, 32 / 255)
const RED = rgb(180 / 255, 62 / 255, 49 / 255)
const SLATE = rgb(100 / 255, 113 / 255, 124 / 255)
const WHITE = rgb(1, 1, 1)
const MARGIN = 22
export const MAX_SEAL_PAGES = 200

const WORDS: Record<Lang, { title: string; purposes: Record<string, string>; scan: string; original: string; note: string; preview: string }> = {
  id: {
    title: 'SEGEL DIGITAL VORA',
    purposes: { verified: 'Diperiksa dan disahkan oleh', approved: 'Disetujui oleh', acknowledged: 'Diketahui oleh' },
    scan: 'Pindai QR untuk memeriksa keaslian',
    original: 'SHA-256 berkas asli',
    note: 'Pindai QR untuk memeriksa keaslian dan sidik jari berkas',
    preview: 'PRATINJAU',
  },
  en: {
    title: 'VORA DIGITAL SEAL',
    purposes: { verified: 'Checked and endorsed by', approved: 'Approved by', acknowledged: 'Acknowledged by' },
    scan: 'Scan the QR to check authenticity',
    original: 'SHA-256 of the original',
    note: 'Scan the QR to check authenticity and the file fingerprint',
    preview: 'PREVIEW',
  },
}

const SIZES: Record<string, { w: number; h: number; text: number }> = { small: { w: 196, h: 66, text: 5.4 }, medium: { w: 270, h: 108, text: 6.6 } }

/** Standard PDF fonts hold Western European text only: anything else prints as "?" rather than failing. */
function clean(font: PDFFont, value: string): string {
  const set = new Set(font.getCharacterSet())
  let out = ''
  for (const ch of value.replace(/\s+/g, ' ')) out += set.has(ch.codePointAt(0)!) ? ch : '?'
  return out
}

function wrap(font: PDFFont, text: string, width: number, size: number, maxLines: number): string[] {
  const words = clean(font, text).split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue }
    if (line) lines.push(line)
    line = word
    while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {          // a word longer than the line is broken, never run off the seal
      let cut = line.length - 1
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--
      lines.push(line.slice(0, cut)); line = line.slice(cut)
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) { const kept = lines.slice(0, maxLines); kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, kept[maxLines - 1].length - 3))}...`; return kept }
  return lines
}

/** Drawing in the page as the reader sees it, whatever the page's /Rotate says. */
class View {
  constructor(private page: PDFPage) {
    const crop = page.getCropBox()
    this.x = crop.x; this.y = crop.y; this.pw = crop.width; this.ph = crop.height
    const a = page.getRotation().angle
    this.angle = ((Math.round(a / 90) * 90) % 360 + 360) % 360
    this.width = this.angle % 180 ? this.ph : this.pw
    this.height = this.angle % 180 ? this.pw : this.ph
  }
  private x: number; private y: number; private pw: number; private ph: number
  readonly angle: number; readonly width: number; readonly height: number

  /** A point of the page as the reader sees it (origin bottom left) -> the same point in the page's own coordinates. */
  at(vx: number, vy: number): { x: number; y: number } {
    switch (this.angle) {
      case 90: return { x: this.x + this.pw - vy, y: this.y + vx }
      case 180: return { x: this.x + this.pw - vx, y: this.y + this.ph - vy }
      case 270: return { x: this.x + vy, y: this.y + this.ph - vx }
      default: return { x: this.x + vx, y: this.y + vy }
    }
  }
  rect(vx: number, vy: number, w: number, h: number, o: { fill?: RGB; border?: RGB; borderWidth?: number; dash?: number[] }): void {
    this.page.drawRectangle({ ...this.at(vx, vy), width: w, height: h, rotate: degrees(this.angle), color: o.fill, borderColor: o.border, borderWidth: o.borderWidth ?? 0, borderDashArray: o.dash })
  }
  text(vx: number, vy: number, value: string, font: PDFFont, size: number, color: RGB): void {
    this.page.drawText(value, { ...this.at(vx, vy), font, size, color, rotate: degrees(this.angle) })
  }
  image(image: Awaited<ReturnType<PDFDocument['embedPng']>>, vx: number, vy: number, size: number): void {
    this.page.drawImage(image, { ...this.at(vx, vy), width: size, height: size, rotate: degrees(this.angle) })
  }
}

/** Which pages receive the seal (zero-based). */
export function sealedPageIndexes(total: number, which: string): number[] {
  if (which === 'first') return [0]
  if (which === 'all') return Array.from({ length: total }, (_, i) => i)
  return [total - 1]
}

export async function sealPdf(source: Uint8Array, o: SealOptions): Promise<{ bytes: Uint8Array; pagesSealed: number }> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(source, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true })
  } catch (e) {
    throw new ActionError(e instanceof Error && /encrypted/i.test(e.message) ? 'The PDF is encrypted: upload a copy without a password' : 'This PDF cannot be opened to add the seal. Invalid or damaged PDF')
  }
  const total = doc.getPageCount()
  if (total < 1 || total > MAX_SEAL_PAGES) throw new ActionError(`The PDF must have 1 to ${MAX_SEAL_PAGES} pages`)
  const words = WORDS[o.lang]
  const size = SIZES[o.size] ?? SIZES.medium
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const qr = await doc.embedPng(await QRCode.toBuffer(o.verificationUrl, { errorCorrectionLevel: 'M', margin: 1, scale: 6, type: 'png', color: { dark: '#101720', light: '#FFFFFF' } }))
  const indexes = sealedPageIndexes(total, o.pages)

  for (const index of indexes) {
    const page = doc.getPage(index)
    const view = new View(page)
    if (view.width < size.w + MARGIN * 2 || view.height < size.h + MARGIN * 2) throw new ActionError(`Page ${index + 1} is too small for the seal: choose the small size`)
    const left = o.corner.endsWith('left') ? MARGIN : view.width - MARGIN - size.w
    const bottom = o.corner.startsWith('top') ? view.height - MARGIN - size.h : MARGIN
    // The card: white, so that the QR code scans over any content, with a thin ink border (dashed for a preview).
    view.rect(left, bottom, size.w, size.h, { fill: WHITE, border: o.preview ? RED : INK, borderWidth: 0.8, dash: o.preview ? [3, 2] : undefined })
    view.rect(left, bottom + size.h - 3, size.w, 3, { fill: RED })
    const qrSize = size.h - 14
    view.image(qr, left + 6, bottom + 6, qrSize)
    const tx = left + qrSize + 14
    const tw = size.w - qrSize - 20
    const t = size.text
    let y = bottom + size.h - 6 - t
    const line = (value: string, font: PDFFont, fontSize: number, color: RGB) => { view.text(tx, y, clean(font, value), font, fontSize, color); y -= fontSize + 2.4 }
    line(words.title, bold, t + 0.6, RED)
    line(words.purposes[o.purpose] ?? words.purposes.verified, regular, t, SLATE)
    for (const l of wrap(bold, o.signatoryName, tw, t + 0.4, 1)) line(l, bold, t + 0.4, INK)
    for (const l of wrap(regular, o.signatoryTitle, tw, t, 1)) line(l, regular, t, INK)
    for (const l of wrap(regular, o.company, tw, t, 1)) line(l, regular, t, INK)
    line(o.sealedAt, regular, t, SLATE)
    if (o.size === 'medium') {
      line(`${o.number}`, regular, t - 0.8, SLATE)
      line(`${words.original}: ${o.sourceSha256.slice(0, 16)}...`, regular, t - 1.4, SLATE)
      for (const l of wrap(regular, words.note, tw, t - 1.6, 2)) line(l, regular, t - 1.6, SLATE)
    }
    if (o.preview) view.text(left, bottom + size.h + 4, words.preview, bold, 8, RED)
  }
  const bytes = await doc.save({ useObjectStreams: false })
  return { bytes, pagesSealed: indexes.length }
}
