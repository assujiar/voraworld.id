import { Flow } from './flow'
import { BAND_H, H, INK, PALE, RED, SLATE, TAGLINE, W, WHITE, PdfLayoutError, Sheet } from './kit'
import type { DeliveryNoteData, Issuer, PodData } from './types'

/**
 * The delivery note (surat jalan): who the goods are for, how they travel, what they are, and the QR code that the DRIVER or COURIER
 * scans at the handover to record the delivery on their own phone (the receiver signs on that screen). English first, Indonesian under it.
 * No handwriting is asked for. Items flow over as many pages as they need; the QR block is never split.
 */
export const LEFT = 44
export const RIGHT = W - 44
export const WIDTH = RIGHT - LEFT
export const FOOTER_TOP = 86
export const LIMIT = FOOTER_TOP + 14
export const TOP = H - BAND_H - 28
const SIZE = 8.2
const LEADING = 10.6

export type Row = { label: string; id?: string; value: string }

export interface FrameOptions { title: string; subtitle: string; number: string; status: string; issuer: Issuer; label: string; verifyUrl: string; verifyLabel: string; evidenceUrl?: string; issuedOn: string }

/** What every page carries: the letterhead, the title, the state (a draft or void document is marked across the page) and the footer. */
export function frame(s: Sheet, o: FrameOptions) {
  return (pageNo: number, total: number) => {
    s.background({ x: W / 2 - 168, y: H / 2 - 101, w: 336, h: 202 })
    if (o.status === 'draft') s.stampWord('DRAFT')
    if (o.status === 'void') s.stampWord('VOID')
    s.header({ x: LEFT, logoWidth: 144, info: { address: o.issuer.address, taxId: o.issuer.taxId } })
    s.right(RIGHT, H - 44, o.title, 16, WHITE, true)
    s.right(RIGHT, H - 60, o.subtitle, 7.4, '#C9D0D4')
    s.right(RIGHT, H - 76, o.number, 6.8, WHITE)
    if (!['issued', 'delivered', 'received'].includes(o.status)) s.right(RIGHT, H - 92, o.status.toUpperCase(), 7, '#E8B3AA', true)
    s.pageEdge()
    s.verificationFooter({
      left: LEFT, right: RIGHT, top: FOOTER_TOP - 3, bottom: 9, url: o.verifyUrl, number: o.number, issuedOn: o.issuedOn, issuer: { address: o.issuer.address, taxId: o.issuer.taxId, email: o.issuer.email }, tagline: TAGLINE,
      heading: 'VORA | DELIVERY', instruction: `${o.verifyLabel} (the QR code or this link; not the driver's code):`,
      extraLinks: o.evidenceUrl ? [{ label: 'Evidence page of the delivery (receiver and VORA only):', url: o.evidenceUrl }] : undefined,
      pageLine: `${o.label}  |  PAGE ${pageNo} OF ${total}`,
    })
  }
}

/** Paragraph-aware text that moves to the next page rather than being cut. */
export function writer(s: Sheet, f: Flow) {
  return (content: string, o: { x?: number; width?: number; size?: number; leading?: number; bold?: boolean; fill?: string } = {}) => {
    const x = o.x ?? LEFT, width = o.width ?? WIDTH, size = o.size ?? SIZE, leading = o.leading ?? LEADING
    for (const row of s.wrap(content, width, size, o.bold)) {
      f.keep(leading)
      if (row) f.text(x, f.y, row, size, o.fill ?? INK, o.bold)
      f.y -= leading
    }
  }
}

const caption = (f: Flow, text: string, x = LEFT) => f.text(x, f.y, text, 7.2, RED, true)

/** The lines a party block needs at a width: its height is known before anything is drawn, so a long address moves the whole block to the next page instead of running into the footer. */
function partyLines(s: Sheet, width: number, p: { name: string; address: string; contact: string; phone: string; email: string }): number {
  const contact = [p.contact, p.phone].filter(Boolean).join(' / ')
  return s.wrap(p.name || '-', width, 9.2, true).length * 11.6 + s.wrap(p.address || '', width, SIZE).length * LEADING
    + (contact ? s.wrap(contact, width, SIZE).length * LEADING : 0) + (p.email ? s.wrap(p.email, width, SIZE).length * LEADING : 0)
}

