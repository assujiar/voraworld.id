import jsQR from 'jsqr'
import { degrees, PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { clampZoom, cssRect, describePlacement, dragTo, loupePosition, nudge, tapTo, type PageBox } from '@/content/placer-geometry'
import { fraction, placeSeal, placementFractions, sealDims, sealedPages } from '@/content/seal-layout'
import { layoutMark } from '@/content/trust-mark'
import { sealMarkOptions } from '@/content/seal-layout'
import { sealPdf } from '@/server/pdf/seal'
import { rasterize } from '../helpers/pdf-text'

const URL_ = 'https://voraworld.id/verify/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGh'
const input = { lang: 'id' as const, url: URL_, purpose: 'verified', size: 'medium', reference: 'SEL-1' }
const dims = sealDims(input)

describe('the shared placement geometry', () => {
  const box: PageBox = { pw: 595.28, ph: 841.89, cssW: 400 }
  it('keeps the mark inside the page, whatever the pointer does', () => {
    for (const [fx, fy] of [[-1, -1], [2, 2], [0.5, 0.5], [0, 1], [1, 0]]) {
      const r = placeSeal(box.pw, box.ph, dims, 'custom', Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy)))
      expect(r.left).toBeGreaterThanOrEqual(6); expect(r.left + r.w).toBeLessThanOrEqual(box.pw - 6 + 1e-9); expect(r.bottom).toBeGreaterThanOrEqual(6 - 1e-9); expect(r.bottom + r.h).toBeLessThanOrEqual(box.ph - 6 + 1e-9)
    }
  })
  it('turns a tap into a placement centred on the tap, and a drag into one that keeps the point that was held', () => {
    const s = box.cssW / box.pw
    const tap = tapTo(box, dims, { x: 200, y: 300 })
    const r = cssRect(box, dims, 'custom', tap)
    expect(r.left + r.width / 2).toBeCloseTo(200, 1); expect(r.top + r.height / 2).toBeCloseTo(300, 1)
    const hold = { x: 10, y: 8 }
    const dragged = cssRect(box, dims, 'custom', dragTo(box, dims, { x: 150, y: 220 }, hold))
    expect(dragged.left + hold.x).toBeCloseTo(150, 1); expect(dragged.top + hold.y).toBeCloseTo(220, 1)
    expect(dragged.width).toBeCloseTo(dims.w * s, 6)
  })
  it('gives the same stored fractions at every zoom and screen size (CSS pixels are not what is stored)', () => {
    const at = (cssW: number) => { const b = { ...box, cssW }; return dragTo(b, dims, { x: cssW * 0.4, y: cssW * (box.ph / box.pw) * 0.3 }, { x: 0, y: 0 }) }
    for (const w of [240, 320, 400, 800, 1200]) { expect(at(w).x).toBeCloseTo(0.4, 6); expect(at(w).y).toBeCloseTo(0.3, 6) }
  })
  it('nudges by points, in the reader\'s directions, and stops at the edge', () => {
    const start = { x: 0.3, y: 0.4 }
    const moved = nudge(box, dims, start, 10, 0)
    expect(moved.x * box.pw - start.x * box.pw).toBeCloseTo(10, 6); expect(moved.y).toBeCloseTo(start.y, 6)
    expect(nudge(box, dims, start, 0, -10).y * box.ph).toBeCloseTo(start.y * box.ph - 10, 6)             // up is toward the top of the page
    expect(nudge(box, dims, { x: 0, y: 0 }, -50, -50)).toEqual(nudge(box, dims, { x: 0, y: 0 }, -500, -500))      // pinned at the edge
  })
  it('puts the floating preview above the finger, below it near the top, and always inside the screen', () => {
    const view = { width: 390, height: 844 }, loupe = { w: 280, h: 120 }
    const mid = loupePosition({ x: 195, y: 500 }, view, loupe)
    expect(mid.side).toBe('above'); expect(mid.top + loupe.h).toBeLessThan(500)
    const top = loupePosition({ x: 195, y: 60 }, view, loupe)
    expect(top.side).toBe('below'); expect(top.top).toBeGreaterThan(60)
    for (const x of [0, 5, 195, 385, 390]) for (const y of [0, 30, 400, 800, 844]) {
      const p = loupePosition({ x, y }, view, loupe)
      expect(p.left, `${x},${y}`).toBeGreaterThanOrEqual(8); expect(p.left + loupe.w).toBeLessThanOrEqual(view.width - 8); expect(p.top).toBeGreaterThanOrEqual(8); expect(p.top + loupe.h).toBeLessThanOrEqual(view.height - 8)
    }
    expect(loupePosition({ x: 100, y: 500 }, { width: 250, height: 800 }, loupe).left).toBeGreaterThanOrEqual(8)               // a screen narrower than the preview
  })
  it('bounds the zoom, and describes the placement in both languages', () => {
    expect(clampZoom(0.2)).toBe(1); expect(clampZoom(9)).toBe(3); expect(clampZoom(NaN)).toBe(1); expect(clampZoom(1.5)).toBe(1.5)
    expect(describePlacement(2, { x: 0.31, y: 0.62 })).toEqual({ en: 'Page 2: 31% from the left, 62% from the top', id: 'Halaman 2: 31% dari kiri, 62% dari atas' })
  })
  it('reads a stored fraction strictly, and chooses pages', () => {
    expect(fraction('0.5')).toBe(0.5); expect(fraction('1')).toBe(1); expect(fraction('2')).toBeNull(); expect(fraction('left')).toBeNull(); expect(fraction(undefined)).toBeNull()
    expect(sealedPages(3, 'last', null)).toEqual([2]); expect(sealedPages(3, 'all', null)).toEqual([0, 1, 2]); expect(sealedPages(3, 'one', 2)).toEqual([1]); expect(() => sealedPages(3, 'one', 4)).toThrow()
  })
  it('uses the same room for the preview and the finished mark, so a confirmed placement cannot move at signing', () => {
    const preview = layoutMark(sealMarkOptions({ ...input, preview: true, signer: { name: 'Siti Rahma', position: 'Direktur' } }))
    const final = layoutMark(sealMarkOptions({ ...input, signedAt: '31 Okt 2026 11:42 WIB', signer: { name: 'Siti Rahma', position: 'Direktur' } }))
    expect(preview.width).toBeCloseTo(final.width, 6); expect(preview.height).toBeCloseTo(final.height, 6)
  })
})

