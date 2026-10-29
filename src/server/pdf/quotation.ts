import { money } from '../money'
import { H, INK, PALE, RED, SLATE, W, WHITE, PdfLayoutError, Sheet, withoutCurrency } from './kit'
import type { Issuer, QuotationData } from './types'

/**
 * One-page A4 quotation (up to 10 items). The whole page is MEASURED before it is returned: if the content does not fit
 * at one font size, the next smaller one is tried, and if nothing fits the document is refused with an actionable message.
 * No description, note or amount is ever clipped or silently dropped.
 */
const LEFT = 43
const RIGHT = W - 43
const WIDTH = RIGHT - LEFT
const FOOTER_TOP = 86
export const COMPACT_MAX_ITEMS = 10

export async function renderQuotationOnePage(q: QuotationData, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  if (q.items.length > COMPACT_MAX_ITEMS) throw new Error(`The one-page layout holds at most ${COMPACT_MAX_ITEMS} line items`)
  for (const fs of [8.0, 7.7, 7.4, 7.1, 6.8, 6.5]) {
    const bytes = await attempt(q, issuer, verificationUrl, fs)
    if (bytes) return bytes
  }
  throw new PdfLayoutError(
    'The quotation is too long for a readable single A4 page. Shorten item descriptions or notes. No item, note or amount has been silently omitted.')
}

