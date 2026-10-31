import { monoWidth, lockupWidthForHeight, lockup, INK, RED, SLATE, WORDMARK_ASPECT, ICON_RATIO, type Lang, type MarkItem, type MarkLayout, fitText, printable, textWidth } from './trust-mark'
import { qrMatrix, QUIET_MODULES } from './trust-qr'

/**
 * The three final verification components, as pure layout (PDF points, origin top left, y down). The PDF painter (server/pdf/trust-mark.ts) and the browser preview
 * (components/trust/TrustMark.tsx) draw the same items, so the editor shows what prints.
 *
 *   Signature Type 1  a regular VORA document that is signed:      QR | document number, registered, name, position. No URL, no logo.
 *   Signature Type 2  third-party documents and VORA agreements:   the same, and under a divider the complete verification link, INSIDE the same box.
 *   Footer Type 3     the verification footer of every other VORA document: brand | verification | metadata | QR | VORA stamp, equal-height sections.
 *
 * Types 1 and 2 share ONE size contract: a fixed landscape 2 : 1 box (width : height), identical in both, however much the content of Type 2 needs. Nothing here is
 * ever stretched on one axis. Verification links are never truncated: they are set whole, wrapped at natural boundaries when they have to be, and drawn in VORA red.
 */
export const SIGNATURE_RATIO = 2
export const SIGNATURE_DIMENSIONS = { widthMm: 95, heightMm: 47.5 } as const
export const PT_PER_MM = 72 / 25.4
export const SIGNATURE_WIDTH = SIGNATURE_DIMENSIONS.widthMm * PT_PER_MM
export const SIGNATURE_HEIGHT = SIGNATURE_DIMENSIONS.heightMm * PT_PER_MM
/** The height of Type 2's link row, which Type 1 does not have: Type 1 is the same box without that row (same width, QR, radius, border and rows), so it carries no empty space where the link would be. */
export const LINK_ROW = 26
export const BORDER = '#D8DFE6'
export const SOFT = '#F5F7F9'
export const MUTED = '#667587'

export type SignatureType = 1 | 2

export interface SignatureOptions {
  type: SignatureType; lang: Lang
  /** The ONE canonical verification address: the QR code and the link are both made from it. */
  url: string
  number: string; registeredAt?: string; name: string; position: string
  /** Uniform only: the box is the same shape at any scale. */
  scale?: number
  /** A preview is labelled; it shows no time that has not happened. */
  preview?: boolean
}

const LABELS: Record<Lang, [string, string, string, string]> = {
  id: ['Nomor dokumen', 'Didaftarkan', 'Nama', 'Jabatan'],
  en: ['Document no.', 'Registered', 'Name', 'Position'],
}
const PENDING: Record<Lang, string> = { id: 'Ditetapkan saat selesai', en: 'Set when completed' }
const PREVIEW: Record<Lang, string> = { id: 'PRATINJAU', en: 'PREVIEW' }

/** A monospaced value that fits `width`: as large as `max` allows, never under `min`, and only then shortened (never used for a verification address). */
function monoFit(text: string, width: number, max: number, min: number): { text: string; size: number } {
  const t = printable(text)
  const size = Math.min(max, width / (0.6 * Math.max(1, [...t].length)))
  if (size >= min) return { text: t, size }
  let cut = t
  while ([...cut].length > 1 && monoWidth(`${cut}...`, min) > width) cut = [...cut].slice(0, -1).join('')
  return { text: `${cut.trimEnd()}...`, size: min }
}

