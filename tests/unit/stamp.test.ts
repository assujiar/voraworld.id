import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import jsQR from 'jsqr'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFString, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildArt, buildMetrics, readArt, SOURCES } from '../../scripts/embed-trust-assets'
import { ICON_ART, WORDMARK_ART } from '@/content/stamp-art'
import { CORPORATE_NAME, ICON_ASPECT, lockup, monoWidth, RED, textWidth, WORDMARK_ASPECT, type MarkItem } from '@/content/trust-mark'
import { qrMatrix, QUIET_MODULES } from '@/content/trust-qr'
import { layoutFooter, layoutSignature, SIGNATURE_HEIGHT, SIGNATURE_RATIO, SIGNATURE_WIDTH, urlLines, wrapMono, type FooterOptions, type SignatureOptions } from '@/content/verification-blocks'
import { embedMarkFonts, PageView, paintMark, upright } from '@/server/pdf/trust-mark'
import { rasterize } from '../helpers/pdf-text'

const URL_ = 'https://voraworld.id/verify/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGh'
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sig = (o: Partial<SignatureOptions> = {}): SignatureOptions => ({ type: 2, lang: 'id', url: URL_, number: 'AGR-VORA-C0123456789-202610-00001', registeredAt: '31 Okt 2026 11:42 WIB', name: 'Siti Rahma', position: 'Direktur', ...o })
const foot = (o: Partial<FooterOptions> = {}): FooterOptions => ({
  width: 507, height: 72, url: URL_, number: 'INV-VORA-C0123456789-202610-00001', issuedOn: '2026-10-29', issuer: { address: 'Jl. Contoh No. 1, Jakarta, Indonesia', taxId: '01.234.567.8-901.000', email: 'info@voraworld.id' },
  heading: 'VORA | DIGITAL DOCUMENT VERIFICATION', instruction: 'Scan the QR, or click this link, to check document status with VORA:', notes: ['PAYMENT REQUEST - NOT PROOF OF PAYMENT', 'Proof of payment is the official VORA receipt, issued only after Finance confirms cleared funds.'],
  emphasiseFirst: true, pageLine: 'DOCUMENT | PAGE 01 OF 01', tagline: 'Bringing the World Within Reach.', ...o,
})
const texts = (items: MarkItem[]) => items.flatMap((i) => (i.t === 'text' ? [i] : []))
const frame = (l: { items: MarkItem[] }) => l.items.find((i) => i.t === 'frame') as Extract<MarkItem, { t: 'frame' }>

describe('the approved artwork', () => {
  it('is the path data of the approved SVGs, byte for byte, and the generated files are current', async () => {
    expect(read('src/content/stamp-art.ts')).toBe(buildArt())
    expect(read('src/content/helvetica-metrics.ts')).toBe(await buildMetrics())
    for (const [art, src] of [[ICON_ART, SOURCES.icon], [WORDMARK_ART, SOURCES.wordmark]] as const) {
      const svg = read(src)
      expect(art).toEqual(readArt(svg))
      for (const p of art.paths) expect(svg.includes(`d="${p.d}"`)).toBe(true)                  // not one coordinate was touched
    }
    expect(WORDMARK_ART.paths).toHaveLength(2); expect(ICON_ART.paths).toHaveLength(2)
  })
  it('keeps the proportions of the icon and wordmark, sets the legal name correctly in one red with no box, and the parts close together', () => {
    expect(CORPORATE_NAME).toBe('PT SATU ARAH INTERNATIONAL'); expect(RED).toBe('#B43E31')
    const lock = lockup(100, 0.58)
    const [icon, word, rule, name] = lock.items
    if (icon.t !== 'icon' || word.t !== 'wordmark' || rule.t !== 'rule' || name.t !== 'text') throw new Error('x')
    expect(icon.h / icon.w).toBeCloseTo(ICON_ASPECT, 6); expect(word.h / word.w).toBeCloseTo(WORDMARK_ASPECT, 6)
    expect(name.text).toBe(CORPORATE_NAME); expect(name.color).toBe(RED); expect(name.fit).toBe(100); expect(rule.w).toBe(word.w)
    expect(word.y - (icon.y + icon.h)).toBeLessThan(word.h * 0.2); expect(rule.y - (word.y + word.h)).toBeLessThan(word.h * 0.2)
    expect(lock.items.every((i) => ['icon', 'wordmark', 'rule', 'text'].includes(i.t))).toBe(true)          // no border, ring or emblem
  })
  it('measures text the way pdf-lib does', async () => {
    const doc = await PDFDocument.create()
    const fonts = await embedMarkFonts(doc)
    for (const text of ['PT SATU ARAH INTERNATIONAL', 'Siti Rahma, S.H., M.Kn.', 'Nomor dokumen', 'Ñandú é ü']) {
      const sum = (f: typeof fonts.bold) => [...text].reduce((n, ch) => n + f.widthOfTextAtSize(ch, 9), 0)      // pdf-lib shows a string without kerning
      expect(textWidth(text, 9, true)).toBeCloseTo(sum(fonts.bold), 2); expect(textWidth(text, 9, false)).toBeCloseTo(sum(fonts.regular), 2)
      expect(monoWidth(text, 9)).toBeCloseTo(sum(fonts.mono), 2)                                                // Courier is 0.6 em a glyph
    }
  })
})

