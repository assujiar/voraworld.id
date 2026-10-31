/**
 * Makes the site's icons from the approved reverse A icon (public/static/assets/vora-a-icon-reverse.svg): a Midnight Navy rounded square with the icon on it. The icon keeps the approved outline
 * and apex; the legs are heavier and the wedge larger so that it stays clear when small, and it is drawn as tall as it is wide, so that the padding is the same on all four sides (PAD).
 *   public/favicon.svg             the rounded square as a vector (browsers that take SVG: Chrome, Edge, Firefox)
 *   public/favicon.ico             16, 32 and 48 px (PNG inside), for every browser that asks for /favicon.ico, Safari and the older ones above all
 *   public/icon-192.png, icon-512.png   the rounded square for Android and for installed sites
 *   public/icon-maskable-512.png   the icon on a full navy square, inside the safe zone, for the shapes Android cuts out
 *   public/apple-touch-icon.png    180 px, a full navy square without transparency (iOS rounds it itself)
 * Run: npm run build:favicons
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
// The apex curve is a quadratic whose control point is at y -27, so the visible top is at y 7.5 (0.25 * 42 + 0.5 * -27 + 0.25 * 42); the feet end at y 520.
const ART_W = 1000, ART_TOP = 7.5, ART_H = 520 - ART_TOP

/**
 * The icon on a 512 x 512 canvas, drawn as a square of side 512 - 2 * pad: the art is 1000 wide and 512.5 tall, so it is stretched in height until both are equal and the padding is the same on all sides.
 *  */
const icon = (pad: number) => { const side = 512 - 2 * pad; return `<g transform="translate(${pad} ${pad}) scale(${side / ART_W} ${side / ART_H}) translate(0 ${-ART_TOP})">${SMALL.map((p) => `<path d="${p.d}" fill="${p.fill}"/>`).join('')}</g>` }
/** Padding, in 512 units, of the rounded square at the large sizes (11%) and at 16 px (9%), where every pixel counts. */
const PAD = 56, PAD_16 = 46, RADIUS = 100
/** A faint light edge, so that a navy badge does not melt into a dark browser tab. */
const edge = `<rect x="5" y="5" width="502" height="502" rx="${RADIUS - 5}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="10"/>`
const badge = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${RADIUS}" fill="${NAVY}"/>${edge}${icon(pad)}</svg>`
const square = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${NAVY}"/>${icon(pad)}</svg>`

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
  out('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>VORA</title><rect width="512" height="512" rx="${RADIUS}" fill="${NAVY}"/>${edge}${icon(PAD)}</svg>\n`)
  const small: Array<[number, number]> = [[16, PAD_16], [32, PAD], [48, PAD]]
  const icoImages = await Promise.all(small.map(async ([size, pad]) => ({ size, data: await png(badge(pad), size) })))
  out('favicon.ico', ico(icoImages))
  out('favicon-32.png', icoImages[1].data)
  out('icon-192.png', await png(badge(PAD), 192))
  out('icon-512.png', await png(badge(PAD), 512))
  // Maskable: platforms cut a circle of 80% of the width; the feet of the icon are its corners, so the square is 280 wide: (512 - 280) / 2 = 116.
  out('icon-maskable-512.png', await png(square(116), 512))
  // iOS rounds the corners by itself (about 22% of the width), so the icon keeps clear of them.
  out('apple-touch-icon.png', await sharp(Buffer.from(square(70)), { density: 288 }).resize(180, 180).flatten({ background: NAVY }).png({ compressionLevel: 9, effort: 10 }).toBuffer())
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
