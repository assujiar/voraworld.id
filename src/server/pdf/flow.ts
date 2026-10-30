import { INK, RULE, type Sheet } from './kit'

/** One recorded drawing call. */
export type Op = () => void

export interface FlowBox {
  /** The first baseline of a page. */
  top: number
  /** The lowest baseline content may use (above the footer). */
  limit: number
  left: number
  right: number
}

/**
 * Lays a document out page by page BEFORE anything is drawn. Every drawing call is recorded against the current page, so the
 * number of pages is known when the pages are finally drawn (for "PAGE n OF m"), and a layout can be tried at several font sizes
 * and the one that fits kept. Nothing is ever clipped: content that does not fit moves to the next page.
 */
export class Flow {
  readonly pages: Op[][] = [[]]
  y: number

  constructor(readonly s: Sheet, readonly box: FlowBox) { this.y = box.top }

  get width(): number { return this.box.right - this.box.left }

  put(op: Op): void { this.pages[this.pages.length - 1].push(op) }

  text(x: number, y: number, value: unknown, size: number, fill = INK, bold = false): void { this.put(() => this.s.text(x, y, value, size, fill, bold)) }
  right(x: number, y: number, value: unknown, size: number, fill = INK, bold = false): void { this.put(() => this.s.right(x, y, value, size, fill, bold)) }
  /** Horizontal rule across the box unless given other ends. */
  rule(y: number, x1 = this.box.left, x2 = this.box.right, stroke = RULE, thickness = 0.65): void { this.put(() => this.s.rule(y, x1, x2, stroke, thickness)) }
  rect(x: number, y: number, w: number, h: number, fill: string): void { this.put(() => this.s.rect(x, y, w, h, fill)) }
  roundRect(x: number, y: number, w: number, h: number, r: number, fill: string): void { this.put(() => this.s.roundRect(x, y, w, h, r, fill)) }
  outline(x: number, y: number, w: number, h: number, stroke: string, thickness = 1, dash?: number[]): void { this.put(() => this.s.outline(x, y, w, h, stroke, thickness, dash)) }

  newPage(): void { this.pages.push([]); this.y = this.box.top }

  /** Starts a new page unless `height` still fits above the limit. Returns true when it did start one. */
  keep(height: number): boolean {
    if (this.y - height >= this.box.limit) return false
    this.newPage()
    return true
  }

  /** Wraps `content` to `width` and records one line per row, returning the baseline below the last. It never starts a page. */
  lines(x: number, y: number, content: string, width: number, size: number, fill = INK, bold = false, leading = size + 2): number {
    for (const row of this.s.wrap(content, width, size, bold)) { if (row) this.text(x, y, row, size, fill, bold); y -= leading }
    return y
  }

  /**
   * Draws every page: `frame` (header and footer) first, then what was recorded for it. `frame` receives the page number and
   * the total, which is only known now.
   */
  draw(frame: (pageNo: number, total: number) => void): void {
    const total = this.pages.length
    this.pages.forEach((ops, index) => {
      if (index > 0) this.s.newPage()
      frame(index + 1, total)
      for (const op of ops) op()
    })
  }
}