describe('Signature Type 1 and Signature Type 2: one size contract', () => {
  it('are a fixed landscape box, twice as wide as it is tall, and exactly the same box for both types', () => {
    expect(SIGNATURE_WIDTH / SIGNATURE_HEIGHT).toBeCloseTo(SIGNATURE_RATIO, 9)
    for (const scale of [0.8, 1, 1.25]) {
      const a = layoutSignature(sig({ type: 1, scale })), b = layoutSignature(sig({ type: 2, scale }))
      expect(a.width).toBe(b.width); expect(a.height).toBe(b.height)
      expect(a.width / a.height).toBeCloseTo(2, 9)
      const fa = frame(a), fb = frame(b)
      expect(fa.w).toBe(fb.w); expect(fa.h).toBe(fb.h); expect(fa.r).toBe(fb.r); expect(fa.width).toBe(fb.width)             // the same radius and border
      expect(a.qrSize).toBe(b.qrSize)                                                                                        // and the same QR
    }
    expect(SIGNATURE_WIDTH).toBeCloseTo(120 * 72 / 25.4, 6)
  })
  it('keeps everything inside the box, and the QR (with its quiet zone) at about 27 mm', () => {
    for (const type of [1, 2] as const) for (const scale of [0.8, 1]) {
      const l = layoutSignature(sig({ type, scale }))
      for (const i of l.items) {
        const box = i.t === 'qr' ? { x: i.x, y: i.y, w: i.size, h: i.size } : i.t === 'text' ? { x: i.x, y: i.y - i.size, w: i.fit ?? (i.font === 'mono' ? monoWidth(i.text, i.size) : textWidth(i.text, i.size, i.bold)), h: i.size } :
          i.t === 'line' ? { x: Math.min(i.x1, i.x2), y: Math.min(i.y1, i.y2), w: Math.abs(i.x2 - i.x1), h: Math.abs(i.y2 - i.y1) } : { x: i.x, y: i.y, w: 'w' in i ? i.w : ('size' in i ? i.size : 0), h: 'h' in i ? i.h : ('size' in i ? i.size : 0) }
        expect(box.x, `${type} ${i.t}`).toBeGreaterThanOrEqual(-0.01); expect(box.y).toBeGreaterThanOrEqual(-0.01)
        expect(box.x + box.w, `${type} ${i.t} right`).toBeLessThanOrEqual(l.width + 0.01); expect(box.y + box.h, `${type} ${i.t} bottom`).toBeLessThanOrEqual(l.height + 0.01)
      }
      expect(l.qrSize / 72 * 25.4).toBeGreaterThan(scale === 1 ? 33 : 26)
    }
  })
  it('gives the QR section and the metadata section exactly the same height, and centres both in it', () => {
    for (const type of [1, 2] as const) {
      const l = layoutSignature(sig({ type }))
      const divider = l.items.find((i) => i.t === 'line' && i.x1 === i.x2) as Extract<MarkItem, { t: 'line' }>
      const mid = (divider.y1 + divider.y2) / 2
      const qr = l.items.find((i) => i.t === 'qr') as Extract<MarkItem, { t: 'qr' }>
      expect(qr.y + qr.size / 2, `QR centre @${type}`).toBeCloseTo(mid, 6)
      const rows = l.items.filter((i) => i.t === 'glyph' && ['document', 'calendar', 'user', 'briefcase'].includes(i.name)) as Array<Extract<MarkItem, { t: 'glyph' }>>
      expect(rows).toHaveLength(4)
      expect((rows[0].y + rows[3].y + rows[3].size) / 2, `rows centre @${type}`).toBeCloseTo(mid, 0)
      const pitch = rows[1].y - rows[0].y
      for (let i = 1; i < 4; i++) expect(rows[i].y - rows[i - 1].y).toBeCloseTo(pitch, 6)                                     // one grid
    }
  })
  it('Type 1 shows the QR and four rows only: no logo, no stamp, no address, no verification wording, no disclaimer', () => {
    const l = layoutSignature(sig({ type: 1 }))
    expect(l.kind).toBe('signature-1')
    expect(l.items.some((i) => ['logo', 'icon', 'wordmark', 'hotspot'].includes(i.t))).toBe(false)
    const all = texts(l.items).map((t) => t.text).join('\n')
    for (const bad of ['http', 'voraworld', 'Periksa keaslian', 'verify', 'bukan tanda tangan', 'not a personal', 'electronic signature']) expect(all, bad).not.toContain(bad)
    expect(texts(l.items).filter((t) => t.font === 'mono').map((t) => t.text)).toEqual(['AGR-VORA-C0123456789-202610-00001', '31 Okt 2026 11:42 WIB', 'Siti Rahma', 'Direktur'])
    expect(texts(l.items).map((t) => t.text).filter((t) => /^[A-Z][a-z]/.test(t))).toEqual(expect.arrayContaining(['Nomor dokumen', 'Didaftarkan', 'Nama', 'Jabatan']))
    expect(new Set(texts(l.items).filter((t) => t.font === 'mono').map((t) => t.size)).size).toBe(1)                            // one value size: a grid
  })
  it('Type 2 puts the whole address in a bottom row inside the same box, in VORA red, underlined, clickable, never shortened', () => {
    const l = layoutSignature(sig({ type: 2 }))
    expect(l.kind).toBe('signature-2')
    const f = frame(l)
    const divider = l.items.find((i) => i.t === 'line' && i.y1 === i.y2) as Extract<MarkItem, { t: 'line' }>
    expect(divider.y1).toBeGreaterThan(l.height * 0.7); expect(divider.y1).toBeLessThan(f.y + f.h)                          // a dedicated row at the bottom, in the box
    const urlText = texts(l.items).filter((t) => t.color === RED)
    expect(urlText.map((t) => t.text).join('')).toBe(URL_)                                                                     // complete
    for (const t of urlText) { expect(t.text).not.toMatch(/\.\.\.|…/); expect(t.font).toBe('mono'); expect(t.y).toBeGreaterThan(divider.y1) }
    expect(l.items.filter((i) => i.t === 'line' && i.color === RED).length).toBe(urlText.length)                               // underlined
    const hot = l.items.find((i) => i.t === 'hotspot') as Extract<MarkItem, { t: 'hotspot' }>
    expect(hot.url).toBe(URL_); expect(hot.y).toBeGreaterThan(divider.y1 - 1)
    expect(l.items.filter((i) => i.t === 'glyph').map((g) => (g.t === 'glyph' ? g.name : ''))).toEqual(expect.arrayContaining(['link', 'external']))
  })
  it('never truncates or hides any part of an address, however long the token', () => {
    for (const token of ['x'.repeat(48), 'Y'.repeat(100), 'z'.repeat(150)]) {
      const url = `https://voraworld.id/verify/${token}`
      const u = urlLines(url, 290, 6.4)
      expect(u.lines.join('')).toBe(url)
      for (const line of u.lines) expect(monoWidth(line, u.size)).toBeLessThanOrEqual(290 + 0.01)
      expect(u.lines.length).toBeLessThanOrEqual(5)
    }
    expect(urlLines(URL_, 290, 6.4).lines).toEqual([URL_])                                                                      // a real address is one line
    expect(wrapMono('INV-VORA-C0123456789-202610-00001', 60, 4.9).join('')).toBe('INV-VORA-C0123456789-202610-00001')
  })
  it('shows no time that has not happened in a preview, and labels it', () => {
    const l = layoutSignature(sig({ type: 1, preview: true, registeredAt: '31 Okt 2026 11:42 WIB' }))
    expect(texts(l.items).map((t) => t.text).join('\n')).not.toContain('11:42'); expect(texts(l.items).map((t) => t.text)).toContain('Ditetapkan saat selesai')
    expect(l.badge?.text).toBe('PRATINJAU')
    expect(layoutSignature(sig({ type: 1, preview: true })).width).toBe(l.width)
  })
})

