import { HELVETICA_WIDTHS } from './helvetica-metrics'
import { ICON_ART, WORDMARK_ART } from './stamp-art'
import { qrMatrix, QUIET_MODULES } from './trust-qr'

/**
 * The VORA Document Verification Mark: the corporate lockup (the approved A icon, the approved wordmark, a rule and PT SATU ARAH INTERNATIONAL, in one red,
 * with no box around it) set beside a QR code. This module only DECIDES where everything goes. Nothing here draws: the PDF painter (server/pdf/trust-mark.ts)
 * and the browser preview (components/trust/TrustMark.tsx) both read the same layout, so what the person sees in the editor is what the PDF prints.
 *
 * Lengths are PDF points, with the origin at the top left of the mark and y growing downwards. The QR code is never overlapped: it sits beside or
 * above the lockup, on its own white square that includes the quiet zone.
 *
 * THE MARK IS A GRAPHIC. It is not a PSrE-certified electronic seal and not an electronic signature; what it points to (the verification page) is what proves anything.
 */
export const RED = '#B43E31'
export const INK = '#101720'
export const SLATE = '#64717C'
export const CORPORATE_NAME = 'PT SATU ARAH INTERNATIONAL'

export type Lang = 'id' | 'en'
export type MarkVariant = 'compact' | 'standard' | 'signing'
export type Arrangement = 'horizontal' | 'stacked'

export type MarkItem =
  | { t: 'qr'; x: number; y: number; size: number }
  | { t: 'icon' | 'wordmark'; x: number; y: number; w: number; h: number }
  | { t: 'rule'; x: number; y: number; w: number; h: number; color?: string }
  | { t: 'text'; x: number; y: number; text: string; size: number; bold: boolean; color: string; /** Spread the letters so that the text is exactly this wide. */ fit?: number }

export interface MarkLayout {
  width: number; height: number; qrSize: number; items: MarkItem[]; variant: MarkVariant; arrangement: Arrangement
  /** A preview is labelled just above the mark's box; the label is not part of the box, so a preview and the final mark occupy exactly the same space. */
  badge?: { text: string; size: number }
}

export interface MarkOptions {
  variant: MarkVariant
  arrangement?: Arrangement
  lang: Lang
  /** The address in the QR code. Only its host and the start of its token are printed. */
  url: string
  /** 1 is the size the variant is designed at; a smaller mark is the same drawing, uniformly smaller. The QR code never falls under MIN_QR_POINTS. */
  scale?: number
  /**
   * `personal: false` is VORA's own endorsement of a file (the corporate mark, issued by the application): it names the company, carries the document number instead of a
   * signing event, and says plainly that it is not a personal electronic signature. `personal` (the default) is a signing by an authorised individual.
   */
  signing?: { purposeLabel: string; name: string; position: string; eventRef: string; signedAt?: string; personal?: boolean }
  /** A preview shows where the mark will go; it is marked as one and carries no signing time. */
  preview?: boolean
}

/** About 20 mm: under this a QR code of this density stops scanning reliably from a printout. */
export const MIN_QR_POINTS = 56.7
/** The QR square (quiet zone included) of each variant, in points: 26.8 mm, 32.5 mm and 29.6 mm. */
const QR_SIZE = { compact: 76, standard: 92, signing: 84 } as const
/** The icon is this fraction of the lockup's width (the approved reference has it a little over half). */
const ICON_RATIO = 0.58
/** Space between the QR square and the lockup. The QR square already carries its own white quiet zone, so the visible gap is larger than this. */
const GAP = 5
const CAP_HEIGHT = 0.718      // Helvetica Bold

const [, , iw, ih] = ICON_ART.viewBox
const [, , ww, wh] = WORDMARK_ART.viewBox
export const ICON_ASPECT = ih / iw
export const WORDMARK_ASPECT = wh / ww

