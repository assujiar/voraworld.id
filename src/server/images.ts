export type ImageType = { mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif'; ext: '.png' | '.jpg' | '.webp' | '.avif' }

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) }
  return ~c >>> 0
}

function validPng(b: Uint8Array): boolean {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let pos = 8
  let sawIhdr = false
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos)
    const type = String.fromCharCode(...b.subarray(pos + 4, pos + 8))
    if (pos + 12 + len > b.length) return false
    if (crc32(b.subarray(pos + 4, pos + 8 + len)) !== dv.getUint32(pos + 8 + len)) return false
    if (type === 'IHDR') sawIhdr = len === 13
    if (type === 'IEND') return sawIhdr
    pos += 12 + len
  }
  return false
}

/**
 * Identifies and structurally checks an uploaded image from its bytes (never from the filename or the
 * browser-supplied type). Returns null for anything that is not a well-formed PNG, JPEG, WebP or AVIF.
 */
export function detectImage(b: Uint8Array): ImageType | null {
  if (b.length < 32) return null
  if (PNG_SIG.every((v, i) => b[i] === v)) return validPng(b) ? { mime: 'image/png', ext: '.png' } : null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    // A complete JPEG ends with the EOI marker (trailing zero padding is tolerated).
    let end = b.length
    while (end > 2 && b[end - 1] === 0) end--
    return b[end - 2] === 0xff && b[end - 1] === 0xd9 ? { mime: 'image/jpeg', ext: '.jpg' } : null
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const size = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4, true)
    return size + 8 === b.length || size + 8 === b.length - 1 ? { mime: 'image/webp', ext: '.webp' } : null
  }
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return { mime: 'image/avif', ext: '.avif' }
  return null
}
