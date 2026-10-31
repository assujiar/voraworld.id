import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import jsQR from 'jsqr'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFString, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildArt, buildMetrics, readArt, SOURCES } from '../../scripts/embed-trust-assets'
import { ICON_ART, WORDMARK_ART } from '@/content/stamp-art'
import { CORPORATE_NAME, ICON_ASPECT, layoutMark, lockup, MIN_QR_POINTS, minScale, RED, textWidth, WORDMARK_ASPECT, type MarkItem, type MarkOptions } from '@/content/trust-mark'
import { qrMatrix, QUIET_MODULES } from '@/content/trust-qr'
import { drawMark, embedMarkFonts, PageView, paintMark } from '@/server/pdf/trust-mark'
import { rasterize } from '../helpers/pdf-text'

const URL_ = 'https://voraworld.id/verify/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGh'
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const opts = (o: Partial<MarkOptions> = {}): MarkOptions => ({ variant: 'standard', lang: 'en', url: URL_, ...o })
const signing = { purposeLabel: 'Approved by', name: 'Siti Rahma', position: 'Director', eventRef: 'VORA-SIG-A1B2C3D4', signedAt: '31 Oct 2026 11:42 WIB' }
const rect = (i: MarkItem) => i.t === 'qr' ? { x: i.x, y: i.y, w: i.size, h: i.size } : i.t === 'text' ? { x: i.x, y: i.y - i.size, w: i.fit ?? textWidth(i.text, i.size, i.bold), h: i.size } : { x: i.x, y: i.y, w: i.w, h: i.h }
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01

describe('the approved artwork', () => {
  it('is the path data of the approved SVGs, byte for byte, and the generated files are current', async () => {
    expect(read('src/content/stamp-art.ts')).toBe(buildArt())
    expect(read('src/content/helvetica-metrics.ts')).toBe(await buildMetrics())
    for (const [art, src] of [[ICON_ART, SOURCES.icon], [WORDMARK_ART, SOURCES.wordmark]] as const) {
      const svg = read(src)
      expect(art).toEqual(readArt(svg))
      for (const p of art.paths) expect(svg.includes(`d="${p.d}"`)).toBe(true)                  // not one coordinate was touched
      expect(svg).toMatch(/viewBox="[^"]+"/)
    }
    expect(WORDMARK_ART.paths).toHaveLength(2)
    expect(ICON_ART.paths).toHaveLength(2)
  })

  it('keeps the proportions of the icon and wordmark in every variant, never stretched', () => {
    for (const variant of ['compact', 'standard', 'signing'] as const) {
      const items = layoutMark(opts({ variant, signing })).items
      const icon = items.find((i) => i.t === 'icon')!, word = items.find((i) => i.t === 'wordmark')!
      if (icon.t !== 'icon' || word.t !== 'wordmark') throw new Error('missing')
      expect(icon.h / icon.w).toBeCloseTo(ICON_ASPECT, 6)
      expect(word.h / word.w).toBeCloseTo(WORDMARK_ASPECT, 6)
    }
  })

  it('sets the legal name correctly, in one red, with no box and no extra symbol', () => {
    expect(CORPORATE_NAME).toBe('PT SATU ARAH INTERNATIONAL')
    expect(RED).toBe('#B43E31')
    const l = layoutMark(opts())
    expect(l.items.filter((i) => i.t === 'text' && i.text === CORPORATE_NAME)).toHaveLength(1)
    const lock = lockup(150, 0.5)
    const legal = lock.items.find((i) => i.t === 'text')!
    expect(legal.t === 'text' && legal.color).toBe(RED)
    expect(l.items.every((i) => ['qr', 'icon', 'wordmark', 'rule', 'text'].includes(i.t))).toBe(true)      // no border, ring or emblem primitive exists
    // The rule and the name are exactly as wide as the wordmark, as in the approved reference.
    const word = lock.items.find((i) => i.t === 'wordmark')!, rule = lock.items.find((i) => i.t === 'rule')!
    expect(rule.t === 'rule' && word.t === 'wordmark' && rule.w).toBe(word.t === 'wordmark' ? word.w : 0)
    expect(legal.t === 'text' && legal.fit).toBe(150)
  })

  it('keeps the legal name readable in the compact variant (at least 5 pt)', () => {
    const legal = layoutMark(opts({ variant: 'compact' })).items.find((i) => i.t === 'text' && i.text === CORPORATE_NAME)!
    expect(legal.t === 'text' && legal.size).toBeGreaterThanOrEqual(5)
  })
})