describe('Footer Type 3', () => {
  it('has sections of exactly the same height, dividers that start and end together, and one frame', () => {
    const l = layoutFooter(foot())
    const dividers = l.items.filter((i) => i.t === 'line' && i.x1 === i.x2) as Array<Extract<MarkItem, { t: 'line' }>>
    expect(dividers).toHaveLength(4)
    for (const d of dividers) { expect(d.y1).toBe(dividers[0].y1); expect(d.y2).toBe(dividers[0].y2) }
    const f = frame(l)
    expect(f.h).toBeCloseTo(l.height - 0.6, 6); expect(f.w).toBeCloseTo(l.width - 0.6, 6)
    const qr = l.items.find((i) => i.t === 'qr') as Extract<MarkItem, { t: 'qr' }>
    expect(qr.size).toBeCloseTo(Math.min(l.height - 10, 68), 6)                                                                // the QR fills the section height (up to 24 mm)
    expect(qr.y + qr.size / 2).toBeCloseTo(l.height / 2, 6)                                                                    // centred in it
  })
  it('sets the stamp as tall as the QR modules, aligned to them', () => {
    const l = layoutFooter(foot())
    const qr = l.items.find((i) => i.t === 'qr') as Extract<MarkItem, { t: 'qr' }>
    const n = qrMatrix(URL_).size, quiet = (qr.size * QUIET_MODULES) / (n + 8)
    const lock = l.items.filter((i) => i.t === 'icon' || i.t === 'wordmark' || (i.t === 'rule' && !i.color) || (i.t === 'text' && i.text === CORPORATE_NAME))
    const top = Math.min(...lock.map((i) => (i.t === 'text' ? i.y - i.size * 0.718 : (i as { y: number }).y)))
    const bottom = Math.max(...lock.map((i) => (i.t === 'text' ? i.y : (i as { y: number; h: number }).y + (i as { h: number }).h)))
    expect(top).toBeCloseTo(qr.y + quiet, 4); expect(bottom).toBeCloseTo(qr.y + qr.size - quiet, 4)
  })
  it('is all monospaced (the stamp\'s own name is the artwork), keeps the original wording, and never truncates the address', () => {
    const l = layoutFooter(foot())
    for (const t of texts(l.items)) if (t.text !== CORPORATE_NAME) expect(t.font, t.text).toBe('mono')
    const all = texts(l.items).map((t) => t.text).join('\n')
    for (const w of ['VORA | DIGITAL DOCUMENT VERIFICATION', 'Scan the QR, or click this link', 'PAYMENT REQUEST - NOT PROOF OF PAYMENT', 'Proof of payment is the official VORA receipt', 'info@voraworld.id', 'Nomor dokumen', 'Diterbitkan', 'NPWP', 'Bringing the World Within Reach.']) expect(all, w).toContain(w)
    expect(all.replace(/\n/g, '')).toContain('INV-VORA-C0123456789-202610-00001'.replace(/\n/g, ''))
    const url = texts(l.items).filter((t) => t.color === RED && t.text !== CORPORATE_NAME && !t.bold)
    expect(url.map((t) => t.text).join('')).toBe(URL_)
    expect(all).not.toMatch(/\.\.\.|…/)
    expect(l.items.some((i) => i.t === 'hotspot' && i.url === URL_)).toBe(true)
  })
  it('puts the payment notes only where the document has them, and the first in red', () => {
    const plain = layoutFooter(foot({ notes: undefined, emphasiseFirst: false }))
    expect(texts(plain.items).map((t) => t.text).join('\n')).not.toMatch(/PROOF OF PAYMENT|official VORA receipt/)
    const withNotes = layoutFooter(foot())
    expect(texts(withNotes.items).find((t) => t.text.startsWith('PAYMENT REQUEST'))?.color).toBe(RED)
  })
  it('carries a second address (a proof of delivery\'s evidence page) whole and clickable', () => {
    const l = layoutFooter(foot({ notes: undefined, extraLinks: [{ label: 'Evidence page:', url: 'https://voraworld.id/pod/view/VIEWTOKENVIEWTOKENVIEW' }] }))
    expect(l.items.filter((i) => i.t === 'hotspot').map((i) => (i as { url: string }).url)).toEqual([URL_, 'https://voraworld.id/pod/view/VIEWTOKENVIEWTOKENVIEW', URL_])
  })
  it('fits every footer height the documents use, and the landscape width of a certificate', () => {
    for (const [w, h] of [[507, 71], [507, 74], [507, 87], [742, 74]]) {
      const l = layoutFooter(foot({ width: w, height: h }))
      expect(l.width).toBe(w); expect(l.height).toBe(h)
    }
  })
})