/** Greedy wrap of monospaced text at natural boundaries (after - / . @ and spaces); a run longer than the line is broken, never cut off. */
export function wrapMono(text: string, width: number, size: number): string[] {
  const per = Math.max(1, Math.floor(width / (0.6 * size)))
  const parts = printable(text).match(/[^-/.@ ]+[-/.@ ]*|[-/.@ ]+/g) ?? []
  const lines: string[] = []
  let line = ''
  for (let part of parts) {
    while ([...part].length > per) { const head = [...part].slice(0, per).join(''); if (line) { lines.push(line.trimEnd()); line = '' } lines.push(head); part = [...part].slice(per).join('') }
    if ([...(line + part).trimEnd()].length > per) { lines.push(line.trimEnd()); line = part } else line += part
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines
}

/**
 * The complete address, never shortened: one line when it fits at 5.2 pt or more, otherwise two lines split after "/verify/", and if the token itself is too long for
 * a line at the smallest size, as many lines as it needs (split only inside the token, where no meaning is lost).
 */
export function urlLines(url: string, width: number, max: number, min = 5.2): { lines: string[]; size: number } {
  const one = Math.min(max, width / (0.6 * [...url].length))
  if (one >= min) return { lines: [url], size: one }
  const cut = url.indexOf('/verify/') + '/verify/'.length
  const lines = cut > '/verify/'.length - 1 && cut < url.length ? [url.slice(0, cut), url.slice(cut)] : [url]
  const widest = Math.max(...lines.map((l) => [...l].length))
  const fits = Math.min(max, width / (0.6 * widest))
  if (fits >= min) return { lines, size: fits }
  const per = Math.max(1, Math.floor(width / (0.6 * min)))
  const out: string[] = []
  for (const line of lines) for (let i = 0; i < [...line].length; i += per) out.push([...line].slice(i, i + per).join(''))
  return { lines: out, size: min }
}

function scaled(items: MarkItem[], k: number): MarkItem[] {
  return items.map((i) => {
    switch (i.t) {
      case 'qr': return { ...i, x: i.x * k, y: i.y * k, size: i.size * k }
      case 'text': return { ...i, x: i.x * k, y: i.y * k, size: i.size * k, fit: i.fit === undefined ? undefined : i.fit * k }
      case 'line': return { ...i, x1: i.x1 * k, y1: i.y1 * k, x2: i.x2 * k, y2: i.y2 * k, width: i.width * k }
      case 'frame': return { ...i, x: i.x * k, y: i.y * k, w: i.w * k, h: i.h * k, r: i.r * k, width: i.width * k }
      case 'glyph': return { ...i, x: i.x * k, y: i.y * k, size: i.size * k }
      default: return { ...i, x: i.x * k, y: i.y * k, w: i.w * k, h: i.h * k }
    }
  })
}

export const SIGNATURE_QR = 92
export const signatureHeight = (type: SignatureType): number => (type === 2 ? SIGNATURE_HEIGHT : SIGNATURE_HEIGHT - LINK_ROW)
/** The distance between the baselines of two rows: fixed and close, whatever the height of the box, so that the rows read as one block (it is centred in its region). */
export const ROW_PITCH = 17

export function layoutSignature(o: SignatureOptions): MarkLayout {
  const W = SIGNATURE_WIDTH, H = signatureHeight(o.type), PAD = 8
  const labels = LABELS[o.lang]
  const items: MarkItem[] = []
  items.push({ t: 'frame', x: 0.4, y: 0.4, w: W - 0.8, h: H - 0.8, r: 9, stroke: BORDER, width: 0.8 })
  const URLH = LINK_ROW
  const y0 = PAD, y1 = o.type === 2 ? H - URLH : H - PAD
  const qrCell = SIGNATURE_QR + 4
  items.push({ t: 'qr', x: PAD + 2, y: y0 + (y1 - y0 - SIGNATURE_QR) / 2, size: SIGNATURE_QR })
  const divider = PAD + qrCell
  items.push({ t: 'line', x1: divider, y1: y0 + 2, x2: divider, y2: y1 - 2, color: BORDER, width: 0.6 })
  const x0 = divider + 8, right = W - 7
  const pending = o.preview || !o.registeredAt
  const values = [o.number, pending ? PENDING[o.lang] : (o.registeredAt as string), o.name, o.position]
  const glyphs = ['document', 'calendar', 'user', 'briefcase'] as const
  const LABEL_X = x0 + 13, LABEL_COL = 50, COLON_X = LABEL_X + LABEL_COL, VALUE_X = COLON_X + 5
  const mid = (y0 + y1) / 2
  const vw = right - VALUE_X
  const SIZE = 6.4
  // A long value (a document number) is wrapped onto a second line rather than shrunk until it cannot be read; one size for every value.
  const wrapped = values.map((v) => (monoWidth(printable(v), SIZE) <= vw ? [printable(v)] : wrapMono(v, vw, SIZE).slice(0, 2)))
  values.forEach((_, i) => {
    const cy = mid + (i - 1.5) * ROW_PITCH
    items.push({ t: 'glyph', name: glyphs[i], x: x0, y: cy - 5, size: 10, color: RED })
    items.push({ t: 'text', x: LABEL_X, y: cy + 2.3, text: labels[i], size: 6.6, bold: false, color: MUTED })
    items.push({ t: 'text', x: COLON_X, y: cy + 2.3, text: ':', size: 6.6, bold: false, color: MUTED })
    const lines = wrapped[i], lead = SIZE + 1.4
    lines.forEach((line, k) => {
      const fit = monoFit(line, vw, SIZE, 4.4)                                  // a single run that is still too wide for the line is the only thing that is ever shrunk
      items.push({ t: 'text', x: VALUE_X, y: cy + 2.4 + (k - (lines.length - 1) / 2) * lead, text: fit.text, size: fit.size, bold: false, color: INK, font: 'mono' })
    })
  })
  if (o.type === 2) {
    const ly = H - URLH
    items.push({ t: 'line', x1: PAD, y1: ly, x2: W - PAD, y2: ly, color: BORDER, width: 0.6 })
    const cy = ly + URLH / 2
    items.push({ t: 'glyph', name: 'link', x: PAD + 3, y: cy - 7, size: 14, color: RED })
    items.push({ t: 'glyph', name: 'external', x: W - PAD - 15, y: cy - 6.5, size: 13, color: RED })
    const tx = PAD + 24, tw = W - PAD - 20 - tx
    const u = urlLines(o.url, tw, 6.4)
    const lead = u.size + 2.6
    const top = cy - (lead * (u.lines.length - 1)) / 2 + u.size * 0.34
    u.lines.forEach((line, i) => {
      const y = top + i * lead
      items.push({ t: 'text', x: tx, y, text: line, size: u.size, bold: false, color: RED, font: 'mono' })
      items.push({ t: 'line', x1: tx, y1: y + 1.3, x2: tx + monoWidth(line, u.size), y2: y + 1.3, color: RED, width: 0.5 })
    })
    items.push({ t: 'hotspot', x: PAD, y: ly + 2, w: W - 2 * PAD, h: URLH - 4, url: o.url })
  }
  const k = Math.min(Math.max(o.scale ?? 1, 0.5), 2)
  return { width: W * k, height: H * k, qrSize: SIGNATURE_QR * k, items: k === 1 ? items : scaled(items, k), kind: o.type === 1 ? 'signature-1' : 'signature-2', badge: o.preview ? { text: PREVIEW[o.lang], size: 6.5 * k } : undefined }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Footer Type 3
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------

export interface FooterOptions {
  /** The printable width and the height of the footer box, in points. */
  width: number; height: number
  url: string
  number: string
  /** The date (or date and time) the document was issued, as it is already printed on the document. */
  issuedOn: string
  issuer: { address: string; taxId: string; email: string }
  /** The "VORA | DIGITAL DOCUMENT VERIFICATION" heading and the instruction under it, in the document's own words. */
  heading: string
  instruction: string
  /** Document-specific notes (an invoice's "not proof of payment"); the first is set in red when `emphasiseFirst`. Nothing here is added for a document that did not have it. */
  notes?: string[]
  emphasiseFirst?: boolean
  /** Another address a document carries in its footer (a proof of delivery's evidence page), set whole and clickable like the verification address. */
  extraLinks?: Array<{ label: string; url: string }>
  /** "PAGE 01 OF 01", with whatever words the document already used before it. */
  pageLine: string
  tagline: string
}

function mono(x: number, y: number, text: string, size: number, color: string, bold = false): MarkItem {
  return { t: 'text', x, y, text, size, bold, color, font: 'mono' }
}

export function layoutFooter(o: FooterOptions): MarkLayout {
  const W = o.width, H = o.height, PV = 5
  const ih = H - 2 * PV
  const n = qrMatrix(o.url).size
  // The QR square fills the section height up to 68 pt (24 mm): a taller footer centres it rather than growing it past what the sections beside it can afford.
  const QR = Math.min(ih, 68)
  const qrTop = PV + (ih - QR) / 2
  const quiet = (QR * QUIET_MODULES) / (n + 2 * QUIET_MODULES)
  const modules = QR - 2 * quiet
  const lw = lockupWidthForHeight(modules)
  const A = 100, C = 86, D = QR + 8, E = lw + 14
  const B = W - A - C - D - E
  if (B < 130) throw new Error('The footer is too narrow for its sections')
  const xA = 0, xB = A, xC = A + B, xD = A + B + C, xE = A + B + C + D
  const items: MarkItem[] = []
  items.push({ t: 'frame', x: 0.3, y: 0.3, w: W - 0.6, h: H - 0.6, r: 4, stroke: BORDER, width: 0.7 })
  items.push({ t: 'line', x1: 4, y1: 0.8, x2: W - 4, y2: 0.8, color: RED, width: 1.6 })
  for (const x of [xB, xC, xD, xE]) items.push({ t: 'line', x1: x, y1: PV + 2, x2: x, y2: H - PV, color: BORDER, width: 0.6 })


  // A. Brand: the approved wordmark in its primary colours, the tagline, the address and the tax number of the issuer (the same company settings as the letterhead).
  {
    const x = xA + 7, w = A - 12
    const lh = Math.min(w, 78) * WORDMARK_ASPECT
    const top = PV + 1 + lh + 5.5
    const tag = monoFit(o.tagline, w, 4.8, 4.2)
    const build = (size: number) => {
      const lines = wrapMono(o.issuer.address, w, size)
      let y = top + tag.size + 1.4 + 5.2
      const out: MarkItem[] = []
      lines.forEach((line) => { out.push(mono(x, y, line, size, MUTED)); y += size + 1.6 })
      if (o.issuer.taxId) { out.push(mono(x, y, 'NPWP', size, INK, true)); out.push(mono(x + monoWidth('NPWP ', size), y, o.issuer.taxId, size, MUTED)); y += size }
      return { out, bottom: y }
    }
    let size = 4.7, built = build(size)
    for (const smaller of [4.4, 4.2]) { if (built.bottom <= H - PV + 0.5) break; size = smaller; built = build(size) }
    if (built.bottom > H - PV + 0.5) {
      // Still too long at the smallest size: the last line that fits is cut with "...", the convention of the letterhead (the whole address is on every page's header).
      const room = Math.max(1, Math.floor((H - PV - top - tag.size - 6.6 - (o.issuer.taxId ? size + 1.6 : 0)) / (size + 1.6)))
      const lines = wrapMono(o.issuer.address, w, size)
      const kept = lines.slice(0, room)
      if (lines.length > room) kept[room - 1] = `${kept[room - 1].slice(0, Math.max(1, kept[room - 1].length - 3)).trimEnd()}...`
      let y = top + tag.size + 1.4 + 5.2
      built = { out: [], bottom: y }
      kept.forEach((line) => { built.out.push(mono(x, y, line, size, MUTED)); y += size + 1.6 })
      if (o.issuer.taxId) { built.out.push(mono(x, y, 'NPWP', size, INK, true)); built.out.push(mono(x + monoWidth('NPWP ', size), y, o.issuer.taxId, size, MUTED)) }
    }
    items.push({ t: 'logo', x, y: PV + 1, w: Math.min(w, 78), h: lh })
    items.push(mono(x, top + tag.size * 0.2, tag.text, tag.size, INK, true))
    items.push({ t: 'line', x1: x, y1: top + tag.size + 1.4, x2: x + w, y2: top + tag.size + 1.4, color: BORDER, width: 0.5 })
    items.push(...built.out)
  }

  // B. Verification: heading, instruction, the complete clickable address in a quiet box, then the document's own notes.
  {
    const x = xB + 7, w = B - 13
    const build = (k: number): { items: MarkItem[]; bottom: number } => {
      const out: MarkItem[] = []
      let y = PV + 5.6 * k
      out.push(mono(x, y, o.heading, Math.min(5.6 * k, w / (0.6 * [...o.heading].length)), INK, true)); y += 3.6 * k
      for (const line of wrapMono(o.instruction, w, 4.8 * k)) { y += 4.8 * k + 0.8; out.push(mono(x, y, line, 4.8 * k, MUTED)) }
      const link = (url: string, label?: string) => {
        if (label) for (const line of wrapMono(label, w, 4.6 * k)) { y += 4.6 * k + 1; out.push(mono(x, y, line, 4.6 * k, MUTED)) }
        const gw = 6.5 * k, tx = x + gw + 3.5 * k + 3, tw = w - (tx - x) - gw - 5
        const u = urlLines(url, tw, 5 * k, 4.4)
        const lead = u.size + 1.8, boxH = lead * u.lines.length + 3.4 * k
        y += 3; const top = y
        out.push({ t: 'frame', x, y: top, w, h: boxH, r: 2.4, stroke: BORDER, width: 0.5, fill: SOFT })
        out.push({ t: 'glyph', name: 'link', x: x + 3, y: top + boxH / 2 - gw / 2, size: gw, color: RED })
        out.push({ t: 'glyph', name: 'external', x: x + w - gw - 3, y: top + boxH / 2 - gw / 2, size: gw, color: RED })
        u.lines.forEach((line, i) => {
          const ly = top + 1.7 * k + u.size + i * lead
          out.push(mono(tx, ly, line, u.size, RED)); out.push({ t: 'line', x1: tx, y1: ly + 1.1, x2: tx + monoWidth(line, u.size), y2: ly + 1.1, color: RED, width: 0.45 })
        })
        out.push({ t: 'hotspot', x, y: top, w, h: boxH, url })
        y = top + boxH
      }
      link(o.url)
      for (const e of o.extraLinks ?? []) link(e.url, e.label)
      ;(o.notes ?? []).forEach((note, idx) => {
        const red = idx === 0 && o.emphasiseFirst
        y += idx === 0 ? 3.6 : 1.2
        for (const line of wrapMono(note, w, 4.6 * k)) { y += 4.6 * k + 0.6; out.push(mono(x, y, line, 4.6 * k, red ? RED : MUTED, red)) }
      })
      return { items: out, bottom: y }
    }
    let chosen = build(1)
    for (const k of [0.96, 0.92, 0.88, 0.84, 0.8]) { if (chosen.bottom <= H - PV + 0.5) break; chosen = build(k) }
    if (chosen.bottom > H - PV + 1) throw new Error('The footer text does not fit its section')
    items.push(...chosen.items)
  }

  // C. Metadata: the document number, when it was issued, the contact address and the page, each with its red line icon.
  {
    const x = xC + 6, ic = 7.5, tx = x + ic + 3.5, w = xD - 5 - tx, size = 4.9
    const rows: Array<{ glyph: 'document' | 'calendar' | 'mail'; label?: string; lines: string[] }> = [
      { glyph: 'document', label: 'Nomor dokumen', lines: wrapMono(o.number, w, size) },
      { glyph: 'calendar', label: 'Diterbitkan', lines: wrapMono(o.issuedOn, w, size) },
      { glyph: 'mail', lines: wrapMono(o.issuer.email, w, size) },
      { glyph: 'document', lines: o.pageLine.split(/\s*\|\s*/).flatMap((part, i, all) => wrapMono(i < all.length - 1 ? `${part} |` : part, w, size)) },
    ]
    const heights = rows.map((r) => (r.label ? size + 1.4 : 0) + r.lines.length * (size + 1.4))
    const gap = Math.max(1.5, (ih - heights.reduce((a, b) => a + b, 0)) / (rows.length - 1))
    let y = PV
    rows.forEach((r, i) => {
      const rowTop = y
      items.push({ t: 'glyph', name: r.glyph, x, y: rowTop + (r.label ? 0 : 0) - 0.4, size: ic, color: RED })
      let ty = rowTop + size
      if (r.label) { items.push(mono(tx, ty, r.label, size - 0.3, MUTED)); ty += size + 1.4 }
      for (const line of r.lines) { items.push(mono(tx, ty, line, size, INK, i === 3 && false)); ty += size + 1.4 }
      y += heights[i] + gap
    })
  }

  // D. The QR code (dark modules, white, its own quiet zone) and E. the VORA stamp, as tall as the QR modules and aligned to them.
  items.push({ t: 'qr', x: xD + (D - QR) / 2, y: qrTop, size: QR })
  items.push({ t: 'hotspot', x: xD + (D - QR) / 2, y: qrTop, w: QR, h: QR, url: o.url })
  for (const i of lockup(lw, ICON_RATIO, xE + 7, qrTop + quiet).items) items.push(i)
  return { width: W, height: H, qrSize: QR, items, kind: 'footer' }
}

export { fitText, textWidth, SLATE }