describe('layout', () => {
  it('never lets the QR code touch the lockup or any text, in any variant, arrangement or scale', () => {
    for (const variant of ['compact', 'standard', 'signing'] as const) for (const arrangement of ['horizontal', 'stacked'] as const) for (const scale of [0.8, 1, 1.3]) {
      const l = layoutMark(opts({ variant, arrangement, scale, signing, preview: scale === 0.8 }))
      const qr = l.items.find((i) => i.t === 'qr')!
      for (const i of l.items) if (i !== qr) expect(overlap(rect(qr), rect(i)), `${variant}/${arrangement}/${scale} ${i.t}`).toBe(false)
      for (const i of l.items) { const r = rect(i); expect(r.x).toBeGreaterThanOrEqual(-0.01); expect(r.x + r.w).toBeLessThanOrEqual(l.width + 0.5); expect(r.y + r.h).toBeLessThanOrEqual(l.height + 0.5) }
    }
  })

  it('keeps the QR code at about 20 mm or more, however small the mark is asked to be', () => {
    for (const variant of ['compact', 'standard', 'signing'] as const) {
      const l = layoutMark(opts({ variant, scale: 0.1, signing }))
      expect(l.qrSize).toBeGreaterThanOrEqual(MIN_QR_POINTS - 0.01)
      expect(minScale(variant)).toBeLessThan(1)
    }
    expect(layoutMark(opts({ variant: 'standard' })).qrSize / 72 * 25.4).toBeGreaterThan(25)
  })

  it('prints the whole address as a readable link when it fits (the host and start of the token when it does not), and says it is a preview without inventing a signing time', () => {
    const t = (l: ReturnType<typeof layoutMark>) => l.items.filter((i) => i.t === 'text').map((i) => i.t === 'text' ? i.text : '').join('\n')
    const l = layoutMark(opts({ variant: 'signing', signing: { ...signing, signedAt: undefined }, preview: true }))
    expect(t(l)).toContain(URL_.replace('https://', ''))                                          // the address a person can read out or type, as well as click
    expect(t(layoutMark(opts({ variant: 'standard' })))).toContain(URL_.replace('https://', ''))
    const narrow = t(layoutMark(opts({ variant: 'standard', arrangement: 'stacked' })))
    expect(narrow).toContain('voraworld.id/verify')
    expect(narrow).toContain('ABCDEFGH')
    expect(t(l)).toMatch(/PREVIEW/)
    expect(t(l)).not.toMatch(/Signed:/)
    expect(t(l)).toMatch(/Non-certified electronic signature/)
    const done = t(layoutMark(opts({ variant: 'signing', signing })))
    expect(done).toContain('Signed: 31 Oct 2026 11:42 WIB')
    expect(done).not.toMatch(/PREVIEW/)
    expect(t(layoutMark(opts({ variant: 'signing', lang: 'id', signing })))).toContain('Tanda tangan elektronik tidak tersertifikasi')
  })

  it('cuts a long signer name instead of letting it run off the mark', () => {
    const l = layoutMark(opts({ variant: 'signing', signing: { ...signing, name: 'Bambang '.repeat(30) } }))
    for (const i of l.items) if (i.t === 'text') expect(textWidth(i.text, i.size, i.bold)).toBeLessThanOrEqual(l.width + 0.5)
  })

  it('measures text the way pdf-lib does', async () => {
    const doc = await PDFDocument.create()
    const fonts = await embedMarkFonts(doc)
    for (const text of ['PT SATU ARAH INTERNATIONAL', 'Siti Rahma, S.H., M.Kn.', 'Verify document authenticity', 'Ñandú é ü']) {
      // pdf-lib shows a string without kerning, so what is printed is the sum of the glyph widths.
      const sum = (f: typeof fonts.bold) => [...text].reduce((n, ch) => n + f.widthOfTextAtSize(ch, 9), 0)
      expect(textWidth(text, 9, true)).toBeCloseTo(sum(fonts.bold), 2)
      expect(textWidth(text, 9, false)).toBeCloseTo(sum(fonts.regular), 2)
    }
  })
})

