/**
 * Makes the site's icons from the approved reverse A icon (public/static/assets/vora-a-icon-reverse.svg): a round Midnight Navy badge with the icon on it. The outline is the approved one; the legs are heavier and the wedge larger so it stays clear when small (see SMALL).
 *   public/favicon.svg             the badge as a vector (browsers that take SVG: Chrome, Edge, Firefox)
 *   public/favicon.ico             16, 32 and 48 px (PNG inside), for every browser that asks for /favicon.ico, Safari and the older ones above all
 *   public/icon-192.png, icon-512.png   the badge for Android and for installed sites
 *   public/icon-maskable-512.png   the icon on a full navy square, inside the safe zone, for the shapes Android cuts out
 *   public/apple-touch-icon.png    180 px, a full navy square without transparency (iOS rounds it itself)
 * The smaller the size, the larger the icon sits on the badge, so that it stays clear at 16 px. Run: npm run build:favicons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(__dirname, '..')
const NAVY = '#101720'
const svgText = readFileSync(resolve(ROOT, 'public/static/assets/vora-a-icon-reverse.svg'), 'utf8')
const paths = [...svgText.matchAll(/<path d="([^"]+)" fill="([^"]+)"\/>/g)].map((m) => ({ d: m[1], fill: m[2] }))
if (paths.length !== 2) throw new Error('The reverse icon is expected to hold two paths (the white A and the red wedge)')
// Small sizes get an optical adaptation of the same shape: the same outline and apex, with heavier legs and a larger wedge, because the wide A is otherwise thin and unclear at 16 to 60 px.
// The A keeps its outer outline (feet, apex, curve); only the inner opening is narrower. The wedge is rescaled to sit in the narrower opening.
const SMALL = [
  { d: 'M 0 520 L 442 42 Q 500 -27 558 42 L 1000 520 L 760 520 L 500 250 L 240 520 Z', fill: paths[0].fill },
  { d: 'M 285 516 L 500 296 L 715 516 Q 500 410 285 516 Z', fill: paths[1].fill },
]
// The artwork occupies x 0..1000 and y -27..520; its centre is (500, 246.5).
const CX = 500, CY = 246.5, ART_W = 1000

/** The icon on a 512 x 512 canvas: `width` is its width in canvas units. */
// The wide A leaves the top and bottom of a round badge empty, so the badge's A is taller: STRETCH times its natural height at the same width (the feet stay inside the circle).
const STRETCH = 1.43
const icon = (width: number) => `<g transform="translate(256 256) scale(${width / ART_W} ${(width / ART_W) * STRETCH}) translate(${-CX} ${-CY})">${SMALL.map((p) => `<path d="${p.d}" fill="${p.fill}"/>`).join('')}</g>`
/** A faint light edge, so that a navy badge does not melt into a dark browser tab. */
const ring = '<circle cx="256" cy="256" r="251" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="10"/>'
const badge = (iconWidth: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${NAVY}"/>${ring}${icon(iconWidth)}</svg>`
const square = (iconWidth: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${NAVY}"/>${icon(iconWidth)}</svg>`

const png = (svg: string, size: number) => sharp(Buffer.from(svg), { density: Math.max(72, (72 * size * 4) / 512) }).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9, effort: 10, palette: true, quality: 95 }).toBuffer()

/** An .ico file holding PNG images (every browser since IE 9 reads them). */
function ico(images: Array<{ size: number; data: Buffer }>): Buffer {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const dir = images.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)])
}

async function main() {
  const out = (name: string, data: Buffer | string) => { writeFileSync(resolve(ROOT, 'public', name), data); console.log(name, Buffer.byteLength(data)) }
  mkdirSync(resolve(ROOT, 'public'), { recursive: true })
  // The vector badge: the icon at 86% of the width (a wide shape, so it is made taller to use the round badge).
  out('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>VORA</title><circle cx="256" cy="256" r="256" fill="${NAVY}"/>${ring}${icon(388)}</svg>\n`)
  // The icon fills the badge as far as the circle allows: 88% at 16 px, 87% at 32 px, 86% at 48 px.
  const small: Array<[number, number]> = [[16, 394], [32, 390], [48, 388]]
  const icoImages = await Promise.all(small.map(async ([size, w]) => ({ size, data: await png(badge(w), size) })))
  out('favicon.ico', ico(icoImages))
  out('favicon-32.png', icoImages[1].data)
  out('icon-192.png', await png(badge(390), 192))
  out('icon-512.png', await png(badge(388), 512))
  out('icon-maskable-512.png', await png(square(310), 512))
  out('apple-touch-icon.png', await sharp(Buffer.from(square(370)), { density: 288 }).resize(180, 180).flatten({ background: NAVY }).png({ compressionLevel: 9, effort: 10 }).toBuffer())
  out('site.webmanifest', JSON.stringify({
    name: 'VORA', short_name: 'VORA', description: 'Bringing the World Within Reach.', start_url: '/', display: 'browser', background_color: NAVY, theme_color: NAVY,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n')
}
void main()