/** One party: its name, complete address, contact person and phone, email. Returns the y below it. */
function party(s: Sheet, f: Flow, x: number, top: number, width: number, p: { name: string; address: string; contact: string; phone: string; email: string }, recorded: boolean): number {
  if (!recorded) {
    const y = f.lines(x, top, 'Not recorded on this delivery note', width, SIZE, SLATE, false, LEADING)
    return y
  }
  let y = f.lines(x, top, p.name, width, 9.2, INK, true, 11.6)
  y = f.lines(x, y, p.address, width, SIZE, SLATE, false, LEADING)
  const contact = [p.contact, p.phone].filter(Boolean).join(' / ')
  if (contact) y = f.lines(x, y, contact, width, SIZE, INK, false, LEADING)
  if (p.email) y = f.lines(x, y, p.email, width, SIZE, SLATE, false, LEADING)
  return y
}

/**
 * The two parties of the shipment side by side (SHIPPER / PENGIRIM and CONSIGNEE / PENERIMA), then the shipment details and the commercial references
 * below them. The customer who pays is a reference, not a party; the shipper is whoever hands the cargo over, written for each shipment.
 */
export function shipmentBlock(s: Sheet, f: Flow, d: Omit<DeliveryNoteData, 'captureUrl' | 'items'>): void {
  const gap = 18
  const colW = (WIDTH - gap) / 2
  const x2 = LEFT + colW + gap
  const shipper = { name: d.shipperName, address: d.shipperAddress, contact: d.shipperContact, phone: d.shipperPhone, email: d.shipperEmail }
  const consignee = { name: d.consigneeName, address: d.consigneeAddress, contact: d.consigneeContact, phone: d.consigneePhone, email: d.consigneeEmail }
  const recorded = Boolean(d.shipperName)
  f.keep(22 + Math.max(recorded ? partyLines(s, colW, shipper) : LEADING, partyLines(s, colW, consignee)) + 6)
  caption(f, 'SHIPPER / PENGIRIM')
  f.text(x2, f.y, 'CONSIGNEE / PENERIMA', 7.2, RED, true)
  f.y -= 15
  const top = f.y
  const left = party(s, f, LEFT, top, colW, shipper, recorded)
  const right = party(s, f, x2, top, colW, consignee, true)
  f.y = Math.min(left, right) - 4
  f.rule(f.y)
  f.y -= 16

  const refs: Row[] = [
    { label: 'Date', id: 'Tanggal', value: d.deliveryDate }, { label: 'Customer', id: 'Pelanggan', value: d.customerName }, { label: 'Quotation', id: 'Penawaran', value: d.quotationNumber },
    { label: 'Reference', id: 'Referensi', value: d.shipmentReference }, { label: 'PO number', id: 'No. PO', value: d.poNumber },
    { label: 'From', id: 'Asal', value: d.origin }, { label: 'To', id: 'Tujuan', value: d.destination }, { label: 'Carrier', id: 'Pengangkut', value: d.carrier },
    { label: 'Vehicle', id: 'Kendaraan', value: [d.vehicle, d.vehiclePlate].filter(Boolean).join(' / ') }, { label: 'Driver', id: 'Pengemudi', value: [d.driverName, d.driverPhone].filter(Boolean).join(' / ') },
  ].filter((r) => r.value)
  const heights = (rows: Row[]) => rows.reduce((n, r) => n + Math.max(s.wrap(r.value, colW - 84, SIZE, true).length * LEADING, 17), 0)
  // Two columns of details, split so that both are about as tall.
  const half = Math.ceil(refs.length / 2)
  const columns = [refs.slice(0, half), refs.slice(half)]
  f.keep(Math.max(heights(columns[0]), heights(columns[1])) + 30)
  f.text(LEFT, f.y, 'SHIPMENT DETAILS / RINCIAN PENGIRIMAN', 7.2, RED, true)
  f.y -= 15
  const start = f.y
  let lowest = start
  columns.forEach((rows, c) => {
    let y = start
    const x = c === 0 ? LEFT : x2
    for (const r of rows) {
      const lines = s.wrap(r.value, colW - 84, SIZE, true)
      f.text(x, y, r.label, 7.2, SLATE)
      f.text(x, y - 7.4, r.id ?? '', 5.6, '#98A3AB')
      lines.forEach((line, i) => f.text(x + 84, y - i * LEADING, line, SIZE, INK, true))
      y -= Math.max(lines.length * LEADING, 17)
    }
    lowest = Math.min(lowest, y)
  })
  f.y = lowest - 6
  f.rule(f.y)
  f.y -= 16
}

