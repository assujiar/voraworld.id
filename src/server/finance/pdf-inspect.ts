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
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true })
  } catch (e) {
    const encrypted = e instanceof Error && /encrypted/i.test(e.message)
    throw new ActionError(encrypted ? `PDF must be readable, unencrypted and 1-${rules.maxPages} pages` : 'Invalid or damaged PDF')
  }
  const pages = doc.getPageCount()
  if (pages < 1 || pages > rules.maxPages) throw new ActionError(`PDF must be readable, unencrypted and 1-${rules.maxPages} pages`)
  const refused = activeContent(doc)
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