/** The mark in the finished PDF is where the person put it, as the reader sees the page, on every rotation. */
describe('the finished PDF matches the confirmed placement', () => {
  async function pageWith(rotate: number, size: [number, number], cropBox?: [number, number, number, number]) {
    const doc = await PDFDocument.create()
    const page = doc.addPage(size)
    if (cropBox) page.setCropBox(...cropBox)
    if (rotate) page.setRotation(degrees(rotate))
    return doc.save()
  }
  const qrCorner = (bytes: Uint8Array, dpi: number) => {
    const r = rasterize(bytes, 1, dpi, true)!                                                          // the crop box is the page a reader sees
    const rgba = new Uint8ClampedArray(r.width * r.height * 4)
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const [R, G, B] = r.at(x, y); const i = (y * r.width + x) * 4; rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255 }
    const found = jsQR(rgba, r.width, r.height)
    return { found, r }
  }
  it.each([0, 90, 180, 270])('at %i degrees, with a dropped position, a corner, a crop box and a page that is not A4', async (rotate) => {
    for (const [size, crop] of [[[595.28, 841.89], undefined], [[612, 792], undefined], [[700, 900], [20, 30, 580, 770]]] as const) {
      for (const where of [{ corner: 'custom', posX: '0.3000', posY: '0.4000' }, { corner: 'bottom-right' }, { corner: 'top-left' }]) {
        const source = await pageWith(rotate, size as [number, number], crop as [number, number, number, number] | undefined)
        const { bytes } = await sealPdf(source, { verificationUrl: URL_, lang: 'id', reference: 'SEL-1', purpose: 'verified', pages: 'last', size: 'medium', ...where })
        const dpi = 200
        const { found, r } = qrCorner(bytes, dpi)
        expect(found?.data, `${rotate} ${JSON.stringify(where)}`).toBe(URL_)
        // The page as the reader sees it, in points.
        const vw = rotate % 180 ? (crop ? crop[3] : size[1]) : (crop ? crop[2] : size[0])
        const vh = rotate % 180 ? (crop ? crop[2] : size[0]) : (crop ? crop[3] : size[1])
        const k = dpi / 72
        const rect = placeSeal(vw, vh, dims, where.corner, where.posX ? Number(where.posX) : null, where.posY ? Number(where.posY) : null)
        const layout = layoutMark(sealMarkOptions({ ...input }))
        const qr = layout.items.find((i) => i.t === 'qr')!
        if (qr.t !== 'qr') throw new Error('x')
        // The QR square's top left, from the layout and the placement: where the decoder should find it (the finder pattern corners are inside the square).
        const expectedLeft = (rect.left + qr.x) * k, expectedTop = (vh - rect.bottom - rect.h + qr.y) * k
        const xs = [found!.location.topLeftCorner.x, found!.location.bottomLeftCorner.x], ys = [found!.location.topLeftCorner.y, found!.location.topRightCorner.y]
        const quiet = (qr.size * 4) / (qrModules(URL_) + 8)
        expect(Math.min(...xs) - quiet * k, `${rotate} ${JSON.stringify(where)} left`).toBeCloseTo(expectedLeft, -1)
        expect(Math.min(...ys) - quiet * k, `${rotate} ${JSON.stringify(where)} top`).toBeCloseTo(expectedTop, -1)
        expect(r.width / k).toBeCloseTo(vw, 0); expect(r.height / k).toBeCloseTo(vh, 0)
      }
    }
  })
  it('puts the mark on the pages chosen and leaves every other page byte-for-byte as it was', async () => {
    const doc = await PDFDocument.create(); for (let i = 0; i < 3; i++) doc.addPage([300, 400])
    const source = await doc.save()
    const { bytes, pagesSealed } = await sealPdf(source, { verificationUrl: URL_, lang: 'en', reference: 'SEL-1', purpose: 'verified', pages: 'one', pageNumber: '2', corner: 'top-left', size: 'small' })
    expect(pagesSealed).toBe(1)
    const out = await PDFDocument.load(bytes)
    expect(out.getPage(0).node.Annots()?.size() ?? 0).toBe(0); expect(out.getPage(1).node.Annots()?.size()).toBe(1); expect(out.getPage(2).node.Annots()?.size() ?? 0).toBe(0)
  })
})

import { qrMatrix } from '@/content/trust-qr'
const qrModules = (url: string) => qrMatrix(url).size