async function attempt(q: QuotationData, issuer: Issuer, verificationUrl: string, fs: number): Promise<Uint8Array | null> {
  const s = await Sheet.create({ title: `QUOTATION | ${q.number}`, author: 'VORA | PT Satu Arah International', subject: 'VORA business document' })
  const cur = q.currency
  const txt = (x: number, y: number, v: unknown, size = fs, fill = INK, bold = false) => s.text(x, y, v, size, fill, bold)
  const rt = (x: number, y: number, v: unknown, size = fs, fill = INK, bold = false) => s.right(x, y, v, size, fill, bold)
  const rule = (y: number) => s.rule(y, LEFT, RIGHT)
  const section = (title: string, y: number): number => {
    txt(LEFT, y, title.toUpperCase(), Math.max(6.7, fs - 0.4), RED, true)
    rule(y - 5)
    return y - 15
  }
  const linesAt = (x: number, y: number, content: string, width: number, size = fs, fill = INK, bold = false, leading = size + 2): number => {
    for (const line of s.wrap(content, width, size, bold)) { txt(x, y, line, size, fill, bold); y -= leading }
    return y
  }

  s.background({ x: W / 2 - 168, y: H / 2 - 101, w: 336, h: 202 })
  s.band(89, 3, { x: LEFT, y: H - 65, w: 137, h: 30 })
  txt(LEFT, H - 79, 'FREIGHT & LOGISTICS', 7, WHITE)
  rt(RIGHT, H - 39, 'QUOTATION', 16, WHITE, true)
  rt(RIGHT, H - 54, q.number, 6.8, WHITE)
  rt(RIGHT, H - 74, (q.status || 'draft').toUpperCase().replace(/_/g, ' '), 7, '#E8B3AA', true)
  rule(FOOTER_TOP)
  txt(LEFT, 68, 'VORA / DOCUMENT VERIFICATION', 7.7, SLATE, true)
  txt(LEFT, 54, 'Scan QR for document number and current status.', 6.8, SLATE)
  txt(LEFT, 39, issuer.email, 7.2, INK)
  txt(LEFT, 25, 'QUOTATION  /  1 OF 1', 7.1, SLATE)
  s.page.drawImage(await s.qr(verificationUrl), { x: RIGHT - 65, y: 13, width: 64, height: 64 })

  let y = H - 108
  const secondX = LEFT + WIDTH / 2 + 8
  const colW = WIDTH / 2 - 16
  txt(LEFT, y, 'ISSUED BY', 7.1, RED, true)
  txt(secondX, y, 'OFFERED TO', 7.1, RED, true)
  y -= 14
  const draw = (x: number, parts: Array<[string, boolean, string]>): number => {
    let pos = y
    for (const [part, bold, fill] of parts) {
      if (!part) continue
      pos = linesAt(x, pos, part, colW, bold ? fs : fs - 0.15, fill, bold, fs + 1.7)
      pos -= 2
    }
    return pos
  }
  const r = q.recipient
  const recipientParts: Array<[string, boolean, string]> = [[r.name, true, INK], [r.address, false, SLATE], [r.email, false, SLATE]]
  if (r.taxId) recipientParts.push([`TAX ID: ${r.taxId}`, false, SLATE])
  y = Math.min(draw(LEFT, [[issuer.legalName, true, INK], [issuer.address, false, SLATE], [issuer.email, false, SLATE]]), draw(secondX, recipientParts)) - 7
  rule(y)
  y -= 14

  const metadata = (label: string, value: string, x: number, yy: number): number => {
    txt(x, yy, label.toUpperCase(), 6.8, SLATE)
    const size = Math.max(6.1, fs - 0.3)
    const rows = s.wrap(value, WIDTH / 4 - 6, size, true)
    rows.forEach((line, i) => txt(x, yy - 11 - i * (size + 1), line, size, INK, true))
    return rows.length
  }
  const slots: Array<[string, string]> = [['ISSUED', q.issuedAt], ['CURRENCY', cur], ['STATUS', q.status.replace(/_/g, ' ')], ['VALID UNTIL', q.validUntil]]
  const metaMax = Math.max(...slots.map(([k, v], i) => metadata(k, v, LEFT + (WIDTH / 4) * i, y)))
  y -= 12 + metaMax * (fs + 1.5) + 8

  y = section('Services / charges', y)
  s.roundRect(LEFT, y - 11, WIDTH, 21, 4, PALE)
  txt(LEFT + 7, y - 4, 'DESCRIPTION', 6.7, SLATE, true)
  rt(LEFT + 317, y - 4, 'QTY', 6.7, SLATE, true)
  rt(LEFT + 369, y - 4, 'UNIT', 6.7, SLATE, true)
  rt(LEFT + 433, y - 4, 'RATE', 6.7, SLATE, true)
  rt(RIGHT - 6, y - 4, 'AMOUNT', 6.7, SLATE, true)
  y -= 24
  const itemSize = Math.max(6.25, fs - 0.35)
  const amountSize = Math.max(5.9, fs - 0.75)
  q.items.forEach((item, idx) => {
    // Number the lines unless the description already starts with its own number.
    const description = /^\s*\d{1,2}\s+/.test(item.description) ? item.description : `${String(idx + 1).padStart(2, '0')}  ${item.description}`
    const rows = s.wrap(description, 246, itemSize)
    const leading = itemSize + 1.6
    const rowH = Math.max(17, rows.length * leading + 4)
    rule(y + 7)
    rows.forEach((line, n) => txt(LEFT + 7, y - n * leading, line, itemSize))
    rt(LEFT + 317, y, item.quantity, amountSize)
    rt(LEFT + 369, y, item.unit, amountSize)
    rt(LEFT + 433, y, withoutCurrency(money(item.priceMinor, cur)), amountSize)
    rt(RIGHT - 6, y, withoutCurrency(money(item.amountMinor, cur)), amountSize, INK, true)
    y -= rowH
  })
  rule(y + 6)
  y -= 11
  const totals: Array<[string, number]> = [['SUBTOTAL', q.subtotalMinor], [`TAX (${q.taxPercent}%)`, q.taxMinor], ['GRAND TOTAL', q.totalMinor]]
  for (const [label, value] of totals) {
    if (label === 'GRAND TOTAL') {
      s.roundRect(LEFT + WIDTH * 0.49, y - 16, WIDTH * 0.51, 25, 4, INK)
      txt(LEFT + WIDTH * 0.51, y - 6, 'TOTAL', Math.max(7, fs), WHITE, true)
      rt(RIGHT - 7, y - 6, money(value, cur), Math.max(7, fs), WHITE, true)
      y -= 28
    } else {
      txt(LEFT + WIDTH * 0.52, y, label, fs - 0.1, SLATE)
      rt(RIGHT - 6, y, money(value, cur), fs)
      y -= Math.max(12.5, fs + 5)
    }
  }
  y -= 2
  const notes = (q.notes || '').trim()
  if (notes) {
    y = section('Notes / terms', y)
    y = linesAt(LEFT, y, notes, WIDTH - 4, Math.max(6.3, fs - 0.5), INK, false, Math.max(8, fs + 1))
    y -= 2
  }
  // The customer signs and stamps the PDF itself through the secure approval link.
  y -= 8
  y = section('Approved by customer', y)
  txt(LEFT + 6, y, 'AUTHORIZED SIGNATURE', Math.max(6.4, fs - 0.4), SLATE, true)
  txt(secondX, y, 'COMPANY STAMP', Math.max(6.4, fs - 0.4), SLATE, true)
  s.rule(y - 40, LEFT + 6, secondX - 18, '#DCE0E1', 1)
  s.rule(y - 40, secondX, RIGHT - 5, '#DCE0E1', 1)
  y -= 46
  // Returned only when everything fitted above the reserved footer.
  return y >= FOOTER_TOP + 11 ? s.save() : null
}
