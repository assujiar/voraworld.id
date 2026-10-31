import { money } from '../money'
import { Flow } from './flow'
import { BAND_H, H, INK, PALE, RED, SLATE, W, WHITE, PdfLayoutError, Sheet, withoutCurrency } from './kit'
import type { Issuer, QuotationData } from './types'

/**
 * The quotation is issued as a PRICE AGREEMENT LETTER: parties, an opening statement, the services with their agreed prices,
 * totals, Terms of Payment, Terms & Conditions, notes and the boxed CUSTOMER APPROVAL area that records the Customer's agreement.
 * It takes the pages its content needs. Text sections may continue on the next page; the approval area is never split and always
 * follows the terms it accepts. The layout is MEASURED before anything is drawn: one page is preferred and looked for at font
 * sizes 8.0 down to 7.1, otherwise it flows over as many pages as it needs at 8.0. Nothing is clipped or dropped.
 * The verification address is printed (and clickable) in every footer; the customer's upload address is printed (and clickable)
 * in the approval area while an approval request is open.
 */
const LEFT = 43
const RIGHT = W - 43
const WIDTH = RIGHT - LEFT
const FOOTER_TOP = 86
/** The lowest baseline the content may use, so it always stays clear of the footer line. */
const LIMIT = FOOTER_TOP + 12
/** The first baseline under the header band. */
const TOP = H - BAND_H - 22
const TITLE = 'PRICE AGREEMENT LETTER'
const SIZES = [8.0, 7.7, 7.4, 7.1]
const BAND_EDGE_FOOT = 4

export async function renderQuotation(q: QuotationData, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  const s = await Sheet.create({ title: `${TITLE} | ${q.number}`, author: 'VORA | PT Satu Arah International', subject: 'Price agreement letter (quotation) with online document verification' })

  let flow = place(s, q, issuer, SIZES[0])
  if (flow.pages.length > 1) {
    for (const fs of SIZES.slice(1)) {
      const tighter = place(s, q, issuer, fs)
      if (tighter.pages.length === 1) { flow = tighter; break }
    }
  }

  flow.draw((pageNo, total) => {
    // Repeated on every page: the header band and the verification footer.
    s.background({ x: W / 2 - 168, y: H / 2 - 101, w: 336, h: 202 })
    s.header({ x: LEFT, logoWidth: 144, info: { address: issuer.address, taxId: issuer.taxId } })
    s.right(RIGHT, H - 46, TITLE, 16, WHITE, true)
    s.right(RIGHT, H - 66, q.number, 6.8, WHITE)
    s.right(RIGHT, H - 86, (q.status || 'draft').toUpperCase().replace(/_/g, ' '), 7, '#E8B3AA', true)
    s.footer(FOOTER_TOP, LEFT, RIGHT, BAND_EDGE_FOOT)
    const mark = s.verificationMark({ url: verificationUrl, lang: 'en', right: RIGHT, bottom: 7.5 })
    s.text(LEFT, 71, 'VORA / DOCUMENT VERIFICATION', 7.7, SLATE, true)
    s.text(LEFT, 60, 'Scan the QR code, or click this link, to check the document online:', 6.4, SLATE)
    s.linkLines(LEFT, 50, verificationUrl, mark.left - 12 - LEFT, 5.9, INK)
    s.text(LEFT, 36, issuer.email, 7.2, INK)
    s.text(LEFT, 24, `${TITLE}  /  PAGE ${pageNo} OF ${total}`, 7.1, SLATE)
  })
  return s.save()
}

