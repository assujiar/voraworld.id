import { PDFDict, PDFDocument, PDFName, PDFStream } from 'pdf-lib'
import { extractText, getDocumentProxy } from 'unpdf'
import { sha256Hex } from '../crypto'
import { maxUploadBytes } from '../env'
import { ActionError } from '../errors'

/**
 * Structural checks for PDFs that people upload and that VORA then keeps as records (stamped receipts,
 * customer-signed quotations). It never judges a signature or an e-meterai: it only makes sure the file is
 * an ordinary, readable, unencrypted PDF that still carries the VORA document numbers and no active content.
 */
export const STAMP_LIMIT_IDR = 5_000_000

/** An e-meterai is needed above IDR 5,000,000, and always for foreign currency (no FX rate is assumed). */
export const requiresStamp = (currency: string, amountMinor: number): boolean => currency !== 'IDR' || amountMinor > STAMP_LIMIT_IDR

const megabytes = () => Math.max(1, Math.floor(maxUploadBytes() / (1024 * 1024)))

interface Rules { maxPages: number; numbers: string[]; missingNumber: string; sizeMessage?: string }

const NAMES = {
  openAction: PDFName.of('OpenAction'), aa: PDFName.of('AA'), names: PDFName.of('Names'), javascript: PDFName.of('JavaScript'),
  js: PDFName.of('JS'), s: PDFName.of('S'), launch: PDFName.of('Launch'), root: PDFName.of('Root'),
}

/** JavaScript, launch actions and automatic actions anywhere in the file make a financial record unsafe to open. */
function activeContent(doc: PDFDocument): string | null {
  const catalog = doc.catalog
  if (catalog.has(NAMES.openAction) || catalog.has(NAMES.aa)) return 'Active or executable PDF content is forbidden'
  const names = catalog.lookupMaybe(NAMES.names, PDFDict)
  if (names?.has(NAMES.javascript)) return 'Active or executable PDF content is forbidden'
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null
    if (!dict) continue
    if (dict.has(NAMES.js)) return 'Active or executable PDF content is forbidden'
    const kind = dict.get(NAMES.s)
    if (kind === NAMES.javascript || kind === NAMES.launch) return 'Active or executable PDF content is forbidden'
  }
  return null
}

async function textOf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes.slice())   // PDF.js may take ownership of the buffer
  try {
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  } finally {
    await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => undefined)
  }
}

const squash = (v: string) => v.replace(/\s+/g, '')

async function inspect(bytes: Uint8Array, rules: Rules): Promise<string> {
  const header = Buffer.from(bytes.subarray(0, 5)).toString('latin1')
  if (header !== '%PDF-' || bytes.length > maxUploadBytes() || bytes.length < 300) {
    throw new ActionError(rules.sizeMessage ?? `Only PDF documents up to ${megabytes()} MB are accepted`)
  }
  // pdf-lib is lenient: garbage that merely starts with "%PDF-" loads as an empty document and then fails later, with
  // a TypeError. Anything unexpected while reading the structure therefore means "not a usable PDF".
  let pages: number
  let refused: string | null
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true })
    pages = doc.getPageCount()
    refused = activeContent(doc)
  } catch (e) {
    const encrypted = e instanceof Error && /encrypted/i.test(e.message)
    throw new ActionError(encrypted ? `PDF must be readable, unencrypted and 1-${rules.maxPages} pages` : 'Invalid or damaged PDF')
  }
  if (pages < 1 || pages > rules.maxPages) throw new ActionError(`PDF must be readable, unencrypted and 1-${rules.maxPages} pages`)
  if (refused) throw new ActionError(refused)
  let text: string
  try {
    text = squash(await textOf(bytes))
  } catch {
    throw new ActionError('Invalid or damaged PDF')
  }
  if (!rules.numbers.every((n) => text.includes(squash(n)))) throw new ActionError(rules.missingNumber)
  return sha256Hex(bytes)
}

/** Final stamped receipt: 1-12 pages, still showing the VORA receipt and invoice numbers. Returns its SHA-256. */
export const inspectStampedReceipt = (bytes: Uint8Array, receiptNumber: string, invoiceNumber: string) =>
  inspect(bytes, { maxPages: 12, numbers: [receiptNumber, invoiceNumber], missingNumber: 'Stamped PDF must retain VORA receipt and related invoice numbers' })

/** Customer-signed quotation: 1-15 pages, showing the exact quotation number. Returns its SHA-256. */
export const inspectSignedQuotation = (bytes: Uint8Array, quotationNumber: string) =>
  inspect(bytes, { maxPages: 15, numbers: [quotationNumber], missingNumber: 'The signed file must include the exact VORA quotation number', sizeMessage: `Upload a PDF not exceeding ${megabytes()} MB` })


const BYTE_RANGE = PDFName.of('ByteRange')

/**
 * A PDF issued by somebody else, to be sealed with a QR code. It must be a readable, unencrypted PDF of 1-200 pages without active content. A PDF that
 * already carries a cryptographic signature is refused: adding anything to it would invalidate that signature, and a seal must not break what it seals.
 */
export async function inspectSourcePdf(bytes: Uint8Array): Promise<{ pages: number; sha256: string }> {
  const header = Buffer.from(bytes.subarray(0, 5)).toString('latin1')
  if (header !== '%PDF-' || bytes.length > maxUploadBytes() || bytes.length < 300) throw new ActionError(`Only PDF documents up to ${megabytes()} MB are accepted`)
  let pages: number
  let refused: string | null = null
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true })
    pages = doc.getPageCount()
    refused = activeContent(doc)
    if (!refused) {
      for (const [, obj] of doc.context.enumerateIndirectObjects()) {
        const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null
        if (dict?.has(BYTE_RANGE)) { refused = 'This PDF already carries a digital signature, and adding a seal would invalidate it. Seal an unsigned copy instead'; break }
      }
    }
  } catch (e) {
    const encrypted = e instanceof Error && /encrypted/i.test(e.message)
    throw new ActionError(encrypted ? 'The PDF is encrypted: upload a copy without a password' : 'Invalid or damaged PDF')
  }
  if (pages < 1 || pages > 200) throw new ActionError('The PDF must have 1 to 200 pages')
  if (refused) throw new ActionError(refused)
  return { pages, sha256: await sha256Hex(bytes) }
}
