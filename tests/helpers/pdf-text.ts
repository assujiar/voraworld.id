import { spawnSync } from 'node:child_process'
import { extractText, getDocumentProxy } from 'unpdf'

/** The text of each page, read back with PDF.js, so tests check what a customer would actually see. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes.slice())
  const { text } = await extractText(pdf, { mergePages: false })
  return text
}

/** Single-spaced text, so a sentence that wrapped over two lines still matches. */
export const squash = (s: string) => s.split(/\s+/).filter(Boolean).join(' ')

const hasPoppler = spawnSync('pdftotext', ['-v']).status !== null && !spawnSync('pdftotext', ['-v']).error
/** Poppler is a second, independent PDF implementation: if it can read the file, the file is structurally sound. */
export function poppler(bytes: Uint8Array): string | null {
  if (!hasPoppler) return null
  const r = spawnSync('pdftotext', ['-layout', '-', '-'], { input: Buffer.from(bytes), maxBuffer: 20_000_000 })
  if (r.status !== 0) throw new Error('pdftotext rejected the file: ' + r.stderr.toString())
  return r.stdout.toString()
}
