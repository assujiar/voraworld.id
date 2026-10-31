import { STAMP_LIMIT_IDR } from '../finance/pdf-inspect'
import { amountInWords, money } from '../money'
import { BAND_H, H, INK, PALE, RED, SLATE, W, WHITE, PdfLayoutError, Sheet } from './kit'
import type { Issuer, PrepaymentData } from './types'

/**
 * One-page pre-payment receipt, written in English. It is issued with the invoice, before any money arrives, for customers whose finance
 * team needs a receipt (with an e-meterai above IDR 5,000,000) to release the payment. It says in so many words that it is not proof of
 * payment; the official payment receipt (receipt.ts) follows once Finance has confirmed cleared funds.
 */
const L = 44
const R = W - 44
const WIDTH = R - L
const SHIFT = BAND_H - 102
const SHOWN_BANKS = 3
/** The amount box, the first baseline of the amount in words below it, and the e-meterai square: as tall as both together (about 2.8 cm). */
const AMOUNT_H = 50
const WORDS_TEXT = 27
const SQUARE = AMOUNT_H + 30

const STATES: Record<string, string> = { draft: 'DRAFT', pending_stamp: 'PENDING E-METERAI', issued: 'ISSUED', void: 'VOID' }

export async function renderPrepayment(d: PrepaymentData, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  const { invoice, payer } = d
  const cur = d.currency
  const stampLimit = money(STAMP_LIMIT_IDR, 'IDR')
  const s = await Sheet.create({ title: `VORA PRE-PAYMENT RECEIPT | ${d.number}`, author: issuer.legalName, subject: 'Pre-payment receipt issued with an invoice; not proof of payment' })
  const lines = (x: number, y: number, content: string, width: number, size = 7.5, leading = 10, fill = INK, bold = false, maxRows = 4): number => {
    const rows = s.wrap(content, width, size, bold)
    if (rows.length > maxRows) throw new PdfLayoutError('A pre-payment receipt field is too long for one A4 page')
    for (const row of rows) { if (row) s.text(x, y, row, size, fill, bold); y -= leading }
    return y
  }
  const title = (y: number, heading: string): number => {
    s.text(L, y, heading, 8.3, INK, true)
    s.rect(L, y - 10, 30, 2.5, RED)
    s.rule(y - 10, L, R)
    return y - 24
  }

  s.background({ x: W / 2 - 151, y: H / 2 - 98, w: 302, h: 172 })
  s.header({ x: L, logoWidth: 144, info: { address: issuer.address, taxId: issuer.taxId } })
  s.right(R, H - 47, 'PRE-PAYMENT RECEIPT', 15, WHITE, true)
  s.right(R, H - 68, d.number, 7, '#E9ECEE')
  s.right(R, H - 88, STATES[d.status] ?? d.status.toUpperCase().replace(/_/g, ' '), 7.5, '#E8B3AA', true)

  let y = H - 130 - SHIFT
  const x2 = L + 268
  const col = WIDTH / 2 - 16
  s.text(L, y, 'TO BE RECEIVED FROM / PAYER', 8.0, RED, true)
  s.text(x2, y, 'ISSUED BY / LEGAL ENTITY', 8.0, RED, true)
  const cy = y - 17
  let p1 = lines(L, cy, payer.name, col, 8.8, 11, INK, true, 4)
  p1 = lines(L, p1, payer.address, col, 7.4, 9.8, SLATE, false, 4)
  p1 = lines(L, p1, payer.email, col, 7.3, 9.5, SLATE, false, 2)
  if (payer.taxId) p1 = lines(L, p1, `NPWP: ${payer.taxId}`, col, 7.3, 9.5, SLATE, false, 1)
  let p2 = lines(x2, cy, issuer.legalName, col, 8.5, 11, INK, true, 2)
  p2 = lines(x2, p2, issuer.address, col, 7.2, 9.4, SLATE, false, 5)
  p2 = lines(x2, p2, issuer.email, col, 7.2, 9.5, SLATE, false, 2)
  if (issuer.taxId) p2 = lines(x2, p2, `NPWP: ${issuer.taxId}`, col, 7.2, 9.5, SLATE, false, 1)
  y = Math.min(p1, p2) - 14
  if (y < H - 264 - SHIFT) throw new PdfLayoutError('Payer/issuer address information is too long')

  y = title(y, 'INVOICE THIS RECEIPT BELONGS TO')
  const refs: Array<[string, string]> = [
    ['INVOICE REFERENCE', invoice.number], ['INVOICE DATE', invoice.issuedAt], ['PAYMENT DUE DATE', invoice.dueAt],
    ['CURRENCY', cur], ['PURCHASE ORDER', invoice.poNumber || 'Not provided'], ['SHIPMENT / JOB REFERENCE', invoice.shipmentReference || 'Not provided'],
  ]
  let maxHeight = 0
  refs.forEach(([label, value], idx) => {
    const xi = L + 4 + (idx % 2) * 268
    const yy = y - Math.floor(idx / 2) * 28
    s.text(xi, yy, label, 7.1, SLATE, true)
    const rows = s.wrap(value, 245, 7.4)
    if (rows.length > 2) throw new PdfLayoutError(`${label} is too long`)
    rows.forEach((line, i) => s.text(xi, yy - 12 - i * 9.5, line, 7.4, INK))
    maxHeight = Math.max(maxHeight, Math.floor(idx / 2) * 28 + 12 + rows.length * 9.5)
  })
  y -= maxHeight + 16

  y = title(y, 'AMOUNT TO BE RECEIVED')
  // The amount block is the amount box with the amount in words under it, AMOUNT_H + WORDS_H tall. The e-meterai is a square exactly that
  // tall, level with the block, at its right; the amount box gives up that width. Without an e-meterai the amount box keeps the full width.
  const words = amountInWords(d.amountMinor, cur)
  const boxW = d.stampRequired ? WIDTH - SQUARE - 14 : WIDTH
  const top = y + 8
  // With no words under it (an amount too large to write out) the amount box itself fills the height of the block.
  const amountH = words || !d.stampRequired ? AMOUNT_H : SQUARE
  const inset = (amountH - AMOUNT_H) / 2
  s.roundRect(L, top - amountH, boxW, amountH, 7, INK)
  s.text(L + 14, top - 16 - inset, 'AMOUNT PAYABLE FOR THE INVOICE', 8.0, '#E8B3AA', true)
  s.text(L + 14, top - 38 - inset, money(d.amountMinor, cur), 16, WHITE, true)
  y = top - amountH - 10
  if (words) {
    s.text(L + 4, top - AMOUNT_H - 15, 'AMOUNT IN WORDS', 7.2, SLATE, true)
    y = lines(L + 4, top - AMOUNT_H - WORDS_TEXT, words, boxW - 8, 7.7, 10.4, INK, false, 3) - 4
  }
  if (d.stampRequired) {
    const boxX = R - SQUARE
    s.outline(boxX, top - SQUARE, SQUARE, SQUARE, SLATE, 0.8, [3, 2])                   // dashed: "the e-meterai goes here"
    const hint = 'E-METERAI HERE'
    s.text(boxX + (SQUARE - s.width(hint, 6.6, true)) / 2, top - SQUARE / 2 - 2, hint, 6.6, '#AEB6BA', true)
    y = Math.min(y, top - SQUARE - 6)
  }

  y = title(y - 10, 'ACKNOWLEDGEMENT')
  const statement = `${issuer.legalName} (VORA) acknowledges that it will receive the amount above from ${payer.name} as payment of invoice ${invoice.number}. `
    + 'This pre-payment receipt is issued in advance, together with the invoice, for the payer\'s internal payment and accounting process. '
    + 'It is NOT proof that payment has been made. Payment is proven only by the official VORA payment receipt, which VORA issues after the funds have been '
    + 'credited to its bank account and confirmed by VORA Finance.'
  y = lines(L + 4, y, statement, WIDTH - 8, 7.6, 10.6, INK, false, 8) - 12

  y = title(y, 'PAYMENT ACCOUNT')
  if (d.banks.length) {
    for (const b of d.banks.slice(0, SHOWN_BANKS)) {
      y = lines(L + 4, y, [b.bankName, b.accountNumber, b.accountHolder, b.swiftCode && `SWIFT ${b.swiftCode}`].filter(Boolean).join(' / '), WIDTH - 8, 7.6, 10.4, INK, false, 2)
    }
    if (d.banks.length > SHOWN_BANKS) y = lines(L + 4, y, `${d.banks.length - SHOWN_BANKS} more account(s) are listed on the invoice.`, WIDTH - 8, 7.2, 10, SLATE, false, 1)
  } else {
    y = lines(L + 4, y, 'No payment account was selected for the invoice. Please ask VORA for the payment details.', WIDTH - 8, 7.6, 10.4, SLATE, false, 3)
  }
  const duty = d.stampRequired
    ? `An e-meterai is required on this document because the amount ${cur === 'IDR' ? `is above ${stampLimit}` : 'is in a foreign currency'}.${d.status === 'issued' ? '' : ' It is applied manually, in the box beside the amount, before the document is released.'}`
    : `No e-meterai is required: the amount does not exceed ${stampLimit}.`
  y = lines(L + 4, y - 6, duty, WIDTH - 8, 7.0, 9.4, SLATE, false, 3)
  if (y < 117) throw new PdfLayoutError('Pre-payment receipt contents exceed the reserved A4 layout')

  s.footer(99, L, R)
  const mark = s.verificationMark({ url: verificationUrl, lang: 'en', right: R, bottom: 10 })
  s.text(L, 86, 'VORA / DOCUMENT AUTHENTICITY VERIFICATION', 7.8, INK, true)
  s.text(L, 75, 'Scan the QR, or click this link, to check this document and its current status:', 6.4, SLATE)
  s.linkLines(L, 66, verificationUrl, mark.left - 12 - L, 5.9, INK)
  s.text(L, 49, 'Not proof of payment: see the official VORA payment receipt.', 6.9, SLATE)
  s.text(L, 36, issuer.email, 7.2, INK)
  s.text(L, 22, 'PRE-PAYMENT RECEIPT / PAGE 01 OF 01', 7.0, SLATE)
  return s.save()
}
