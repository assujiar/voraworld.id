import { money } from '../money'
import { daysBetween } from '../dates'
import { H, INK, PALE, RED, SLATE, W, WHITE, PdfLayoutError, Sheet, withoutCurrency } from './kit'
import type { InvoiceData, Issuer, LineData, Party, QuotationData } from './types'

/**
 * Branded A4 layout, at most FIVE line items per physical page. Every page repeats the issuer/recipient context and the
 * QR footer; only the last page carries totals, bank instructions and notes. If unusually long text cannot fit, the
 * financial summary moves to an extra page. Content that cannot fit at all raises PdfLayoutError instead of being clipped.
 * The same layout serves quotations that are too long for the one-page compact layout.
 */
const L = 44
const R = W - 44
const WIDTH = R - L
const FOOTER_LIMIT = 99
export const MAX_ITEMS_PER_PAGE = 5

type Doc = ({ kind: 'invoice' } & InvoiceData) | ({ kind: 'quotation' } & QuotationData)

export async function renderPaginated(doc: Doc, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  try {
    return await compose(doc, issuer, verificationUrl, false)
  } catch (e) {
    if (e instanceof PdfLayoutError && e.message.startsWith('Payment instructions / notes do not fit')) return compose(doc, issuer, verificationUrl, true)  // only the settlement part needs an overflow sheet
    throw e
  }
}