describe('the drawn components in a PDF', () => {
  async function pdf(layoutOf: 'sig1' | 'sig2' | 'footer', angle = 0) {
    const doc = await PDFDocument.create()
    const page = doc.addPage([595.28, 841.89])
    if (angle) page.setRotation(degrees(angle))
    const fonts = await embedMarkFonts(doc)
    const view = new PageView(page)
    const layout = layoutOf === 'footer' ? layoutFooter(foot()) : layoutSignature(sig({ type: layoutOf === 'sig1' ? 1 : 2 }))
    if (layoutOf === 'footer') paintMark(page, fonts, layout, URL_, view.map(44, 80), false)
    else paintMark(page, fonts, layout, URL_, view.map(60, view.height - 60))
    return { bytes: await doc.save(), layout }
  }
  const links = async (bytes: Uint8Array) => {
    const out = await PDFDocument.load(bytes)
    return out.getPages().flatMap((p) => (p.node.Annots()?.asArray() ?? []).map((ref) => out.context.lookup(ref, PDFDict))).map((a) => ({
      uri: a.lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText(), rect: a.lookup(PDFName.of('Rect'), PDFArray).asArray().map((n) => (n as PDFNumber).asNumber()),
    }))
  }
  const decode = (bytes: Uint8Array, dpi: number) => {
    const r = rasterize(bytes, 1, dpi)
    if (!r) return undefined
    const rgba = new Uint8ClampedArray(r.width * r.height * 4)
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const [R, G, B] = r.at(x, y); const i = (y * r.width + x) * 4; rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255 }
    return jsQR(rgba, r.width, r.height)?.data
  }
  it.each([0, 90, 180, 270])('every component decodes to the verification address at print and scan resolutions, on a page rotated by %i degrees', async (angle) => {
    for (const which of ['sig1', 'sig2', 'footer'] as const) {
      const { bytes } = await pdf(which, angle)
      // The footer's QR code is 22 mm: a 150 dpi raster of it is too coarse for this test's decoder (a phone camera is not), so it is read at print resolutions.
      for (const dpi of which === 'footer' ? [200, 300] : [100, 150, 200, 300]) { const data = decode(bytes, dpi); if (data === undefined && !rasterize(bytes, 1, 72)) return; expect(data, `${which} @${angle} ${dpi}dpi`).toBe(URL_) }
    }
  })
  it('makes the address a real link annotation, and the QR code a link to the same address', async () => {
    for (const which of ['sig2', 'footer'] as const) {
      const found = await links((await pdf(which)).bytes)
      expect(found.length, which).toBeGreaterThan(0)
      for (const l of found) expect(l.uri).toBe(URL_)
    }
    const type2 = await links((await pdf('sig2')).bytes)
    expect(type2.length).toBe(2)                                                                                                // the address row and the whole box
    const row = type2.map((l) => l.rect[3] - l.rect[1]).sort((a, b) => a - b)[0]
    expect(row).toBeLessThan(SIGNATURE_HEIGHT / 3)
  })
  it('draws the address in VORA red (#B43E31) and the QR modules in Midnight Navy (#101720)', async () => {
    const { bytes } = await pdf('sig2')
    const r = rasterize(bytes, 1, 288)
    if (!r) return
    const counts = new Map<string, number>()
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const k = r.at(x, y).join(','); counts.set(k, (counts.get(k) ?? 0) + 1) }
    const dark = [...counts.entries()].filter(([k]) => k.split(',').every((v) => Number(v) < 60)).sort((a, b) => b[1] - a[1])[0]
    expect(dark[0]).toBe('16,23,32')
    const red = [...counts.entries()].filter(([k]) => { const [R, G, B] = k.split(',').map(Number); return Math.abs(R - 180) < 8 && Math.abs(G - 62) < 8 && Math.abs(B - 49) < 8 })
    expect(red.reduce((n, [, c]) => n + c, 0)).toBeGreaterThan(300)                                                            // the link, its underline and the icons
  })
  it('uses the same box in the PDF for Type 1 and Type 2', async () => {
    const a = (await pdf('sig1')).layout, b = (await pdf('sig2')).layout
    expect([a.width, a.height]).toEqual([b.width, b.height])
  })
})
void upright

