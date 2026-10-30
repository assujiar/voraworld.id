import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib'
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

const hasPdftoppm = !spawnSync('pdftoppm', ['-v']).error

export interface Raster { width: number; height: number; /** pixels per point */ scale: number; at(x: number, y: number): [number, number, number] }
/**
 * One page as pixels (72 dpi by default, so one pixel is one point; y counted from the TOP), drawn by Poppler: what a person
 * sees, not what the drawing commands say. Null when Poppler is not installed (the visual checks are then skipped).
 */
export function rasterize(bytes: Uint8Array, page: number, dpi = 72): Raster | null {
  if (!hasPdftoppm) return null
  const dir = mkdtempSync(join(tmpdir(), 'vora-raster-'))
  try {
    writeFileSync(join(dir, 'in.pdf'), bytes)
    const r = spawnSync('pdftoppm', ['-r', String(dpi), '-f', String(page), '-l', String(page), '-singlefile', join(dir, 'in.pdf'), join(dir, 'out')])
    if (r.status !== 0) throw new Error('pdftoppm rejected the file: ' + r.stderr.toString())
    const ppm = readFileSync(join(dir, 'out.ppm'))                              // P6 <width> <height> 255 <binary RGB>
    let pos = 0
    const token = () => {
      while (/\s/.test(String.fromCharCode(ppm[pos]))) pos++
      const start = pos
      while (!/\s/.test(String.fromCharCode(ppm[pos]))) pos++
      return ppm.toString('latin1', start, pos)
    }
    if (token() !== 'P6') throw new Error('unexpected pdftoppm output')
    const width = Number(token()), height = Number(token())
    token(); pos++
    const data = ppm.subarray(pos)
    return { width, height, scale: dpi / 72, at: (x, y) => { const i = (y * width + x) * 3; return [data[i], data[i + 1], data[i + 2]] } }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The web addresses each page links to (its clickable areas), in drawing order: what a click in a PDF viewer opens. */
export async function pdfLinks(bytes: Uint8Array): Promise<string[][]> {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((page) => {
    const urls: string[] = []
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (annots instanceof PDFArray) {
      for (let i = 0; i < annots.size(); i++) {
        const annotation = annots.lookup(i, PDFDict)
        const action = annotation.lookup(PDFName.of('A'))
        if (annotation.get(PDFName.of('Subtype')) !== PDFName.of('Link') || !(action instanceof PDFDict)) continue
        const uri = action.lookup(PDFName.of('URI'))
        if (uri instanceof PDFString) urls.push(uri.decodeText())
      }
    }
    return urls
  })
}
