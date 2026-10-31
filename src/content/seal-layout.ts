import { layoutMark, type Lang, type MarkOptions } from './trust-mark'
import { PURPOSE_LABELS, type SigningPurpose } from './trust-policy'

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
  lang: Lang; url: string; purpose: string; size: string
  /** The document number (a corporate mark) or the signing reference (a personal signing). */
  reference: string
  /** A personal signing: who signed, in what position. Absent for VORA's own corporate mark. */
  signer?: { name: string; position: string }
  signedAt?: string
  preview?: boolean
}

/** The mark options for a seal: VORA's corporate endorsement (no signer), or a personal signing stamp (a signer). The browser and the PDF build them here, from the same inputs. */
export function sealMarkOptions(i: SealMarkInput): MarkOptions {
  const purpose = (i.purpose in PURPOSE_LABELS[i.lang] ? i.purpose : 'verified') as SigningPurpose
  return {
    variant: 'signing', lang: i.lang, url: i.url, scale: SIZE_SCALE[i.size] ?? 1, preview: i.preview,
    signing: i.signer
      ? { purposeLabel: PURPOSE_LABELS[i.lang][purpose], name: i.signer.name, position: i.signer.position, eventRef: i.reference, signedAt: i.signedAt, personal: true }
      : { purposeLabel: PURPOSE_LABELS[i.lang][purpose], name: 'PT Satu Arah International', position: '', eventRef: i.reference, signedAt: i.signedAt, personal: false },
  }
}

/** How much room the mark takes on the page, in points. The same for a preview and for the finished mark. */
export function sealDims(i: SealMarkInput): { w: number; h: number } {
  const l = layoutMark(sealMarkOptions(i))
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