/** The items table; its header is repeated on every page it continues onto. */
export function itemsTable(s: Sheet, f: Flow, items: DeliveryNoteData['items'], withRemarks = true): void {
  const head = (continued: boolean) => {
    f.text(LEFT, f.y, continued ? 'ITEMS / BARANG (CONTINUED)' : 'ITEMS / BARANG', 7.2, RED, true)
    f.rule(f.y - 5)
    f.y -= 16
    f.roundRect(LEFT, f.y - 9, WIDTH, 19, 4, PALE)
    f.text(LEFT + 6, f.y - 3, 'NO', 6.6, SLATE, true)
    f.text(LEFT + 30, f.y - 3, 'DESCRIPTION / URAIAN', 6.6, SLATE, true)
    f.right(LEFT + 308, f.y - 3, 'QTY / JUMLAH', 6.6, SLATE, true)
    f.text(LEFT + 316, f.y - 3, 'UNIT', 6.6, SLATE, true)
    if (withRemarks) f.text(LEFT + 364, f.y - 3, 'REMARKS / KET.', 6.6, SLATE, true)
    f.y -= 22
  }
  head(false)
  items.forEach((item, i) => {
    const description = s.wrap(item.description, 232, SIZE)
    const remarks = withRemarks ? s.wrap(item.remarks, 138, SIZE - 0.6) : []
    const rows = Math.max(description.length, remarks.length, 1)
    if (f.keep(rows * LEADING + 8)) head(true)
    f.text(LEFT + 6, f.y, String(i + 1), SIZE, SLATE)
    description.forEach((line, k) => f.text(LEFT + 30, f.y - k * LEADING, line, SIZE))
    f.right(LEFT + 308, f.y, item.quantity.length > 14 ? item.quantity.slice(0, 13) + '…' : item.quantity, SIZE, INK, true)
    f.text(LEFT + 316, f.y, item.unit, SIZE)
    remarks.forEach((line, k) => f.text(LEFT + 364, f.y - k * LEADING, line, SIZE - 0.6, SLATE))
    f.rule(f.y - rows * LEADING + 4, LEFT, RIGHT)
    f.y -= rows * LEADING + 7
  })
  f.y -= 4
}

