/**
 * Makes the site's icons from the approved VORA logo (src/content/vora-motion-art.ts, its path data used as it is): the wordmark in white on a Midnight Navy rounded square, in two lines,
 *   VO
 *   RA
 * The logo is one connected drawing, so the two lines are cut out of it, not redrawn: the V flows into the O, and the R flows into the A, so the cut falls between the O and the R. Both lines
 * are as wide as the square allows and together they are as tall as it allows, so the padding is the same on all four sides (PAD). All of it is white, the wedge of the A included.
 *   public/favicon.svg             the rounded square as a vector (browsers that take SVG: Chrome, Edge, Firefox)
 *   public/favicon.ico             16, 32 and 48 px (PNG inside), for every browser that asks for /favicon.ico, Safari and the older ones above all
 *   public/icon-192.png, icon-512.png   the rounded square for Android and for installed sites
 *   public/icon-maskable-512.png   the wordmark on a full navy square, inside the safe zone, for the shapes Android cuts out
 *   public/apple-touch-icon.png    180 px, a full navy square without transparency (iOS rounds it itself)
 * Run: npm run build:favicons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { LOGO_ART } from '../src/content/vora-motion-art'

const ROOT = resolve(__dirname, '..')
const NAVY = '#101720'

// The wordmark is one drawing; its two lines are cut from it. The O is a ring centred at (759, 354) with a radius of about 190: everything left of x 759 plus a circle of 205 around that centre
// is the first line (V, O), the rest is the second (R, A). The R begins at x 895, outside that circle. The boxes are each line's extent in the art's own units.
const CUT = { x: 759, cx: 759, cy: 354, r: 205 }
const LINE1 = { x0: 132, x1: 952, y0: 176, y1: 542 }
const LINE2 = { x0: 895, x1: 1904, y0: 188, y1: 542 }
const GAP = 0.06                                                   // the space between the lines, as a share of the side

/**
 * The two lines on a 512 x 512 canvas, each as wide as the square inside `pad`, both together as tall as it. `bold` is how many canvas units (of 512) the letters are thickened by, as an outline
 * of the same white around each letter (a vector stroke with round joins, so the shapes stay clean). The logo's strokes are about 35 units thick, which is about a pixel at 16 px, so a little
 * is added there; it is kept small because the gaps between letters (the negative space) close as the letters thicken. The outline is outside the shapes, so the box that the padding is
 * measured to includes it: the letters get bolder, not larger. The cut between the O and the R keeps clear of it (the O reaches 190 + the outline from its centre, the R tip is 223 - the outline).
 */
const wordmark = (pad: number, bold = 0) => {
  const side = 512 - 2 * pad, h = (side * (1 - GAP)) / 2
  const place = (b: typeof LINE1, y: number) => {
    const sx0 = side / (b.x1 - b.x0), sy0 = h / (b.y1 - b.y0)
    const w = bold / Math.sqrt(sx0 * sy0)                          // the outline's width in the art's units, so that it is `bold` canvas units on screen
    const e = { x0: b.x0 - w / 2, x1: b.x1 + w / 2, y0: b.y0 - w / 2, y1: b.y1 + w / 2 }
    return { t: `translate(${pad} ${y}) scale(${side / (e.x1 - e.x0)} ${h / (e.y1 - e.y0)}) translate(${-e.x0} ${-e.y0})`, w }
  }
  const one = place(LINE1, pad), two = place(LINE2, pad + h + side * GAP)
  const outline = (w: number) => (bold ? ` stroke="#fff" stroke-width="${+w.toFixed(1)}" stroke-linejoin="round"` : '')
  return `<defs><path id="i" d="${LOGO_ART.ink.d}" fill-rule="evenodd"/><path id="w" d="${LOGO_ART.red.d}" fill-rule="evenodd"/>`
    + `<clipPath id="a"><rect width="${CUT.x}" height="900"/><circle cx="${CUT.cx}" cy="${CUT.cy}" r="${CUT.r}"/></clipPath>`
    + `<mask id="b" maskUnits="userSpaceOnUse" width="2200" height="900"><rect width="2200" height="900" fill="#fff"/><rect width="${CUT.x}" height="900"/><circle cx="${CUT.cx}" cy="${CUT.cy}" r="${CUT.r}"/></mask></defs>`
    + `<g fill="#fff"><g transform="${one.t}" clip-path="url(#a)"><use href="#i"${outline(one.w)}/></g>`
    + `<g transform="${two.t}" mask="url(#b)"><use href="#i"${outline(two.w)}/><use href="#w"/></g></g>`
}
/** Padding, in 512 units, of the rounded square at the large sizes and at 16 px, where every pixel counts. */
const PAD = 52, PAD_16 = 44, RADIUS = 100
/** How much bolder the letters are drawn at the small sizes (canvas units of 512): 16 px gets the most, 32 px and the vector badge (which tabs draw at 16 to 32 px) a little less (a vector outline, not a raster dilation, which closes the gaps between letters). */
const BOLD_16 = 12, BOLD_32 = 8
/** A faint light edge, so that a navy badge does not melt into a dark browser tab. */
const edge = `<rect x="5" y="5" width="502" height="502" rx="${RADIUS - 5}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="10"/>`
const badge = (pad: number, bold = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${RADIUS}" fill="${NAVY}"/>${edge}${wordmark(pad, bold)}</svg>`
const square = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${NAVY}"/>${wordmark(pad)}</svg>`

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
  out('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>VORA</title><rect width="512" height="512" rx="${RADIUS}" fill="${NAVY}"/>${edge}${wordmark(PAD, BOLD_32)}</svg>\n`)
  const small: Array<[number, number, number]> = [[16, PAD_16, BOLD_16], [32, PAD, BOLD_32], [48, PAD, 0]]
  const icoImages = await Promise.all(small.map(async ([size, pad, bold]) => ({ size, data: await png(badge(pad, bold), size) })))
  out('favicon.ico', ico(icoImages))
  out('favicon-32.png', icoImages[1].data)
  out('icon-192.png', await png(badge(PAD), 192))
  out('icon-512.png', await png(badge(PAD), 512))
  // Maskable: platforms cut a circle of 80% of the width; the corners of the wordmark are its extremes, so the square is 280 wide: (512 - 280) / 2 = 116.
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
