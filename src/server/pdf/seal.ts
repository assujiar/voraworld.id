import { PDFDocument } from 'pdf-lib'
import { ActionError } from '../errors'
import type { Lang } from '../../content/document-types'
import { fraction, placeSeal, SEAL_MARGIN, sealDims, sealedPages, sealMarkOptions } from '../../content/seal-layout'
import { layoutMark } from '../../content/trust-mark'
import { embedMarkFonts, PageView, paintMark } from './trust-mark'

/**
 * Adds a VORA mark to a PDF that somebody else issued. The original content is not touched: the mark is drawn on top, on the pages chosen, where the person put
 * it (or in the corner chosen), whatever the rotation or crop box of the page. It is the same mark the editor shows (content/trust-mark.ts), the same placement
 * (content/seal-layout.ts), and a link as well as a QR code to the document's verification page, which shows the SHA-256 of the file.
 *
 * Two kinds of mark, never mixed:
 *   corporate  (no `signer`)  VORA registered the file and vouches that it did (it names the company and the document number, not a person).
 *   personal   (`signer`)     an authorised individual signed it in VORA (the signing ceremony; see trust/signing.ts), and the mark names them and the signing event.
 */
export interface SealOptions {
  verificationUrl: string; lang: Lang
  /** The document number (corporate mark) or the signing reference (personal). */
  reference: string
  purpose: string; pages: string; corner: string; size: string
  /** The page chosen when `pages` is `one`, and where the mark was dropped when `corner` is `custom` (0 to 1 from the top left). */
  pageNumber?: string; posX?: string; posY?: string
  /** Shown as it is, already in Jakarta time. */
  issuedAt?: string
  signer?: { name: string; position: string }
  /** A preview shows where the mark will go and is marked as a preview; it is never stored. */
  preview?: boolean
}

export const MAX_SEAL_PAGES = 200

export async function sealPdf(source: Uint8Array, o: SealOptions): Promise<{ bytes: Uint8Array; pagesSealed: number }> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(source, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true })
  } catch (e) {
    throw new ActionError(e instanceof Error && /encrypted/i.test(e.message) ? 'The PDF is encrypted: upload a copy without a password' : 'This PDF cannot be opened to add the seal. Invalid or damaged PDF')
  }
  const total = doc.getPageCount()
  if (total < 1 || total > MAX_SEAL_PAGES) throw new ActionError(`The PDF must have 1 to ${MAX_SEAL_PAGES} pages`)
  const input = { lang: o.lang, url: o.verificationUrl, purpose: o.purpose, size: o.size, reference: o.reference, signer: o.signer, signedAt: o.issuedAt, preview: o.preview }
  const layout = layoutMark(sealMarkOptions(input))
  const dims = sealDims(input)
  const fonts = await embedMarkFonts(doc)
  let indexes: number[]
  try { indexes = sealedPages(total, o.pages, o.pageNumber ? Number.parseInt(o.pageNumber, 10) : null) } catch { throw new ActionError(`The PDF has ${total} page${total > 1 ? 's' : ''}: choose a page from 1 to ${total}`) }
  const posX = fraction(o.posX), posY = fraction(o.posY)

  for (const index of indexes) {
    const page = doc.getPage(index)
    const view = new PageView(page)
    if (view.width < dims.w + SEAL_MARGIN * 2 || view.height < dims.h + SEAL_MARGIN * 2) throw new ActionError(`Page ${index + 1} is too small for the seal: choose the small size`)
    const { left, bottom } = placeSeal(view.width, view.height, dims, o.corner, posX, posY)
    paintMark(page, fonts, layout, o.verificationUrl, view.map(left, bottom + dims.h))
  }
  const bytes = await doc.save({ useObjectStreams: false })
  return { bytes, pagesSealed: indexes.length }
}