export async function renderDeliveryNote(d: DeliveryNoteData, issuer: Issuer): Promise<Uint8Array> {
  const s = await Sheet.create({ title: `VORA DELIVERY NOTE | ${d.number}`, author: issuer.legalName, subject: 'Delivery note with a QR code for the receiver to confirm receipt' })
  const qr = await s.qr(d.captureUrl)
  const f = new Flow(s, { top: TOP, limit: LIMIT, left: LEFT, right: RIGHT })
  const write = writer(s, f)

  shipmentBlock(s, f, d)
  itemsTable(s, f, d.items)
  if (d.notes) {
    f.keep(40)
    f.text(LEFT, f.y, 'NOTES / CATATAN', 7.2, RED, true)
    f.y -= 14
    d.notes.split('\n').forEach((line) => (line.trim() ? write(line, { size: SIZE }) : (f.y -= LEADING / 2)))
    f.y -= 6
  }

  // The driver's block: the QR code is how the driver reaches the page that records the delivery. Never split from its instructions.
  const BOX = 162
  f.keep(BOX + 10)
  const top = f.y + 4
  f.outline(LEFT, top - BOX, WIDTH, BOX, '#DCE0E1', 0.8)
  const qrSize = 112
  f.put(() => s.page.drawImage(qr, { x: LEFT + 14, y: top - 14 - qrSize, width: qrSize, height: qrSize }))
  const x = LEFT + 14 + qrSize + 20
  const w = RIGHT - x - 12
  let y = top - 22
  f.text(x, y, 'DRIVER / COURIER: SCAN TO RECORD DELIVERY', 9.2, INK, true); y -= 11
  f.text(x, y, 'Pengantar: pindai untuk mencatat pengiriman', 7.4, SLATE); y -= 17
  const steps: Array<[string, string]> = [
    ['1. Hand the goods over; the receiver checks them against this note.', 'Serahkan barang; penerima memeriksanya sesuai surat jalan ini.'],
    ['2. Scan the QR code with your phone camera.', 'Pindai kode QR dengan kamera ponsel Anda.'],
    ['3. Enter the receiver\'s name, have them sign on the screen and photograph the goods.', 'Isi nama penerima, minta tanda tangan di layar, dan foto barang.'],
  ]
  for (const [en, id] of steps) {
    for (const row of s.wrap(en, w, 7.8)) { f.text(x, y, row, 7.8, INK); y -= 10 }
    for (const row of s.wrap(id, w, 6.6)) { f.text(x, y, row, 6.6, SLATE); y -= 8.6 }
    y -= 3
  }
  f.text(x, y - 2, 'Turn on your phone location: time and location are recorded.', 7.2, INK, true)
  f.text(x, y - 11, 'Aktifkan lokasi ponsel: waktu dan lokasi terekam.', 6.4, SLATE)
  const linkTop = top - 14 - qrSize - 10
  // The address printed under the QR code stays in the QR column: the instructions are on its right.
  if (s.linkHeight(d.captureUrl, qrSize + 16, 5.6) > 42) throw new PdfLayoutError('The delivery link is too long to print')
  f.put(() => s.linkLines(LEFT + 14, linkTop, d.captureUrl, qrSize + 16, 5.6, INK))
  f.y = top - BOX - 8

  f.draw(frame(s, { title: 'DELIVERY NOTE', subtitle: 'SURAT JALAN', number: d.number, status: d.status, issuer, label: 'DELIVERY NOTE', verifyUrl: d.verifyUrl, verifyLabel: 'Check this delivery note online', issuedOn: d.deliveryDate }))
  return s.save()
}

const CONDITION_LABEL: Record<string, string> = { good: 'Good / Baik', damaged: 'Damaged / Rusak', partial: 'Partial / Sebagian' }

/** One label/value line of the receipt block, the value wrapped to the width. */
function fact(s: Sheet, f: Flow, x: number, width: number, label: string, value: string): void {
  if (!value) return
  const rows = s.wrap(value, width - 96, SIZE, true)
  f.keep(Math.max(rows.length * LEADING, 12) + 2)
  f.text(x, f.y, label, 7.2, SLATE)
  rows.forEach((row, i) => f.text(x + 96, f.y - i * LEADING, row, SIZE, INK, true))
  f.y -= Math.max(rows.length * LEADING, 12) + 2
}

/**
 * The proof of delivery: the delivery note's own details, then what the receiver gave (name, position, condition, the time recorded by
 * the server and the phone, the position when it was shared), their signature and the photos, each with the SHA-256 of the stored file
 * so a copy of this document can be checked against the evidence. The footer carries the address of the online proof.
 */
