import { amountInWords, money } from '../money'
import { BAND_H, H, INK, PALE, RED, SLATE, W, WHITE, PdfLayoutError, Sheet } from './kit'
import type { Issuer, ReceiptData } from './types'

/**
 * One-page payment receipt driven by CONFIRMED ledger data. It never invents a bank reference, amount, receiving bank or
 * signer. Receipts that need an e-meterai stay a draft until the stamped file is uploaded (see receipts.ts).
 */
const L = 44
const R = W - 44
const WIDTH = R - L
/** The header band is taller than it was (it now carries the address and NPWP under the logo): everything below moves down with it. */
const SHIFT = BAND_H - 102

export async function renderReceipt(r: ReceiptData, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  const { invoice, payment, payer } = r
  const confirmedTotal = invoice.totalMinor - invoice.outstandingMinor
  if (confirmedTotal < 0 || confirmedTotal > invoice.totalMinor) throw new PdfLayoutError('Invoice payment reconciliation is inconsistent')
  const cur = invoice.currency
  const settlement = invoice.outstandingMinor ? 'PARTIALLY PAID' : 'OFFICIALLY PAID'
  const state = r.status === 'pending_stamp' ? 'PENDING E-METERAI' : r.status.toUpperCase().replace(/_/g, ' ')
  const bank = payment.bank ?? {}

  const s = await Sheet.create({ title: `VORA PAYMENT RECEIPT | ${r.number}`, author: issuer.legalName, subject: 'Cleared payment record with online document verification' })
  const lines = (x: number, y: number, content: string, width: number, size = 7.5, leading = 10, fill = INK, bold = false, maxRows = 4): number => {
    const rows = s.wrap(content, width, size, bold)
    if (rows.length > maxRows) throw new PdfLayoutError('A receipt field is too long for one A4 page')
    for (const row of rows) { if (row) s.text(x, y, row, size, fill, bold); y -= leading }
    return y
  }
  const title = (y: number, heading: string): number => {
    s.text(L, y, heading, 8.3, INK, true)
    s.rect(L, y - 10, 30, 2.5, RED)
    s.rule(y - 10, L, R)
    return y - 26
  }
  const detail = (y: number, label: string, value: string): number => {
    s.text(L + 4, y, label, 7.2, SLATE, true)
    return lines(L + 4, y - 13, value, WIDTH - 8, 7.7, 10.4, INK, false, 3) - 4
  }

  s.background({ x: W / 2 - 151, y: H / 2 - 98, w: 302, h: 172 })
  s.header({ x: L, logoWidth: 144, info: { address: issuer.address, taxId: issuer.taxId } })
  s.right(R, H - 47, 'OFFICIAL PAYMENT RECEIPT', 15, WHITE, true)
  s.right(R, H - 68, r.number, 7, '#E9ECEE')
  s.right(R, H - 88, state, 7.5, '#E8B3AA', true)

  let y = H - 130 - SHIFT
  const x2 = L + 268
  const col = WIDTH / 2 - 16
  s.text(L, y, 'RECEIVED FROM / PAYER', 8.0, RED, true)
  s.text(x2, y, 'ISSUED BY / LEGAL ENTITY', 8.0, RED, true)
  const cy = y - 17
  let p1 = lines(L, cy, payer.name, col, 8.8, 11, INK, true, 2)
  p1 = lines(L, p1, payer.address, col, 7.4, 9.8, SLATE, false, 4)
  p1 = lines(L, p1, payer.email, col, 7.3, 9.5, SLATE, false, 2)
  let p2 = lines(x2, cy, issuer.legalName, col, 8.5, 11, INK, true, 2)
  p2 = lines(x2, p2, issuer.address, col, 7.2, 9.4, SLATE, false, 5)
  p2 = lines(x2, p2, issuer.email, col, 7.2, 9.5, SLATE, false, 2)
  if (issuer.taxId) p2 = lines(x2, p2, `NPWP: ${issuer.taxId}`, col, 7.2, 9.5, SLATE, false, 1)
  y = Math.min(p1, p2) - 8
  if (y < H - 264 - SHIFT) throw new PdfLayoutError('Payer/issuer address information is too long')

  y = title(y, 'RECEIPT & TREASURY PAYMENT REFERENCE')
  const refs: Array<[string, string]> = [
    ['RECEIPT ISSUED', r.issuedOn], ['PAYMENT DATE', payment.date], ['PAYMENT METHOD', payment.method || 'Not specified'],
    ['BANK TRANSACTION REF', payment.reference || 'Not provided'], ['PAYMENT RECORD', `Payment #${payment.id}`], ['INVOICE REFERENCE', invoice.number],
  ]
  let maxHeight = 0
  refs.forEach(([label, value], idx) => {
    const xi = L + 4 + (idx % 2) * 268
    const yy = y - Math.floor(idx / 2) * 31
    s.text(xi, yy, label, 7.1, SLATE, true)
    const rows = s.wrap(value, 245, 7.4)
    if (rows.length > 2) throw new PdfLayoutError(`${label} is too long`)
    rows.forEach((line, i) => s.text(xi, yy - 12 - i * 9.5, line, 7.4, INK))
    maxHeight = Math.max(maxHeight, Math.floor(idx / 2) * 31 + 12 + rows.length * 9.5)
  })
  y -= maxHeight + 10

  y = title(y, 'PAYMENT ALLOCATION & INVOICE BALANCE RECONCILIATION')
  s.roundRect(L, y - 20, WIDTH, 29, 5, PALE)
  s.text(L + 7, y - 2, 'INVOICE TOTAL', 7.0, SLATE, true)
  s.text(L + 145, y - 2, 'THIS PAYMENT', 7.0, SLATE, true)
  s.text(L + 302, y - 2, 'TOTAL CONFIRMED', 7.0, SLATE, true)
  s.right(R - 3, y - 2, 'BALANCE DUE', 7.0, SLATE, true)
  s.text(L + 7, y - 15, money(invoice.totalMinor, cur), 8.1, INK, true)
  s.text(L + 145, y - 15, money(payment.amountMinor, cur), 8.1, INK, true)
  s.text(L + 302, y - 15, money(confirmedTotal, cur), 8.1, INK, true)
  s.right(R - 3, y - 15, money(invoice.outstandingMinor, cur), 8.2, INK, true)
  y -= 43
  s.text(L + 5, y, `LINKED INVOICE: ${invoice.number}`, 7.3, SLATE)
  y -= 19

  y = title(y, 'CONFIRMED SETTLEMENT & PAYMENT STATUS')
  s.roundRect(L, y - 50, WIDTH, 58, 7, INK)
  s.text(L + 14, y - 10, 'CONFIRMED AMOUNT RECEIVED', 8.5, '#E8B3AA', true)
  s.text(L + 14, y - 36, money(payment.amountMinor, cur), 17, WHITE, true)
  y -= 66
  const words = amountInWords(payment.amountMinor, cur)
  if (words) y = detail(y, 'AMOUNT RECEIVED IN WORDS', words)
  y = detail(y, 'CURRENT INVOICE PAYMENT STATUS', `${settlement}  |  Balance due: ${money(invoice.outstandingMinor, cur)}`)
  let note = `Payment recorded as confirmed; ${payment.confirmedBy || 'reviewer not specified'}`
  if (payment.confirmedAt) note += ` on ${payment.confirmedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  y = detail(y, 'FINANCE CONFIRMATION / AUDIT TRACE', note)
  if (Object.keys(bank).length) y = detail(y, 'CREDITED COMPANY BANK ACCOUNT', [bank.bank_name ?? '', bank.account_number ?? '', bank.account_holder ?? ''].join(' / '))
  if (r.stampRequired && r.status === 'pending_stamp') y = detail(y, 'DOCUMENT RELEASE CONTROL', 'Manual official e-meterai application pending; document not released.')
  if (y < 117) throw new PdfLayoutError('Receipt contents exceed the reserved A4 layout')

  s.footer(99, L, R)
  const mark = s.verificationMark({ url: verificationUrl, lang: 'en', right: R, bottom: 10 })
  const column = mark.left - 12 - L
  s.text(L, 86, 'VORA | DOCUMENT AUTHENTICITY VERIFICATION', 7.8, INK, true)
  s.text(L, 75, 'Scan the QR, or click this link, to check this receipt and its current status:', 6.4, SLATE)
  s.linkLines(L, 66, verificationUrl, column, 5.9, INK)
  s.text(L, 49, 'Issued after VORA Finance confirmed cleared funds.', 6.9, SLATE)
  s.text(L, 36, issuer.email, 7.2, INK)
  s.text(L, 22, 'RECEIPT | PAGE 01 OF 01', 7.0, SLATE)
  return s.save()
}
