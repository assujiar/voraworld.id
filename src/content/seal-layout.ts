import type { Lang } from './trust-mark'
import { layoutSignature, type SignatureOptions, type SignatureType } from './verification-blocks'

/**
 * THE placement geometry model, for the browser editor and for the PDF that is made. One function decides where a mark sits on a page, and both use it, so the
 * preview is the placement. Lengths are PDF points; positions are measured on the page AS THE READER SEES IT (rotation and crop box already applied), from the
 * top left of the page to the top left of the mark, as fractions (0 to 1) of the page's width and height. A fraction is what is stored, so it survives a change of
 * zoom, of screen size and of orientation, and means the same thing on every device.
 */
export const SEAL_MARGIN = 22
/** The mark may be dragged right up to this distance from the edge of the page. */
const EDGE = 6

export type SealSize = 'small' | 'medium'
export const SIZE_SCALE: Record<string, number> = { small: 0.8, medium: 1 }

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi))

/** "0.5" -> 0.5 when it is a number from 0 to 1, otherwise null. */
export function fraction(value: string | undefined): number | null {
  if (value === undefined || !/^(0|1|0?\.\d{1,6}|1\.0{1,6})$/.test(value.trim())) return null
  const n = Number(value)
  return n >= 0 && n <= 1 ? n : null
}

export interface SealMarkInput {
  type: SignatureType; lang: Lang; url: string; size: string
  /** The document's number (what the first row shows). */
  number: string
  /** When it was registered or signed, already formatted; absent in a preview. */
  registeredAt?: string
  /** A personal signing: who signed, in what position. Absent for VORA's own corporate registration of a file. */
  signer?: { name: string; position: string }
  preview?: boolean
}

const ISSUER_NAME = 'PT Satu Arah International'
const ISSUER_ROLE: Record<Lang, string> = { id: 'Penerbit dokumen', en: 'Document issuer' }

/** The options of the signature component for a seal: a personal signing names the signer; VORA's own registration names the company as the issuer. The browser and the PDF build them here, from the same inputs. */
export function sealMarkOptions(i: SealMarkInput): SignatureOptions {
  return { type: i.type, lang: i.lang, url: i.url, number: i.number, registeredAt: i.registeredAt, name: i.signer?.name ?? ISSUER_NAME, position: i.signer?.position ?? ISSUER_ROLE[i.lang], scale: SIZE_SCALE[i.size] ?? 1, preview: i.preview }
}

/** How much room the component takes on the page, in points. The same for a preview and for the finished one, and the same for Type 1 and Type 2. */
export function sealDims(i: SealMarkInput): { w: number; h: number } {
  const l = layoutSignature(sealMarkOptions(i))
  return { w: l.width, h: l.height }
}

/**
 * The mark's rectangle: `left` and `bottom` (origin bottom left) and its size, for a page `vw` x `vh` points. `corner` is one of the four corners or "custom", in which
 * case `posX` and `posY` (0 to 1, from the page's top left to the mark's top left) say where it was dropped.
 */
export function placeSeal(vw: number, vh: number, dims: { w: number; h: number }, corner: string, posX: number | null, posY: number | null): { left: number; bottom: number; w: number; h: number } {
  const { w, h } = dims
  if (corner === 'custom' && posX !== null && posY !== null) {
    const left = clamp(posX * vw, EDGE, vw - w - EDGE)
    const top = clamp(posY * vh, EDGE, vh - h - EDGE)
    return { left, bottom: vh - top - h, w, h }
  }
  return { left: corner.endsWith('left') ? SEAL_MARGIN : vw - SEAL_MARGIN - w, bottom: corner.startsWith('top') ? vh - SEAL_MARGIN - h : SEAL_MARGIN, w, h }
}

/** The placement as the fractions that are stored: top left of the mark, from the top left of the page. */
export function placementFractions(vw: number, vh: number, rect: { left: number; bottom: number; h: number }): { x: number; y: number } {
  return { x: rect.left / vw, y: (vh - rect.bottom - rect.h) / vh }
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