async function compose(d: Doc, issuer: Issuer, verificationUrl: string, summaryPage: boolean): Promise<Uint8Array> {
  const isInvoice = d.kind === 'invoice'
  const items = d.items
  if (!items.length) throw new PdfLayoutError(`A${isInvoice ? 'n invoice' : ' quotation'} must contain at least one line item`)
  const party: Party = isInvoice ? d.customer : d.recipient
  const currency = d.currency
  const label = isInvoice ? 'INVOICE' : 'QUOTATION'
  const chunks: LineData[][] = []
  for (let n = 0; n < items.length; n += MAX_ITEMS_PER_PAGE) chunks.push(items.slice(n, n + MAX_ITEMS_PER_PAGE))
  const pages: LineData[][] = summaryPage ? [...chunks, []] : chunks

  const s = await Sheet.create({ title: `${label} | ${d.number}`, author: 'VORA | PT Satu Arah International', subject: isInvoice ? 'Invoice with online document verification' : 'Quotation with online document verification' })
  const qr = await s.qr(verificationUrl)

  const block = (x: number, y: number, data: string, width: number, size = 8, leading = 10.3, fill = INK, bold = false): number => {
    for (const line of s.wrap(data, width, size, bold)) { s.text(x, y, line, size, fill, bold); y -= leading }
    return y
  }
  const panelTitle = (y: number, title: string, index?: string): number => {
    s.text(L, y, title, 8.4, INK, true)
    if (index) s.right(R, y, index, 7.2, SLATE)
    s.rect(L, y - 10, 31, 2.5, RED)
    s.rule(y - 10, L + 38, R)
    return y - 26
  }

  const header = (pageNo: number, total: number) => {
    s.background({ x: W / 2 - 173, y: H / 2 - 99, w: 346, h: 198 })
    s.band(100, 4, { x: L, y: H - 69, w: 144, h: 32 })
    s.text(L, H - 84, 'Bringing the World Within Reach.', 7.05, '#DCE0E1')
    s.right(R, H - 42, isInvoice ? 'COMMERCIAL INVOICE' : 'QUOTATION', 16.8, WHITE, true)
    s.right(R, H - 63, d.number, 7.3, '#E9ECEE')
    if (d.kind === 'invoice') {
      const paidPct = d.totalMinor ? (100 * (d.totalMinor - d.outstandingMinor)) / d.totalMinor : 0
      const payment = d.outstandingMinor === 0 ? 'OFFICIALLY PAID' : paidPct > 0 ? 'PARTIALLY PAID' : 'AWAITING PAYMENT'
      const issuance = d.status === 'void' ? 'VOID' : d.status === 'draft' ? 'DRAFT' : 'ISSUED'
      s.right(R, H - 83, `${issuance} / ${payment}`, 7.0, '#E8B3AA', true)
    } else {
      s.right(R, H - 83, d.status.toUpperCase().replace(/_/g, ' '), 7.0, '#E8B3AA', true)
    }
    // Repeated verification footer on every page.
    s.footer(83, L, R)
    s.text(L, 66, 'VORA / DIGITAL DOCUMENT VERIFICATION', 7.6, INK, true)
    s.text(L, 51, 'Scan QR to check document status with VORA.', 7.1, SLATE)
    s.text(L, 36, issuer.email, 7.6, INK)
    s.text(L, 21, `DOCUMENT  /  PAGE ${String(pageNo).padStart(2, '0')} OF ${String(total).padStart(2, '0')}`, 7.3, SLATE)
    if (isInvoice) {
      // An invoice is a payment request. Proof of payment is only the receipt issued after cleared funds.
      s.text(L + 232, 66, 'PAYMENT REQUEST - NOT PROOF OF PAYMENT', 6.9, RED, true)
      s.text(L + 232, 51, 'Proof of payment is the official VORA receipt,', 6.5, SLATE)
      s.text(L + 232, 41, 'issued only after Finance confirms cleared funds.', 6.5, SLATE)
    }
    s.page.drawImage(qr, { x: R - 73, y: 8, width: 72, height: 72 })
  }

  const partiesAndMetadata = (): number => {
    let y = H - 125
    const x2 = L + 260
    const col = WIDTH / 2 - 15
    s.text(L, y, 'ISSUED BY', 7.7, RED, true)
    s.text(x2, y, isInvoice ? 'BILL TO' : 'OFFERED TO', 7.7, RED, true)
    const top = y - 18
    const draw = (x: number, name: string, address: string, contact: string, tax = ''): number => {
      let here = block(x, top, name, col, 9.25, 12, INK, true) - 2
      if (address) here = block(x, here, address, col, 7.7, 9.5, SLATE) - 1.5
      if (contact) here = block(x, here, contact, col, 7.4, 9.5, SLATE) - 1.5
      if (tax) here = block(x, here, `TAX ID: ${tax}`, col, 7.4, 9.5, SLATE)
      return here
    }
    const left = draw(L, issuer.legalName, issuer.address, issuer.email)
    const rightCol = draw(x2, party.name, party.address, party.email, party.taxId)
    y = Math.min(left, rightCol) - 8
    if (y < H - 237) throw new PdfLayoutError('Billing details are too long to display safely')
    s.rule(y, L, R)
    y -= 10
    s.roundRect(L, y - 42, WIDTH, 43, 6, PALE)
    let columns: Array<[string, string]>
    if (d.kind === 'invoice') {
      let due = 'DUE DATE'
      const terms = daysBetween(d.issuedAt, d.dueAt)
      if (Number.isFinite(terms) && terms >= 0) due = `DUE / NET ${terms} DAYS`
      columns = [['ISSUED ON', d.issuedAt], [due, d.dueAt], ['CURRENCY', d.currency], ['STATUS', d.status.toUpperCase().replace(/_/g, ' ')]]
    } else {
      columns = [['ISSUED ON', d.issuedAt], ['VALID UNTIL', d.validUntil], ['CURRENCY', d.currency], ['STATUS', d.status.toUpperCase().replace(/_/g, ' ')]]
    }
    columns.forEach(([name, value], i) => {
      const x = L + 10 + i * (WIDTH / 4)
      s.text(x, y - 13, name, 7.0, SLATE, true)
      const rows = s.wrap(value, WIDTH / 4 - 12, 8.1, true)
      if (rows.length > 1) throw new PdfLayoutError(`Invalid document metadata: ${name}`)
      s.text(x, y - 30, rows[0] ?? '', 8.1, INK, true)
    })
    y -= 57
    if (d.kind === 'invoice') {
      if (d.poNumber || d.shipmentReference) {
        let xx = L + 8
        let tall = false
        for (const [name, value] of [['PO', d.poNumber], ['SHIPMENT / JOB', d.shipmentReference]] as const) {
          if (value) {
            const rows = s.wrap(`${name}: ${value}`, WIDTH * 0.48, 7.2)
            if (rows.length > 2) throw new PdfLayoutError('PO / shipment reference is too long')
            rows.forEach((line, j) => s.text(xx, y - j * 9, line, 7.2, SLATE))
            if (rows.length > 1) tall = true
          }
          xx = L + WIDTH * 0.5
        }
        y -= tall ? 20 : 13
      }
      const route = [d.origin, d.destination].filter(Boolean).join(' -> ')
      const logistics = ([['SERVICE MODE', d.serviceMode], ['ROUTE', route], ['B/L / AWB REF', d.transportDocumentRef]] as const).filter(([, v]) => v)
      if (logistics.length) {
        for (const [name, value] of logistics) {
          const rows = s.wrap(`${name}: ${value}`, WIDTH - 16, 7.0)
          if (rows.length > 2) throw new PdfLayoutError(`${name} is too long for the document`)
          for (const line of rows) { s.text(L + 8, y, line, 7.0, SLATE); y -= 9.2 }
        }
        y -= 3
      }
    }
    return y - 6
  }

  const drawItems = (start: number, portion: LineData[], offset: number): number => {
    let y = panelTitle(start, isInvoice ? 'ITEMIZED FREIGHT & LOGISTICS CHARGES' : 'ITEMIZED SERVICES & CHARGES', `${String(items.length).padStart(2, '0')} LINE ITEMS / MAX 05 PER PAGE`)
    s.roundRect(L, y - 13, WIDTH, 27, 5, PALE)
    s.text(L + 8, y - 4, 'DESCRIPTION', 7.2, SLATE, true)
    s.right(L + 307, y - 4, 'QTY', 7.1, SLATE, true)
    s.right(L + 357, y - 4, 'UNIT', 7.1, SLATE, true)
    s.right(L + 422, y - 4, 'RATE', 7.1, SLATE, true)
    s.right(R - 7, y - 4, 'AMOUNT', 7.1, SLATE, true)
    y -= 27
    portion.forEach((item, idx) => {
      const n = offset + idx + 1
      let description = String(item.description)
      if (!/^\s*\d{1,2}\s+/.test(description)) description = `${String(n).padStart(2, '0')}  ${description}`
      const rows = s.wrap(description, 246, 8.1)
      if (rows.length > 5) throw new PdfLayoutError(`Line item ${n} description is too long; shorten it`)
      const rowH = Math.max(29, rows.length * 10 + 9)
      if (y - rowH < FOOTER_LIMIT + 18) throw new PdfLayoutError(`Line item ${n} does not fit. Shorten its description`)
      rows.forEach((line, j) => s.text(L + 8, y - 12 - j * 10.3, line, 8.1, INK))
      const field = (x: number, value: string, size: number) => {
        if (s.width(value, size) > 75) throw new PdfLayoutError(`Line item ${n} value is too wide for the price column`)
        s.right(x, y - 13, value, size, INK)
      }
      field(L + 307, item.quantity, 7.7)
      field(L + 357, item.unit, 7.6)
      field(L + 422, withoutCurrency(money(item.priceMinor, currency)), 7.5)
      field(R - 7, withoutCurrency(money(item.amountMinor, currency)), 7.5)
      y -= rowH
      s.rule(y, L, R)
    })
    return y - 16
  }

  const summary = (start: number): number => {
    let y = panelTitle(start, isInvoice ? 'PAYMENT, TAX & SETTLEMENT RECONCILIATION' : 'QUOTED TOTALS & TERMS', isInvoice ? 'FINANCIAL SUMMARY' : 'SUMMARY')
    const x2 = L + 261
    const width2 = WIDTH - 261
    let z = y
    const totals: Array<[string, number]> = d.kind === 'invoice'
      ? [['GROSS SUBTOTAL', d.subtotalMinor], ['DISCOUNT', -d.discountMinor], [`TAX (${d.taxPercent}%)`, d.taxMinor], [`WITHHOLDING (${d.withholdingPercent}%)`, -d.withholdingMinor]]
      : [['SUBTOTAL', d.subtotalMinor], [`TAX (${d.taxPercent}%)`, d.taxMinor]]
    for (const [title, amount] of totals) {
      const first = title === 'GROSS SUBTOTAL' || title === 'SUBTOTAL'
      s.text(x2 + 8, z, title, 7.8, SLATE, first)
      s.right(R - 6, z, money(amount, currency), 8, INK, first)
      z -= 15
    }
    s.roundRect(x2, z - 28, width2, 34, 7, INK)
    s.roundRect(x2, z - 28, 4, 34, 2, RED)
    s.text(x2 + 12, z - 4, 'GRAND TOTAL', 8.0, '#E9ECEE', true)
    s.right(R - 9, z - 19, money(d.totalMinor, currency), 10.2, WHITE, true)
    z -= 43
    if (d.kind === 'invoice') {
      s.text(x2 + 8, z, 'OUTSTANDING', 8, INK, true)
      s.right(R - 6, z, money(d.outstandingMinor, currency), 8.5, INK, true)
      z -= 14
    }
    let v = y
    if (d.kind === 'invoice') {
      // Bank accounts are SNAPSHOTS saved with the invoice.
      if (d.banks.length) {
        s.text(L + 3, v, 'BANK TRANSFER / PAYMENT INSTRUCTIONS', 7.2, SLATE, true)
        v -= 15
        d.banks.forEach((bank, i) => {
          for (const line of s.wrap(`${String(i + 1).padStart(2, '0')}  ${bank.bankName} / ${bank.currency}`, 251, 7.6, true)) { s.text(L + 3, v, line, 7.6, INK, true); v -= 10 }
          for (const line of s.wrap(bank.accountNumber, 251, 10.2, true)) { s.text(L + 3, v, line, 10.2, RED, true); v -= 12 }
          for (const line of s.wrap(bank.accountHolder, 251, 7.4)) { s.text(L + 3, v, line, 7.4, SLATE); v -= 9 }
          if (bank.swiftCode) { s.text(L + 3, v, `SWIFT: ${bank.swiftCode}`, 7.0, SLATE); v -= 9 }
          v -= 4
        })
      } else {
        s.text(L + 3, v, 'PAYMENT ACCOUNT', 7.7, SLATE, true)
        v -= 15
        s.text(L + 3, v, 'Not specified', 7.7, SLATE)
        v -= 12
      }
    } else {
      s.text(L + 3, v, 'VALIDITY', 7.2, SLATE, true)
      v -= 15
      s.text(L + 3, v, `Valid until ${d.validUntil}.`, 7.6, INK)
      v -= 12
    }
    let bottom = Math.min(z, v) - 12
    if (d.notes) {
      s.rule(bottom, L, R)
      bottom -= 15
      s.text(L, bottom, isInvoice ? 'COMMERCIAL NOTES / TERMS' : 'TERMS & NOTES', 7.9, RED, true)
      bottom -= 15
      bottom = block(L, bottom, d.notes, WIDTH - 2, 7.5, 9.8, SLATE) - 5
    }
    if (d.kind === 'quotation') {
      bottom -= 6
      s.text(L, bottom, 'APPROVED BY CUSTOMER', 7.9, RED, true)
      s.rule(bottom - 6, L, R)
      s.text(L + 6, bottom - 22, 'AUTHORIZED SIGNATURE', 6.8, SLATE, true)
      s.text(L + WIDTH / 2 + 8, bottom - 22, 'COMPANY STAMP', 6.8, SLATE, true)
      s.rule(bottom - 62, L + 6, L + WIDTH / 2 - 18, '#DCE0E1')
      s.rule(bottom - 62, L + WIDTH / 2 + 8, R - 5, '#DCE0E1')
      bottom -= 70
    }
    if (bottom < FOOTER_LIMIT + 12) throw new PdfLayoutError('Payment instructions / notes do not fit with the current items')
    return bottom
  }

  pages.forEach((portion, pi) => {
    if (pi > 0) s.newPage()
    header(pi + 1, pages.length)
    let y = partiesAndMetadata()
    if (portion.length) y = drawItems(y, portion, pi * MAX_ITEMS_PER_PAGE)
    else y = panelTitle(y, 'PAYMENT SUMMARY / CONTINUATION')
    if (pi === pages.length - 1) summary(y)
    else {
      s.text(L, y - 6, 'CONTINUED  /  PLEASE SEE NEXT PAGE', 7.6, RED, true)
      s.right(R, y - 6, `${Math.min((pi + 1) * MAX_ITEMS_PER_PAGE, items.length)} / ${items.length} ITEMS`, 7.5, SLATE)
    }
  })
  return s.save()
}
