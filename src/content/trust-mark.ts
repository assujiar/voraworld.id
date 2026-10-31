import { HELVETICA_WIDTHS } from './helvetica-metrics'
import { ICON_ART, WORDMARK_ART } from './stamp-art'

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

export interface MarkLayout { width: number; height: number; qrSize: number; items: MarkItem[]; variant: MarkVariant; arrangement: Arrangement }

export interface MarkOptions {
  variant: MarkVariant
  arrangement?: Arrangement
  lang: Lang
  /** The address in the QR code. Only its host and the start of its token are printed. */
  url: string
  /** 1 is the size the variant is designed at; a smaller mark is the same drawing, uniformly smaller. The QR code never falls under MIN_QR_POINTS. */
  scale?: number
  signing?: { purposeLabel: string; name: string; position: string; eventRef: string; signedAt?: string }
  /** A preview shows where the mark will go; it is marked as one and carries no signing time. */
  preview?: boolean
}

/** About 20 mm: under this a QR code of this density stops scanning reliably from a printout. */
export const MIN_QR_POINTS = 56.7
const QR_SIZE = { compact: 66, standard: 82, signing: 82 } as const
const LOCKUP_WIDTH = { compact: 106, standard: 150, signing: 118 } as const
const ICON_RATIO = { compact: 0.46, standard: 0.56, signing: 0.52 } as const
const GAP = 12
const CAP_HEIGHT = 0.718      // Helvetica Bold

const [, , iw, ih] = ICON_ART.viewBox
const [, , ww, wh] = WORDMARK_ART.viewBox
export const ICON_ASPECT = ih / iw
export const WORDMARK_ASPECT = wh / ww

const WORDS: Record<Lang, { verify: string; ref: string; preview: string; signedAt: string; pendingTime: string; eventRef: string; nonCertified: string; scan: string }> = {
  id: { verify: 'Periksa keaslian dokumen', ref: 'Ref', preview: 'PRATINJAU', signedAt: 'Ditandatangani', pendingTime: 'Waktu ditetapkan saat penandatanganan', eventRef: 'Peristiwa tanda tangan', nonCertified: 'Tanda tangan elektronik tidak tersertifikasi', scan: 'Pindai untuk memeriksa' },
  en: { verify: 'Verify document authenticity', ref: 'Ref', preview: 'PREVIEW', signedAt: 'Signed', pendingTime: 'Time is set when the document is signed', eventRef: 'Signing event', nonCertified: 'Non-certified electronic signature', scan: 'Scan to verify' },
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
 * The line printed under a mark: the whole address when it fits the width at 5.4 pt or more (so a person can read it out or type it), otherwise the host and
 * the start of the token. It is the clickable link of the mark either way; the full address is always in the QR code and in the link itself.
 */
export function linkLine(url: string, width: number): { text: string; size: number } {
  const bare = url.replace(/^https?:\/\//, '')
  for (let size = 6.4; size >= 5.4; size -= 0.2) if (textWidth(bare, size) <= width) return { text: bare, size: Number(size.toFixed(1)) }
  const { host, ref } = shortReference(url)
  return { text: `${host}/verify  ${WORDS.en.ref} ${ref}`, size: 6.2 }
}

interface Lockup { width: number; height: number; items: MarkItem[] }

/** The corporate lockup at `lw` wide, from (x, y): icon, wordmark, a rule as wide as the wordmark, and the name spread to the same width. Proportions follow the approved reference. */
export function lockup(lw: number, iconRatio: number, x = 0, y = 0): Lockup {
  const iconW = lw * iconRatio, iconH = iconW * ICON_ASPECT
  const wordH = lw * WORDMARK_ASPECT
  const g1 = lw * 0.07, g2 = lw * 0.045, ruleH = Math.max(0.6, lw * 0.0105), g3 = lw * 0.045
  // The name is set at the size where its natural width is 90% of the lockup, then spread to the full width.
  const size = (0.9 * lw) / textWidth(CORPORATE_NAME, 1, true)
  const cap = CAP_HEIGHT * size
  let cy = y
  const items: MarkItem[] = []
  items.push({ t: 'icon', x: x + (lw - iconW) / 2, y: cy, w: iconW, h: iconH }); cy += iconH + g1
  items.push({ t: 'wordmark', x, y: cy, w: lw, h: wordH }); cy += wordH + g2
  items.push({ t: 'rule', x, y: cy, w: lw, h: ruleH }); cy += ruleH + g3
  items.push({ t: 'text', x, y: cy + cap, text: CORPORATE_NAME, size, bold: true, color: RED, fit: lw }); cy += cap
  return { width: lw, height: cy - y, items }
}

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
  const lw = LOCKUP_WIDTH[o.variant]
  const qr = QR_SIZE[o.variant]
  const lock = lockup(lw, ICON_RATIO[o.variant])
  const items: MarkItem[] = []
  let width: number, height: number
  const { host, ref } = shortReference(o.url)

  if (arrangement === 'horizontal') {
    const rowH = Math.max(qr, lock.height)
    items.push({ t: 'qr', x: 0, y: (rowH - qr) / 2, size: qr })
    const lx = qr + GAP
    for (const i of lock.items) items.push(shift(i, lx, (rowH - lock.height) / 2))
    width = lx + lw; height = rowH
  } else {
    width = Math.max(lw, qr)
    for (const i of lock.items) items.push(shift(i, (width - lw) / 2, 0))
    items.push({ t: 'qr', x: (width - qr) / 2, y: lock.height + GAP, size: qr })
    height = lock.height + GAP + qr
  }

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
    if (o.preview) rows.push([`${words.preview} - ${words.pendingTime}`, 6, true, RED])
    if (s) {
      rows.push([s.purposeLabel, 6.2, false, SLATE])
      rows.push([s.name, 8.6, true, INK])
      rows.push([s.position, 6.8, false, INK])
      rows.push([`${words.eventRef}: ${s.eventRef}`, 6, false, SLATE])
      if (!o.preview) rows.push([s.signedAt ? `${words.signedAt}: ${s.signedAt}` : words.pendingTime, 6, false, SLATE])
    }
    rows.push([words.nonCertified, 5.6, false, SLATE])
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
  return { width: width * k, height: height * k, qrSize, items: out, variant: o.variant, arrangement }
}

function shift(i: MarkItem, dx: number, dy: number): MarkItem { return { ...i, x: i.x + dx, y: i.y + dy } }

/** The smallest scale at which the mark's QR code is still about 20 mm. */
export function minScale(variant: MarkVariant): number { return MIN_QR_POINTS / QR_SIZE[variant] }