const WORDS: Record<Lang, { verify: string; ref: string; preview: string; signedAt: string; pendingTime: string; eventRef: string; nonCertified: string; scan: string; documentRef: string; registered: string; notPersonal: string }> = {
  id: { verify: 'Periksa keaslian dokumen', ref: 'Ref', preview: 'PRATINJAU', signedAt: 'Ditandatangani', pendingTime: 'Waktu ditetapkan saat penandatanganan', eventRef: 'Peristiwa tanda tangan', nonCertified: 'Tanda tangan elektronik tidak tersertifikasi', scan: 'Pindai untuk memeriksa', documentRef: 'Nomor dokumen', registered: 'Didaftarkan', notPersonal: 'Penanda VORA, bukan tanda tangan elektronik pribadi' },
  en: { verify: 'Verify document authenticity', ref: 'Ref', preview: 'PREVIEW', signedAt: 'Signed', pendingTime: 'Time is set when the document is signed', eventRef: 'Signing event', nonCertified: 'Non-certified electronic signature', scan: 'Scan to verify', documentRef: 'Document no.', registered: 'Registered', notPersonal: 'VORA mark, not a personal electronic signature' },
}
export const markWords = (lang: Lang) => WORDS[lang]

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

/** What is printed of the verification address: the host and the start of the token, so that the printed reference is readable and the full address stays in the QR code. */
export function shortReference(url: string): { host: string; ref: string } {
  let host = 'voraworld.id', token = ''
  try { const u = new URL(url); host = u.host; token = u.pathname.split('/').filter(Boolean).pop() ?? '' } catch { /* the QR code still carries whatever was given */ }
  return { host, ref: token.slice(0, 8).toUpperCase() }
}

/**
 * The line printed under a mark: the whole address when it fits the width at 5 pt or more (so a person can read it out or type it), otherwise the host and
 * the start of the token. It is the clickable link of the mark either way; the full address is always in the QR code and in the link itself.
 */