/** Lays the whole quotation out for one font size. Nothing is drawn yet: the result knows how many pages it needs. */
function place(s: Sheet, q: QuotationData, issuer: Issuer, fs: number): Flow {
  const cur = q.currency
  const f = new Flow(s, { top: TOP, limit: LIMIT, left: LEFT, right: RIGHT })
  const txt = (x: number, y: number, v: unknown, size = fs, fill = INK, bold = false) => f.text(x, y, v, size, fill, bold)
  const rt = (x: number, y: number, v: unknown, size = fs, fill = INK, bold = false) => f.right(x, y, v, size, fill, bold)
  const titleSize = Math.max(6.7, fs - 0.4)
  const section = (title: string) => {
    txt(LEFT, f.y, title.toUpperCase(), titleSize, RED, true)
    f.rule(f.y - 5)
    f.y -= 15
  }

  // ---- parties and metadata (first page)
  const secondX = LEFT + WIDTH / 2 + 8
  const colW = WIDTH / 2 - 16
  txt(LEFT, f.y, 'PROVIDER', 7.1, RED, true)
  txt(secondX, f.y, 'CUSTOMER', 7.1, RED, true)
  f.y -= 14
  const top = f.y
  const draw = (x: number, parts: Array<[string, boolean, string]>): number => {
    let pos = top
    for (const [part, bold, fill] of parts) {
      if (!part) continue
      pos = f.lines(x, pos, part, colW, bold ? fs : fs - 0.15, fill, bold, fs + 1.7)
      pos -= 2
    }
    return pos
  }
  const r = q.recipient
  const recipientParts: Array<[string, boolean, string]> = [[r.name, true, INK], [r.address, false, SLATE], [r.email, false, SLATE]]
  if (r.taxId) recipientParts.push([`TAX ID: ${r.taxId}`, false, SLATE])
  const issuerParts: Array<[string, boolean, string]> = [[issuer.legalName, true, INK], [issuer.address, false, SLATE], [issuer.email, false, SLATE]]
  if (issuer.taxId) issuerParts.push([`NPWP: ${issuer.taxId}`, false, SLATE])
  f.y = Math.min(draw(LEFT, issuerParts), draw(secondX, recipientParts)) - 7
  if (f.y < TOP - 190) throw new PdfLayoutError('The issuer or recipient details are too long for the quotation')
  f.rule(f.y)
  f.y -= 14

  const metadata = (label: string, value: string, x: number, y: number): number => {
    txt(x, y, label.toUpperCase(), 6.8, SLATE)
    const size = Math.max(6.1, fs - 0.3)
    const rows = s.wrap(value, WIDTH / 4 - 6, size, true)
    rows.forEach((line, i) => txt(x, y - 11 - i * (size + 1), line, size, INK, true))
    return rows.length
  }
  const slots: Array<[string, string]> = [['ISSUED', q.issuedAt], ['CURRENCY', cur], ['STATUS', q.status.replace(/_/g, ' ')], ['VALID UNTIL', q.validUntil]]
  const metaMax = Math.max(...slots.map(([k, v], i) => metadata(k, v, LEFT + (WIDTH / 4) * i, f.y)))
  f.y -= 12 + metaMax * (fs + 1.5) + 8

  // What the Customer agrees to, in terms of this letter: stated up front so the signature at the end has a clear meaning.
  const bodySize = Math.max(6.6, fs - 0.5)
  const bodyLeading = bodySize + 1.9
  const accepted = [q.paymentTerms.trim() && 'the Terms of Payment', q.termsConditions.trim() && 'the Terms & Conditions'].filter(Boolean)
  const withTerms = accepted.length ? `, ${accepted.join(' and ')} stated in this letter` : ''
  const opening = `This Price Agreement Letter records the prices at which ${issuer.legalName} ("VORA") will provide the services below to ${q.recipient.name} (the "Customer"), valid until ${q.validUntil}. ` +
    `The Customer agrees to these prices${withTerms} by signing and stamping this letter and returning it to VORA.`
  for (const row of s.wrap(opening, WIDTH - 4, bodySize)) { txt(LEFT, f.y, row, bodySize); f.y -= bodyLeading }
  f.y -= 8

  // ---- services table (continues on the next page with its header repeated)
  const tableHeader = (continued: boolean) => {
    section(continued ? 'Services and agreed prices (continued)' : 'Services and agreed prices')
    const hy = f.y
    f.roundRect(LEFT, hy - 11, WIDTH, 21, 4, PALE)
    txt(LEFT + 7, hy - 4, 'DESCRIPTION', 6.7, SLATE, true)
    rt(LEFT + 317, hy - 4, 'QTY', 6.7, SLATE, true)
    rt(LEFT + 369, hy - 4, 'UNIT', 6.7, SLATE, true)
    rt(LEFT + 433, hy - 4, 'RATE', 6.7, SLATE, true)
    rt(RIGHT - 6, hy - 4, 'AMOUNT', 6.7, SLATE, true)
    f.y -= 24
  }
  tableHeader(false)
  const itemSize = Math.max(6.25, fs - 0.35)
  const amountSize = Math.max(5.9, fs - 0.75)
  const leading = itemSize + 1.6
  /** A right-aligned figure that shrinks a little to stay inside its column, and is refused if it still cannot fit. */
  const figure = (x: number, y: number, value: string, maxWidth: number, bold = false) => {
    let size = amountSize
    while (s.width(value, size, bold) > maxWidth && size > 5.2) size -= 0.2
    if (s.width(value, size, bold) > maxWidth) throw new PdfLayoutError('A quantity, unit or amount is too wide for the quotation table')
    rt(x, y, value, size, INK, bold)
  }
  q.items.forEach((item, idx) => {
    // Number the lines unless the description already starts with its own number.
    const description = /^\s*\d{1,2}\s+/.test(item.description) ? item.description : `${String(idx + 1).padStart(2, '0')}  ${item.description}`
    const rows = s.wrap(description, 246, itemSize)
    const rowH = Math.max(17, rows.length * leading + 4)
    if (rowH > TOP - LIMIT - 120) throw new PdfLayoutError(`Line item ${idx + 1} is too long. Shorten its description`)
    if (f.keep(rowH)) tableHeader(true)
    const y = f.y
    f.rule(y + 7)
    rows.forEach((line, n) => txt(LEFT + 7, y - n * leading, line, itemSize))
    figure(LEFT + 317, y, item.quantity, 60)
    figure(LEFT + 369, y, item.unit, 48)
    figure(LEFT + 433, y, withoutCurrency(money(item.priceMinor, cur)), 62)
    figure(RIGHT - 6, y, withoutCurrency(money(item.amountMinor, cur)), 68, true)
    f.y -= rowH
  })
  f.rule(f.y + 6)
  f.y -= 11

  // ---- totals (kept together)
  const step = Math.max(12.5, fs + 5)
  f.keep(2 * step + 28)
  for (const [label, value] of [['SUBTOTAL', q.subtotalMinor], [`TAX (${q.taxPercent}%)`, q.taxMinor]] as const) {
    txt(LEFT + WIDTH * 0.52, f.y, label, fs - 0.1, SLATE)
    rt(RIGHT - 6, f.y, money(value, cur), fs)
    f.y -= step
  }
  const gy = f.y
  f.roundRect(LEFT + WIDTH * 0.49, gy - 16, WIDTH * 0.51, 25, 4, INK)
  txt(LEFT + WIDTH * 0.51, gy - 6, 'TOTAL', Math.max(7, fs), WHITE, true)
  rt(RIGHT - 7, gy - 6, money(q.totalMinor, cur), Math.max(7, fs), WHITE, true)
  f.y -= 34

  // ---- terms of payment, terms & conditions, notes: titled text that may continue on the next page
  const rowsOf = (text: string) => (text.trim() ? s.wrap(text.trim(), WIDTH - 4, bodySize) : [])      // an older quotation has no such text: nothing is printed
  const heightOf = (rows: string[]) => (rows.length ? 15 + rows.length * bodyLeading + 7 : 0)
  const textSection = (title: string, rows: string[]) => {
    if (!rows.length) return
    f.keep(15 + 2 * bodyLeading)                          // never a title alone at the foot of a page
    section(title)
    for (const row of rows) {
      if (f.y < LIMIT) { f.newPage(); section(`${title} (continued)`) }
      if (row) txt(LEFT, f.y, row, bodySize)
      f.y -= bodyLeading
    }
    f.y -= 7
  }

  // The customer approval is one block that is never split, with room to sign, stamp and write who signed and when.
  const statement = `By signing and stamping below, the Customer agrees to the prices in this Price Agreement Letter ${q.number} (total ${money(q.totalMinor, cur)}, valid until ${q.validUntil})` +
    `${accepted.length ? `, including ${accepted.join(' and ')} stated in this document` : ''}.`
  const statementRows = s.wrap(statement, WIDTH - 4, bodySize)
  const noteSize = Math.max(6.2, fs - 1.3)
  // Where to send it back: a clickable address while an approval request is open, otherwise the way it was sent.
  const upload = q.uploadUrl ?? ''
  const returnRows = s.wrap(upload
    ? 'Upload the signed and stamped PDF through this secure link (click it, or copy it into your browser):'
    : `Sign and stamp this document, then return the PDF through the secure approval link in the email from VORA, or send it to ${issuer.email}.`, WIDTH - 4, noteSize)
  const linkSize = Math.max(5.6, fs - 1.9)
  const linkHeight = upload ? s.linkHeight(upload, WIDTH - 4, linkSize) : 0
  const BOX_H = 50
  const approvalHeight = 15 + statementRows.length * bodyLeading + 6 + BOX_H + 14 + 16 + returnRows.length * (noteSize + 1.8) + linkHeight

  const paymentRows = rowsOf(q.paymentTerms)
  const termsRows = rowsOf(q.termsConditions)
  const notesRows = rowsOf(q.notes)
  textSection('Terms of payment', paymentRows)             // stays with the totals it explains
  // The conditions, the notes and the signature belong together: when they do not fit what is left of the page but fit a page
  // of their own, they all move to the next page, so the signature is never alone on a page without the terms it accepts.
  const closing = heightOf(termsRows) + heightOf(notesRows) + approvalHeight
  if (f.y - closing < LIMIT && closing <= TOP - LIMIT) f.newPage()
  textSection('Terms & conditions', termsRows)
  textSection('Notes', notesRows)

  // ---- customer approval
  f.keep(approvalHeight)

  const titleY = f.y
  section('Customer approval')
  rt(RIGHT, titleY, `Ref. ${q.number}`, Math.max(6.2, titleSize - 0.3), SLATE)
  for (const row of statementRows) { txt(LEFT, f.y, row, bodySize); f.y -= bodyLeading }
  f.y -= 6

  const gap = 12
  const signatureW = Math.round((WIDTH - gap) * 0.58)
  const stampW = WIDTH - gap - signatureW
  const stampX = LEFT + signatureW + gap
  const boxTop = f.y
  const boxBottom = boxTop - BOX_H
  f.outline(LEFT, boxBottom, signatureW, BOX_H, SLATE, 0.8)
  f.outline(stampX, boxBottom, stampW, BOX_H, SLATE, 0.8, [3, 2])          // dashed: "the stamp goes here"
  txt(LEFT + 6, boxTop - 9, 'AUTHORIZED SIGNATURE', 6.3, SLATE, true)
  txt(stampX + 6, boxTop - 9, 'COMPANY STAMP', 6.3, SLATE, true)
  txt(LEFT + 8, boxBottom + 9, 'X', 8, SLATE, true)
  f.rule(boxBottom + 8, LEFT + 20, LEFT + signatureW - 8, SLATE)
  const hint = 'STAMP HERE'
  txt(stampX + (stampW - s.width(hint, 6.6, true)) / 2, boxBottom + BOX_H / 2 - 3, hint, 6.6, '#C2C9CC', true)

  // Who signed and when, written on the lines.
  f.y = boxBottom - 14
  const colGap = 12
  const nameW = Math.round((WIDTH - 2 * colGap) * 0.42)
  const positionW = Math.round((WIDTH - 2 * colGap) * 0.34)
  const dateW = WIDTH - 2 * colGap - nameW - positionW
  let x = LEFT
  for (const [label, width] of [['NAME', nameW], ['POSITION', positionW], ['DATE', dateW]] as const) {
    txt(x, f.y, `${label}:`, 6.4, SLATE, true)
    f.rule(f.y - 2, x + s.width(`${label}:`, 6.4, true) + 4, x + width, SLATE)
    x += width + colGap
  }
  f.y -= 16
  for (const row of returnRows) { txt(LEFT, f.y, row, noteSize, SLATE); f.y -= noteSize + 1.8 }
  if (upload) {
    const y = f.y
    f.put(() => s.linkLines(LEFT, y, upload, WIDTH - 4, linkSize, INK, true))
    f.y -= linkHeight
  }
  return f
}