describe('the QR code', () => {
  it('has the standard quiet zone of four modules inside its square, dark modules on white', async () => {
    expect(QUIET_MODULES).toBe(4)
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 200])
    const fonts = await embedMarkFonts(doc)
    const layout = drawMark(page, fonts, opts({ variant: 'standard' }), 20, 180)
    const raster = rasterize(await doc.save(), 1, 144)
    if (!raster) return
    const qr = layout.items.find((i) => i.t === 'qr')!
    if (qr.t !== 'qr') throw new Error('x')
    const n = qrMatrix(URL_).size
    const module = qr.size / (n + 8)
    // The pixels of the quiet zone (the first four modules inside the square) are all white.
    const px = (x: number, y: number) => raster.at(Math.round(x * raster.scale), Math.round(y * raster.scale))
    for (let k = 0; k < 4; k++) for (let j = 0; j < n + 8; j++) {
      const x = 20 + qr.x + (k + 0.5) * module, y = (200 - 180) + qr.y + (j + 0.5) * module
      expect(px(x, y).every((v) => v > 240)).toBe(true)
    }
  })

  it.each([0, 90, 180, 270])('decodes to the verification address from the rendered PDF at realistic print and scan resolutions, on a page rotated by %i degrees', async (angle) => {
    for (const variant of ['compact', 'standard', 'signing'] as const) {
      const doc = await PDFDocument.create()
      const page = doc.addPage([595.28, 841.89])
      page.setRotation({ type: 'degrees' as never, angle } as never)
      const fonts = await embedMarkFonts(doc)
      const view = new PageView(page)
      paintMark(page, fonts, layoutMark(opts({ variant, signing })), URL_, view.map(60, view.height - 60))
      const bytes = await doc.save()
      for (const dpi of [100, 150, 200, 300]) {
        const r = rasterize(bytes, 1, dpi)
        if (!r) return                                                                           // Poppler is not installed
        const rgba = new Uint8ClampedArray(r.width * r.height * 4)
        for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const [R, G, B] = r.at(x, y); const i = (y * r.width + x) * 4; rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255 }
        const found = jsQR(rgba, r.width, r.height)
        expect(found?.data, `${variant} @${angle} ${dpi}dpi`).toBe(URL_)
      }
    }
  })

  it('still decodes at the smallest mark the layout allows', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 300])
    drawMark(page, await embedMarkFonts(doc), opts({ variant: 'compact', scale: 0.1 }), 40, 260)
    const r = rasterize(await doc.save(), 1, 150)
    if (!r) return
    const rgba = new Uint8ClampedArray(r.width * r.height * 4)
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const [R, G, B] = r.at(x, y); const i = (y * r.width + x) * 4; rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255 }
    expect(jsQR(rgba, r.width, r.height)?.data).toBe(URL_)
  })
})

describe('the clickable link', () => {
  const annotations = async (bytes: Uint8Array) => {
    const out = await PDFDocument.load(bytes)
    return out.getPages().flatMap((p) => (p.node.Annots()?.asArray() ?? []).map((ref) => out.context.lookup(ref, PDFDict))).map((a) => ({
      uri: (a.lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString)).decodeText(), rect: (a.lookup(PDFName.of('Rect'), PDFArray)).asArray().map((n) => (n as PDFNumber).asNumber()),
    }))
  }
  it.each([0, 90, 180, 270])('makes the whole mark a link to the verification address, on a page rotated by %i degrees, and the link covers the mark', async (angle) => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([595.28, 841.89])
    page.setRotation(degrees(angle))
    const view = new PageView(page)
    const layout = layoutMark(opts({ variant: 'compact' }))
    paintMark(page, await embedMarkFonts(doc), layout, URL_, view.map(100, view.height - 100))
    const [link] = await annotations(await doc.save())
    expect(link.uri).toBe(URL_)
    const w = Math.abs(link.rect[2] - link.rect[0]), h = Math.abs(link.rect[3] - link.rect[1])
    expect(angle % 180 ? h : w).toBeCloseTo(layout.width, 1)
    expect(angle % 180 ? w : h).toBeCloseTo(layout.height, 1)
  })
})

describe('the drawn mark', () => {
  it('is corporate red on a transparent background (the page stays white around it) and has no frame', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 200])
    drawMark(page, await embedMarkFonts(doc), opts({ variant: 'standard' }), 20, 180)
    const r = rasterize(await doc.save(), 1, 144)
    if (!r) return
    let red = 0, nonWhite = 0, minX = r.width, maxX = 0
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      const [R, G, B] = r.at(x, y)
      if (R < 245 || G < 245 || B < 245) { nonWhite++; minX = Math.min(minX, x); maxX = Math.max(maxX, x) }
      if (Math.abs(R - 180) < 12 && Math.abs(G - 62) < 12 && Math.abs(B - 49) < 12) red++
    }
    expect(red).toBeGreaterThan(500)
    expect(nonWhite).toBeGreaterThan(red)                                                         // QR modules are ink, the rest is red
    // Every row of the lockup that is not QR is mostly white: there is no filled rectangle behind it.
    expect(nonWhite / (r.width * r.height)).toBeLessThan(0.45)
  })
})