export async function renderPod(d: PodData, issuer: Issuer): Promise<Uint8Array> {
  const s = await Sheet.create({ title: `VORA PROOF OF DELIVERY | ${d.number}`, author: issuer.legalName, subject: 'Proof of delivery: signature, photos, time and location of receipt' })
  const f = new Flow(s, { top: TOP, limit: LIMIT, left: LEFT, right: RIGHT })
  const p = d.proof

  shipmentBlock(s, f, d)
  itemsTable(s, f, d.items)

  f.keep(150)
  f.text(LEFT, f.y, 'DELIVERY AND RECEIPT / PENGIRIMAN DAN PENERIMAAN', 7.2, RED, true)
  f.rule(f.y - 5)
  f.y -= 18
  fact(s, f, LEFT, WIDTH, 'Delivered by', [p.courierName, p.courierPhone].filter(Boolean).join(' / '))
  fact(s, f, LEFT, WIDTH, 'Received by', p.receiverName)
  fact(s, f, LEFT, WIDTH, 'Position', p.receiverPosition)
  fact(s, f, LEFT, WIDTH, 'Phone', p.receiverPhone)
  fact(s, f, LEFT, WIDTH, 'Email', p.receiverEmail)
  fact(s, f, LEFT, WIDTH, 'ID number', p.receiverIdNumber)
  fact(s, f, LEFT, WIDTH, 'Condition', CONDITION_LABEL[p.condition] ?? p.condition)
  fact(s, f, LEFT, WIDTH, 'Condition note', p.conditionNote)
  fact(s, f, LEFT, WIDTH, 'Received at', p.receivedAt)
  fact(s, f, LEFT, WIDTH, 'Phone clock', p.deviceTime)
  if (p.locationStatus === 'captured' && p.latitude !== null && p.longitude !== null) {
    fact(s, f, LEFT, WIDTH, 'Location', `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}${p.accuracyM !== null ? ` (accuracy ${Math.round(p.accuracyM)} m)` : ''}`)
  } else {
    fact(s, f, LEFT, WIDTH, 'Location', `Not shared by the driver${p.locationNote ? `: ${p.locationNote}` : ''}`)
  }
  if (p.status === 'rejected') fact(s, f, LEFT, WIDTH, 'Status', 'REJECTED by VORA Finance')
  f.y -= 6

  // Signature, then the photos two to a row. An image is never split from its caption.
  const signature = await s.doc.embedPng(p.signature)
  const sw = Math.min(220, signature.width), sh = Math.min(90, (sw / signature.width) * signature.height)
  f.keep(sh + 40)
  f.text(LEFT, f.y, 'SIGNATURE / TANDA TANGAN', 7.2, RED, true)
  f.y -= 8
  const sy = f.y - sh
  f.outline(LEFT, sy - 4, sw + 8, sh + 8, '#DCE0E1', 0.8)
  f.put(() => s.page.drawImage(signature, { x: LEFT + 4, y: sy, width: sw, height: sh }))
  f.text(LEFT + sw + 20, f.y - 10, `SHA-256 ${p.signatureSha256.slice(0, 32)}`, 6, SLATE)
  f.text(LEFT + sw + 20, f.y - 18, p.signatureSha256.slice(32), 6, SLATE)
  f.y = sy - 22

  const colW = (WIDTH - 16) / 2, maxH = 150
  for (let i = 0; i < p.photos.length; i += 2) {
    const row = await Promise.all(p.photos.slice(i, i + 2).map(async (ph) => {
      const image = await s.doc.embedJpg(ph.bytes)
      const scale = Math.min(colW / image.width, maxH / image.height, 1)
      return { image, w: image.width * scale, h: image.height * scale, sha: ph.sha256 }
    }))
    const rowH = Math.max(...row.map((r) => r.h))
    f.keep(rowH + 28 + (i === 0 ? 14 : 0))
    if (i === 0) { f.text(LEFT, f.y, 'PHOTOS OF THE GOODS / FOTO BARANG', 7.2, RED, true); f.y -= 8 }
    const top = f.y
    row.forEach((r, k) => {
      const x = LEFT + k * (colW + 16)
      f.put(() => s.page.drawImage(r.image, { x, y: top - r.h, width: r.w, height: r.h }))
      f.text(x, top - rowH - 9, `Photo ${i + k + 1}  SHA-256 ${r.sha.slice(0, 24)}...`, 5.8, SLATE)
    })
    f.y = top - rowH - 22
  }

  f.draw(frame(s, { title: 'PROOF OF DELIVERY', subtitle: 'BUKTI PENGIRIMAN', number: d.number, status: p.status === 'rejected' ? 'void' : d.status, issuer, label: 'PROOF OF DELIVERY', verifyUrl: d.verifyUrl, verifyLabel: 'Check this proof-of-delivery document online', evidenceUrl: d.viewUrl, issuedOn: p.receivedAt }))
  return s.save()
}
