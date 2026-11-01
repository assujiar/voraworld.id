import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { sha256Hex } from '@/server/crypto'
import { inspectSignedQuotation, requiresStamp } from '@/server/finance/pdf-inspect'
import { makePdf } from '../helpers/pdf'

/** What a customer may upload for a quotation: a readable PDF, not necessarily the file VORA sent. */

/** A page that is only a picture, as a scanner or a phone's document scanner makes it: no text layer at all. */
async function scannedPdf(width = 600, height = 800): Promise<Uint8Array> {
  const png = await sharp({ create: { width, height, channels: 3, background: '#f4f4f4' } }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M80 600 C 200 500 300 700 420 560" stroke="#123" stroke-width="6" fill="none"/></svg>`) }]).png().toBuffer()
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const image = await doc.embedPng(png)
  page.drawImage(image, { x: 0, y: 0, width: 595, height: 842 })
  return doc.save()
}

describe('the signed quotation a customer uploads', () => {
  it('may be a scan of the printed copy, signed and stamped by hand: a picture with no text, and not the number of the quotation anywhere', async () => {
    const scan = await scannedPdf()
    await expect(inspectSignedQuotation(scan)).resolves.toBe(await sha256Hex(scan))
  })

  it('does not have to be the file VORA sent, nor to contain its number', async () => {
    const other = await makePdf(['a different document, signed and stamped'])
    await expect(inspectSignedQuotation(other)).resolves.toBe(await sha256Hex(other))
    const several = await makePdf(['page one'], { pages: 4 })
    await expect(inspectSignedQuotation(several)).resolves.toBe(await sha256Hex(several))
  })

  it('still has to be a readable PDF without active content, within the page limit', async () => {
    await expect(inspectSignedQuotation(await makePdf(['x'], { openActionScript: true }))).rejects.toThrow(/Active or executable/)
    await expect(inspectSignedQuotation(await makePdf(['x'], { encrypted: true }))).rejects.toThrow(/unencrypted|damaged/)
    await expect(inspectSignedQuotation(await makePdf(['x'], { pages: 16 }))).rejects.toThrow(/1-15 pages/)
    await expect(inspectSignedQuotation(new TextEncoder().encode('<html>not a pdf</html>'.padEnd(400)))).rejects.toThrow(/Upload a PDF/)
    await expect(inspectSignedQuotation(new TextEncoder().encode('%PDF-1.4 not really a pdf'.padEnd(400)))).rejects.toThrow(/damaged|unencrypted|pages/)
    const real = await makePdf(['hello'])
    await expect(inspectSignedQuotation(real.slice(0, Math.floor(real.length / 2)))).rejects.toThrow(/damaged|PDF/)
  })
})

describe('the e-meterai rule', () => {
  it('is still the rule for what it is asked of (the pre-payment receipt): foreign currency, and above IDR 5,000,000', () => {
    expect(requiresStamp('IDR', 5_000_000)).toBe(false); expect(requiresStamp('IDR', 5_000_001)).toBe(true); expect(requiresStamp('USD', 1)).toBe(true)
  })
})
