import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { ICONS, MANIFEST } from '@/lib/favicons'

/** The site's icons: a round Midnight Navy badge with the approved reverse A icon on it, small, clear and present for every browser that asks. */
const pub = (name: string) => `public/${name}`
const NAVY = [0x10, 0x17, 0x20]

describe('the favicon set', () => {
  it('has a vector badge made of the reverse icon (its outline kept, legs heavier for small sizes) on a navy circle', () => {
    const svg = readFileSync(pub('favicon.svg'), 'utf8'), reverse = readFileSync('public/static/assets/vora-a-icon-reverse.svg', 'utf8')
    expect(svg).toContain('<circle cx="256" cy="256" r="256" fill="#101720"/>')
    const outline = /<path d="(M 0 520 L 442 42 Q 500 -27 558 42 L 1000 520)/.exec(reverse)?.[1]
    expect(outline, 'the approved A starts with this outline').toBeTruthy(); expect(svg, 'the outer outline of the A is kept').toContain(outline!)
    expect(svg).toContain('fill="#FFFFFF"'); expect(svg).toContain('fill="#B43E31"')
    expect(statSync(pub('favicon.svg')).size).toBeLessThan(1500)
  })

  it('has an .ico holding 16, 32 and 48 px images, every one a real PNG', () => {
    const ico = readFileSync(pub('favicon.ico'))
    expect(ico.readUInt16LE(0)).toBe(0); expect(ico.readUInt16LE(2)).toBe(1)
    const n = ico.readUInt16LE(4)
    const sizes: number[] = []
    for (let i = 0; i < n; i++) {
      const at = 6 + 16 * i, size = ico.readUInt8(at) || 256, bytes = ico.readUInt32LE(at + 8), offset = ico.readUInt32LE(at + 12)
      sizes.push(size)
      expect(ico.subarray(offset, offset + 8).toString('hex'), `image ${size}`).toBe('89504e470d0a1a0a')               // the PNG signature
      expect(offset + bytes).toBeLessThanOrEqual(ico.length)
    }
    expect(sizes).toEqual([16, 32, 48])
    expect(statSync(pub('favicon.ico')).size).toBeLessThan(6000)
  })

  it('draws every PNG at its size: round and transparent at the corners, or a full navy square where the platform rounds it itself', async () => {
    const px = async (name: string) => { const { data, info } = await sharp(pub(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height } }
    const at = (img: { data: Buffer; w: number }, x: number, y: number) => [...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)]
    for (const [name, size] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512]] as const) {
      const img = await px(name)
      expect([img.w, img.h], name).toEqual([size, size])
      expect(at(img, 0, 0)[3], `${name} corner is transparent`).toBe(0)
      const mid = at(img, Math.round(size * 0.18), Math.round(size / 2))                                          // on the badge, left of the icon
      expect(mid.slice(0, 3), `${name} badge is Midnight Navy`).toEqual(NAVY); expect(mid[3]).toBe(255)
    }
    for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-maskable-512.png', 512]] as const) {
      const img = await px(name)
      expect([img.w, img.h], name).toEqual([size, size])
      for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) expect(at(img, x, y), `${name} fills its corners with navy`).toEqual([...NAVY, 255])
    }
  })

  it('keeps every file small', () => {
    const limits: Record<string, number> = { 'favicon-32.png': 1500, 'icon-192.png': 6000, 'icon-512.png': 12000, 'icon-maskable-512.png': 6000, 'apple-touch-icon.png': 5000, 'site.webmanifest': 1000 }
    for (const [name, max] of Object.entries(limits)) expect(statSync(pub(name)).size, name).toBeLessThan(max)
  })

  it('has a manifest that names real files at their real sizes', async () => {
    const m = JSON.parse(readFileSync(pub('site.webmanifest'), 'utf8')) as { name: string; theme_color: string; background_color: string; icons: Array<{ src: string; sizes: string; type: string; purpose: string }> }
    expect(m.theme_color).toBe('#101720'); expect(m.background_color).toBe('#101720'); expect(m.name).toBe('VORA')
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const i of m.icons) {
      expect(existsSync(pub(i.src.slice(1))), i.src).toBe(true)
      const meta = await sharp(pub(i.src.slice(1))).metadata()
      expect(`${meta.width}x${meta.height}`, i.src).toBe(i.sizes)
    }
  })

  it('is what the three layouts point at: .ico, SVG, the 192 px badge and the iOS square, with the manifest', () => {
    const urls = (ICONS.icon as Array<{ url: string }>).map((i) => i.url)
    expect(urls).toEqual(expect.arrayContaining(['/favicon.ico?v=2', '/favicon.svg?v=2', '/icon-192.png?v=2']))
    expect((ICONS.apple as Array<{ url: string }>)[0].url).toBe('/apple-touch-icon.png?v=2'); expect(MANIFEST).toBe('/site.webmanifest')
    for (const layout of ['src/app/(site)/[locale]/layout.tsx', 'src/app/(docs)/layout.tsx', 'src/app/(admin)/layout.tsx']) {
      const s = readFileSync(layout, 'utf8')
      expect(s, layout).toContain('icons: ICONS'); expect(s, layout).toContain('manifest: MANIFEST'); expect(s, layout).not.toContain('vora-a-icon-primary')
    }
  })
})