export function linkLine(url: string, width: number): { text: string; size: number } {
  const bare = url.replace(/^https?:\/\//, '')
  for (let size = 6.4; size >= 5.0; size -= 0.2) if (textWidth(bare, size) <= width) return { text: bare, size: Number(size.toFixed(1)) }
  const { host, ref } = shortReference(url)
  return { text: `${host}/verify  ${WORDS.en.ref} ${ref}`, size: 6.2 }
}

interface Lockup { width: number; height: number; items: MarkItem[] }

/** The corporate lockup at `lw` wide, from (x, y): icon, wordmark, a rule as wide as the wordmark, and the name spread to the same width. Proportions follow the approved reference. */
export function lockup(lw: number, iconRatio: number, x = 0, y = 0): Lockup {
  const iconW = lw * iconRatio, iconH = iconW * ICON_ASPECT
  const wordH = lw * WORDMARK_ASPECT
  // Close together, so that icon, wordmark, rule and name read as one stamp: the gaps are a few percent of the width.
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
export const lockupWidthForHeight = (height: number, iconRatio = ICON_RATIO): number => (height * 100) / lockup(100, iconRatio).height     // measured at 100 wide: the hairline rule has a minimum thickness, so a tiny reference would not be proportional

/** Scales every length of a layout by `k` (the drawing is uniformly smaller or larger, never stretched). */
function scaled(items: MarkItem[], k: number): MarkItem[] {
  return items.map((i) => {
    switch (i.t) {
      case 'qr': return { ...i, x: i.x * k, y: i.y * k, size: i.size * k }
      case 'text': return { ...i, x: i.x * k, y: i.y * k, size: i.size * k, fit: i.fit === undefined ? undefined : i.fit * k }
      default: return { ...i, x: i.x * k, y: i.y * k, w: i.w * k, h: i.h * k }
    }
  })
}

export function layoutMark(o: MarkOptions): MarkLayout {
  const words = WORDS[o.lang]
  const arrangement: Arrangement = o.variant === 'compact' ? 'horizontal' : (o.arrangement ?? 'horizontal')
  const qr = QR_SIZE[o.variant]
  const items: MarkItem[] = []
  let width: number, height: number
  // The part of the QR square that is dark modules: the quiet zone around it is white paper and cannot be seen. The lockup is as tall as this, and is aligned to it.
  const n = qrMatrix(o.url).size
  const quiet = (qr * QUIET_MODULES) / (n + 2 * QUIET_MODULES)
  const modules = qr - 2 * quiet

  if (arrangement === 'horizontal') {
    const lw = lockupWidthForHeight(modules)
    const lock = lockup(lw, ICON_RATIO)
    items.push({ t: 'qr', x: 0, y: 0, size: qr })
    const lx = qr + GAP
    for (const i of lock.items) items.push(shift(i, lx, quiet))
    width = lx + lw; height = qr
  } else {
    // Stacked: the lockup is as wide as the QR's modules, centred above it; the captions below may be wider than the QR, and then the mark is as wide as they are.
    const lw = modules
    const lock = lockup(lw, ICON_RATIO)
    const sr = shortReference(o.url)
    width = Math.max(qr, o.variant === 'compact' ? 0 : Math.max(textWidth(WORDS[o.lang].verify, 7, true), textWidth(`${sr.host}/verify  ${WORDS.en.ref} ${sr.ref}`, 6.2)))
    const ox = (width - qr) / 2
    for (const i of lock.items) items.push(shift(i, ox + quiet, 0))
    items.push({ t: 'qr', x: ox, y: lock.height + GAP, size: qr })
    height = lock.height + GAP + qr
  }
  const { host, ref } = shortReference(o.url)

  if (o.variant !== 'compact') {
    height += 8
    const centre = (text: string, size: number, bold: boolean) => (arrangement === 'stacked' ? Math.max(0, (width - textWidth(text, size, bold)) / 2) : 0)
    items.push({ t: 'text', x: centre(words.verify, 7, true), y: height + 6, text: words.verify, size: 7, bold: true, color: INK }); height += 9
    const link = linkLine(o.url, width)
    items.push({ t: 'text', x: centre(link.text, link.size, false), y: height + link.size, text: link.text, size: link.size, bold: false, color: SLATE })
    // The address is a link in the PDF: it is underlined, and so is the whole mark clickable (see server/pdf/trust-mark.ts).
    items.push({ t: 'rule', x: centre(link.text, link.size, false), y: height + link.size + 1.2, w: textWidth(link.text, link.size, false), h: 0.4, color: SLATE })
    height += link.size + 3
  }

  if (o.variant === 'signing') {
    const s = o.signing
    const rows: Array<[string, number, boolean, string]> = []
    if (s) {
      const personal = s.personal !== false
      rows.push([s.purposeLabel, 6.2, false, SLATE])
      rows.push([s.name, 8.6, true, INK])
      if (s.position) rows.push([s.position, 6.8, false, INK])
      rows.push([`${personal ? words.eventRef : words.documentRef}: ${s.eventRef}`, 6, false, SLATE])
      // A preview, and a mark that has no time yet, carry no time: it is never invented. The row is there either way, so the box is the same size.
      rows.push([!o.preview && s.signedAt ? `${personal ? words.signedAt : words.registered}: ${s.signedAt}` : words.pendingTime, 6, false, SLATE])
      rows.push([personal ? words.nonCertified : words.notPersonal, 5.6, false, SLATE])
    } else rows.push([words.nonCertified, 5.6, false, SLATE])
    height += 7
    for (const [text, size, bold, color] of rows) {
      items.push({ t: 'text', x: 0, y: height + size, text: fitText(text, size, bold, width), size, bold, color })
      height += size + 3
    }
    height -= 3
  }

  const k = Math.min(Math.max(o.scale ?? 1, minScale(o.variant)), 3)
  const out = k === 1 ? items : scaled(items, k)
  const qrSize = qr * k
  return { width: width * k, height: height * k, qrSize, items: out, variant: o.variant, arrangement, badge: o.preview ? { text: words.preview, size: 6.5 * k } : undefined }
}

function shift(i: MarkItem, dx: number, dy: number): MarkItem { return { ...i, x: i.x + dx, y: i.y + dy } }

/** The smallest scale at which the mark's QR code is still about 20 mm. */
export function minScale(variant: MarkVariant): number { return MIN_QR_POINTS / QR_SIZE[variant] }