describe('the issuer details in Footer Type 3', () => {
  it('prints the whole address and tax number it is given, and cuts a very long one only with "..."', () => {
    const short = layoutFooter(foot())
    const t = texts(short.items).map((x) => x.text).join(' ')
    expect(t).toContain('Jl. Contoh No. 1,'); expect(t).toContain('Indonesia'); expect(t).toContain('NPWP'); expect(t).toContain('01.234.567.8-901.000')
    const address = 'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27 RT. 008 RW. 009, Tebet Timur, Tebet, Kota Adm. Jakarta Selatan, DKI Jakarta 12810'
    const full = layoutFooter(foot({ issuer: { address, taxId: '1000 0000 1178 2812', email: 'info@voraworld.id' } }))
    const joined = texts(full.items).map((x) => x.text).join('')
    expect(joined.replace(/\s/g, '')).toContain('1000000011782812'.replace(/(\d{4})/g, '$1 ').replace(/\s/g, ''))
    expect(joined).toContain('Gedung'); expect(joined).toContain('Jakarta')
    const absurd = layoutFooter(foot({ issuer: { address: address.repeat(4), taxId: '1000 0000 1178 2812', email: 'info@voraworld.id' } }))
    const aText = texts(absurd.items).map((x) => x.text)
    expect(aText.some((x) => x.endsWith('...'))).toBe(true); expect(aText.join(' ')).toContain('NPWP')                  // the tax number is never the thing that is dropped
  })
})
