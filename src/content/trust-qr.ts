import QRCode from 'qrcode'

/**
 * The QR code of a verification address as plain geometry, so that the PDF (server) and the preview (browser) draw the very same code, as vectors that stay
 * sharp at any print size. Dark modules on white, error correction M, and the standard quiet zone of four modules inside the square that is given.
 */
export const QUIET_MODULES = 4

export interface QrMatrix { size: number; dark: (x: number, y: number) => boolean }

export function qrMatrix(text: string): QrMatrix {
  const m = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
  return { size: m.size, dark: (x, y) => m.get(y, x) === 1 }
}

/** The QR code as SVG path data (`M L Z` only) inside a square of `side` at (x, y): one path for all dark modules, and horizontal runs merged. The quiet zone is inside `side`. */
export function qrPath(matrix: QrMatrix, x: number, y: number, side: number): { d: string; module: number } {
  const module = side / (matrix.size + 2 * QUIET_MODULES)
  const parts: string[] = []
  const f = (n: number) => Number(n.toFixed(4))
  for (let r = 0; r < matrix.size; r++) {
    let c = 0
    while (c < matrix.size) {
      if (!matrix.dark(c, r)) { c++; continue }
      let e = c
      while (e < matrix.size && matrix.dark(e, r)) e++
      const x0 = x + (QUIET_MODULES + c) * module, y0 = y + (QUIET_MODULES + r) * module, x1 = x + (QUIET_MODULES + e) * module, y1 = y0 + module
      parts.push(`M${f(x0)} ${f(y0)}L${f(x1)} ${f(y0)}L${f(x1)} ${f(y1)}L${f(x0)} ${f(y1)}Z`)
      c = e
    }
  }
  return { d: parts.join(''), module }
}
