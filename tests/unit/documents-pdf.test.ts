import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { documentType } from '@/content/document-types'
import { renderCertificate } from '@/server/pdf/certificate'
import { renderDeliveryNote, renderPod } from '@/server/pdf/delivery'
import { renderGeneral } from '@/server/pdf/general'
import { sealPdf } from '@/server/pdf/seal'
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '@/content/verification-blocks'
import { trustPolicy } from '@/content/trust-policy'
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFNumber } from 'pdf-lib'
import { renderInvoice } from '@/server/pdf/invoice'
import { renderPrepayment } from '@/server/pdf/prepayment'
import { renderQuotation } from '@/server/pdf/quotation'
import { renderReceipt } from '@/server/pdf/receipt'
import type { DeliveryNoteData, GeneralDocData, InvoiceData, Issuer, PodData, PrepaymentData, QuotationData, ReceiptData } from '@/server/pdf/types'
import { pdfLinks, pdfPages, rasterize, squash } from '../helpers/pdf-text'

/**
 * Every renderer, fed plain data (they never touch the database): each page carries the verification mark whose QR code decodes to the document's own
 * verification address, the same address as a clickable link and printed in full, and no page calls a QR code a signature.
 */
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGh'
const URL_ = `https://voraworld.id/verify/${TOKEN}`
const issuer: Issuer = { legalName: 'PT Satu Arah International', address: 'Jl. Contoh No. 1, Jakarta, Indonesia', email: 'info@voraworld.id', taxId: '01.234.567.8-901.000' }
const party = { name: 'PT Pelanggan Contoh', address: 'Jl. Pelanggan 2, Bogor', email: 'c@example.invalid', taxId: '' }
const line = { description: 'Freight service', unit: 'shipment', quantity: '1', priceMinor: 2_500_000, amountMinor: 2_500_000 }
const bank = { bankName: 'BANK CONTOH', accountNumber: '0012345678', accountHolder: 'PT Satu Arah International', currency: 'IDR', swiftCode: '', position: 1 }
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

const invoice: InvoiceData = {
  number: 'INV-VORA-C001-202610-00001', status: 'issued', currency: 'IDR', issuedAt: '2026-10-29', dueAt: '2026-11-28', poNumber: 'PO-1', shipmentReference: 'JOB-1', serviceMode: 'SEA IMPORT', origin: 'Shanghai', destination: 'Jakarta',
  transportDocumentRef: 'BL-1', notes: '', taxPercent: '11', withholdingPercent: '0', discountMinor: 0, subtotalMinor: 2_500_000, taxMinor: 275_000, withholdingMinor: 0, totalMinor: 2_775_000, outstandingMinor: 2_775_000,
  items: [line], banks: [bank], customer: party,
}
const quotation: QuotationData = { number: 'QUO-VORA-C001-202610-00001', status: 'issued', currency: 'IDR', issuedAt: '2026-10-29', validUntil: '2026-11-29', paymentTerms: 'Net 30', termsConditions: 'Standard conditions apply.', notes: '', taxPercent: '11', subtotalMinor: 2_500_000, taxMinor: 275_000, totalMinor: 2_775_000, items: [line], recipient: party }
const receipt: ReceiptData = {
  number: 'RCP-VORA-C001-202610-00001', status: 'issued', issuedOn: '2026-10-30', stampRequired: false,
  payment: { id: 1, amountMinor: 2_775_000, date: '2026-10-30', method: 'bank_transfer', reference: 'TRX1', confirmedAt: new Date('2026-10-30T03:00:00Z'), confirmedBy: 'finance', bank: { bank_name: 'BANK CONTOH', account_number: '0012345678', account_holder: 'PT Satu Arah International' } },
  invoice: { number: invoice.number, currency: 'IDR', totalMinor: 2_775_000, outstandingMinor: 0 }, payer: party,
}
const prepayment: PrepaymentData = { number: 'PRE-VORA-C001-202610-00001', status: 'issued', stampRequired: false, issuedOn: '2026-10-29', currency: 'IDR', amountMinor: 2_775_000, invoice: { number: invoice.number, issuedAt: '2026-10-29', dueAt: '2026-11-28', poNumber: 'PO-1', shipmentReference: 'JOB-1' }, payer: party, banks: [bank] }
const general = (kind: string, values: Record<string, string>, over: Partial<GeneralDocData> = {}): GeneralDocData => ({ number: `DOC-${kind}-1`, kind, language: 'id', status: 'issued', documentDate: '2026-10-30', values, invoices: [], banks: [], articles: [], ...over })
const letter = general('letter', { place: 'Jakarta', subject: 'Pemberitahuan', recipient_name: 'PT Mitra', body: 'Dengan hormat, ini adalah surat uji.', closing: 'Hormat kami,', signatory_name: 'Siti Rahma', signatory_title: 'Direktur' })
const certificate = general('certificate', { title: 'Sertifikat Penghargaan', recipient_name: 'Budi Santoso', body: 'Atas kontribusinya.', place: 'Jakarta', signatory_name: 'Siti Rahma', signatory_title: 'Direktur' })
const note: DeliveryNoteData = {
  number: 'DLV-VORA-C001-202610-00001', status: 'issued', deliveryDate: '2026-10-30', customerName: 'PT Pelanggan', quotationNumber: quotation.number, shipperName: 'PT Pengirim', shipperAddress: 'Jl. A', shipperContact: '', shipperPhone: '', shipperEmail: '',
  consigneeName: 'PT Penerima', consigneeAddress: 'Jl. B', consigneeContact: '', consigneePhone: '', consigneeEmail: '', origin: 'Jakarta', destination: 'Bandung', shipmentReference: 'JOB-1', poNumber: '', carrier: 'VORA', vehicle: 'Truck', vehiclePlate: 'B 1234 XYZ',
  driverName: 'Agus', driverPhone: '', notes: '', items: [{ description: 'Cartons', quantity: '10', unit: 'ctn', remarks: '' }], captureUrl: 'https://voraworld.id/pod/CAPTURETOKENCAPTURETOKEN', verifyUrl: URL_,
}

/** Decodes the QR code found in the lowest 110 points of a page (the footer), at 200 dpi. */
function footerQr(bytes: Uint8Array, page: number): string | undefined {
  const r = rasterize(bytes, page, 200)
  if (!r) return undefined
  const top = Math.max(0, r.height - Math.round(110 * r.scale))
  const width = r.width, height = r.height - top
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [R, G, B] = r.at(x, y + top); const i = (y * width + x) * 4; rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255 }
  return jsQR(rgba, width, height)?.data
}

async function expectVerifiable(name: string, bytes: Uint8Array, url = URL_) {
  const links = await pdfLinks(bytes)
  const text = await pdfPages(bytes)
  expect(links.length, name).toBeGreaterThan(0)
  for (const [i, page] of links.entries()) {
    expect(page, `${name} page ${i + 1}: a link to the verification page`).toContain(url)
    expect(footerQr(bytes, i + 1), `${name} page ${i + 1}: the footer QR code decodes to the verification address`).toBe(url)
    expect(squash(text[i]).replace(/\s/g, ''), `${name} page ${i + 1}: the address is printed in full`).toContain(url.replace('https://', '').replace(/\s/g, ''))
    expect(squash(text[i]), `${name} page ${i + 1}: the corporate name beside the QR code`).toContain('PT SATU ARAH INTERNATIONAL')
  }
  expect(squash(text.join(' ')), name).not.toMatch(/Ditandatangani secara elektronik|Electronically signed|QR code (is|that) (the )?signature/i)
}

describe('every document carries the verification mark, a clickable link and the printed address', () => {
  it('invoice', async () => { await expectVerifiable('invoice', await renderInvoice(invoice, issuer, URL_)) })
  it('quotation', async () => { await expectVerifiable('quotation', await renderQuotation(quotation, issuer, URL_)) })
  it('official receipt', async () => { await expectVerifiable('receipt', await renderReceipt(receipt, issuer, URL_)) })
  it('pre-payment receipt', async () => { await expectVerifiable('prepayment', await renderPrepayment(prepayment, issuer, URL_)) })
  it('letter: Footer Type 3 on the page, room to sign, and no separate verification block', async () => {
    const pdf = await renderGeneral(letter, issuer, URL_)
    await expectVerifiable('letter', pdf)
    const t = squash((await pdfPages(pdf)).join(' '))
    expect(t).toContain('VORA | VERIFIKASI DOKUMEN'); expect(t).not.toMatch(/bukan tanda tangan/i); expect(t).toContain('Siti Rahma')
    expect((await pdfLinks(pdf))[0].filter((u) => u === URL_).length).toBe(2)                // the address row and the QR code of the footer: nothing else on the page
  })
  it('letters of every general type render with the mark', async () => {
    const values: Record<string, string> = { place: 'Jakarta', subject: 'Uji', recipient_name: 'PT Mitra', body: 'Isi surat.', closing: 'Hormat kami,', signatory_name: 'Siti Rahma', signatory_title: 'Direktur', declarant_name: 'Budi', declarant_id_number: '1', declarant_position: 'Staf', declarant_address: 'Jl. X', location: 'Jakarta', period: '1 tahun',
      grantor_name: 'A', grantor_address: 'X', grantee_name: 'B', grantee_address: 'Y', certifier_name: 'C', certifier_position: 'Dir', subject_name: 'D', issuer_name: 'E', issuer_position: 'Dir', assignee_name: 'F', date_from: '2026-10-30', purpose: 'uji' }
    for (const kind of ['letter', 'statement', 'authorization', 'information', 'assignment']) {
      const type = documentType(kind)!
      const v = Object.fromEntries(type.fields.map((f) => [f.name, values[f.name] ?? (f.input === 'date' ? '2026-10-30' : f.input === 'select' ? f.options![0].value : 'Uji')]))
      await expectVerifiable(kind, await renderGeneral(general(kind, v), issuer, URL_))
    }
  })
  it('certificate, landscape, with a line to sign and the mark in the foot', async () => { await expectVerifiable('certificate', await renderCertificate(certificate, issuer, URL_)) })
  it('delivery note: the verification mark is not the driver\'s code, which stays', async () => {
    const pdf = await renderDeliveryNote(note, issuer)
    await expectVerifiable('delivery note', pdf)
    const t = squash((await pdfPages(pdf)).join(' '))
    expect(t).toContain('SCAN TO RECORD DELIVERY')
    expect((await pdfLinks(pdf)).flat()).toContain(note.captureUrl)
    expect(t).toContain("not the driver's code")
  })
  it('proof of delivery: the verification mark, with the evidence page kept as a separate link', async () => {
    const { captureUrl: _c, ...rest } = note
    const pod: PodData = { ...rest, viewUrl: 'https://voraworld.id/pod/view/VIEWTOKENVIEWTOKENVIEW', proof: {
      status: 'submitted', receivedAt: '2026-10-30 10:00 WIB', deviceTime: '', receiverName: 'Dewi', receiverPosition: 'Gudang', receiverPhone: '', receiverEmail: '', receiverIdNumber: '', courierName: 'Agus', courierPhone: '', condition: 'good', conditionNote: '',
      latitude: null, longitude: null, accuracyM: null, locationStatus: 'not_shared', locationNote: '', signature: PNG, signatureSha256: 'a'.repeat(64), photos: [] } }
    const pdf = await renderPod(pod, issuer)
    await expectVerifiable('proof of delivery', pdf)
    expect((await pdfLinks(pdf)).flat()).toContain(pod.viewUrl)
  })
})


/** The five documents of the acceptance list, made by the real renderers and overlays, and read back from the PDF. */
describe('end to end: the right component on the right document, never both', () => {
  const agreement = general('nda', { subject: 'Perjanjian Kerahasiaan', first_company: 'PT Satu Arah International', first_name: 'Siti Rahma', first_position: 'Direktur', first_address: 'Jakarta', second_company: 'PT Mitra', second_name: 'Budi', second_position: 'Direktur', second_address: 'Bandung', place: 'Jakarta', closing: 'Demikian.' },
    { articles: [{ title: 'Maksud', body: 'Para Pihak sepakat menjaga kerahasiaan.' }], issuedAt: '31 Okt 2026 11:42 WIB' })
  const bottomLinks = async (bytes: Uint8Array, page = 0) => {
    const doc = await PDFDocument.load(bytes)
    const annots = doc.getPage(page).node.Annots()?.asArray() ?? []
    return annots.map((ref) => { const a = doc.context.lookup(ref, PDFDict); return { y: (a.lookup(PDFName.of('Rect'), PDFArray).asArray()[1] as PDFNumber).asNumber(), h: (a.lookup(PDFName.of('Rect'), PDFArray).asArray()[3] as PDFNumber).asNumber() } })
  }
  const signedBlock = async (base: Uint8Array, type: 1 | 2, o: { number: string }) => (await sealPdf(base, { type, verificationUrl: URL_, lang: 'id', number: o.number, pages: 'last', corner: 'top-right', size: 'medium', issuedAt: '31 Okt 2026 11:42 WIB', signer: { name: 'Siti Rahma', position: 'Direktur' } })).bytes

  it('1. a standard VORA letter: Footer Type 3 on the page and Signature Type 1 when signed (no address in the signature)', async () => {
    expect(trustPolicy('document', 'letter')).toMatchObject({ signature: 1, footer: 'type3' })
    const letterPdf = await renderGeneral(letter, issuer, URL_)
    const signed = await signedBlock(letterPdf, 1, { number: letter.number })
    const t = squash((await pdfPages(signed)).join(' '))
    expect(t).toContain('VORA | VERIFIKASI DOKUMEN')                     // the footer
    expect(t).toContain('Nomor dokumen'); expect(t).toContain('Didaftarkan'); expect(t).toContain('Jabatan')
    // The signature (Type 1) carries no address of its own: the page has the footer's address row and QR and the signature's whole-box link only.
    const links = (await pdfLinks(signed))[0]
    expect(links.every((u) => u === URL_)).toBe(true); expect(links.length).toBe(3)
    expect(t.replace(/\s/g, '').split(URL_.replace(/\s/g, '')).length - 1).toBe(1)           // the address is printed once (in the footer): the signature has no address of its own
    expect(footerQr(signed, 1)).toBe(URL_)
  })

  it('2. a third-party document: Signature Type 2 only, with the complete clickable address in the box, and no VORA footer', async () => {
    const doc = await PDFDocument.create(); doc.addPage([595.28, 841.89])
    const original = await doc.save()
    expect(trustPolicy('document', 'seal')).toMatchObject({ signature: 2, footer: 'none' })
    const out = await signedBlock(original, 2, { number: 'SEL-VORA-V0123456789-202610-00001' })
    const t = squash((await pdfPages(out)).join(' '))
    expect(t.replace(/\s/g, '')).toContain(URL_.replace(/\s/g, ''))
    expect(t).not.toContain('VORA | DIGITAL'); expect(t).not.toContain('Diterbitkan')    // no footer
    const links = await bottomLinks(out)
    expect(links.length).toBe(2)                                                                              // the address row and the whole box, nothing else
    const box = Math.max(...links.map((l) => l.h - l.y))
    expect(box).toBeCloseTo(SIGNATURE_HEIGHT, 1)                                                              // the whole box is exactly the contract height
    expect(Math.min(...links.map((l) => l.h - l.y))).toBeLessThan(SIGNATURE_HEIGHT / 3)                       // and the address row is a band inside it
    expect(SIGNATURE_WIDTH / SIGNATURE_HEIGHT).toBeCloseTo(2, 9)
  })

  it('3. a VORA cooperation agreement: Signature Type 2 closes it, there is no verification footer, and the page numbering stays', async () => {
    expect(trustPolicy('document', 'nda')).toMatchObject({ signature: 2, footer: 'none' })
    const pdf = await renderGeneral(agreement, issuer, URL_)
    const pages = await pdfPages(pdf)
    const t = squash(pages.join(' '))
    expect(t).not.toContain('VORA | VERIFIKASI DOKUMEN'); expect(t).not.toContain('Diterbitkan')                // nothing of Footer Type 3 (its metadata column says Diterbitkan)
    expect(t).toMatch(/HALAMAN 1 DARI \d+/)                                                                  // page numbering is kept
    expect(t).toContain('Nomor dokumen'); expect(t).toContain('31 Okt 2026 11:42 WIB')
    expect(t.replace(/\s/g, '')).toContain(URL_.replace(/\s/g, ''))                                         // the complete address, once, in the block
    const all = (await pdfLinks(pdf)).flat()
    expect(all.length).toBe(2); expect(all.every((u) => u === URL_)).toBe(true)
    // The QR code of the block decodes to the same address.
    const r = rasterize(pdf, pages.length, 200)
    if (r) {
      const rgba = new Uint8ClampedArray(r.width * r.height * 4)
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const [R, G, B] = r.at(x, y); const i = (y * r.width + x) * 4; rgba[i] = R; rgba[i + 1] = G; rgba[i + 2] = B; rgba[i + 3] = 255 }
      expect(jsQR(rgba, r.width, r.height)?.data).toBe(URL_)
    }
  })

  it('4. a commercial invoice: Footer Type 3 with the original payment wording', async () => {
    const pdf = await renderInvoice(invoice, issuer, URL_)
    const t = squash((await pdfPages(pdf)).join(' '))
    for (const w of ['VORA | DIGITAL DOCUMENT VERIFICATION', 'PAYMENT REQUEST - NOT PROOF OF PAYMENT', 'Proof of payment is the official VORA receipt, issued only after Finance confirms cleared funds.', 'info@voraworld.id', 'PAGE 01 OF 01']) expect(t.replace(/\s+/g, ' '), w).toContain(w)
    expect(footerQr(pdf, 1)).toBe(URL_)
  })

  it('5. a receipt: Footer Type 3 with its own wording, and none of the invoice\'s payment-request wording', async () => {
    const pdf = await renderReceipt(receipt, issuer, URL_)
    const t = squash((await pdfPages(pdf)).join(' '))
    expect(t).toContain('Issued after VORA Finance confirmed cleared funds.'); expect(t).toContain('RECEIPT | PAGE 01 OF 01')
    expect(t).not.toContain('PAYMENT REQUEST - NOT PROOF OF PAYMENT')
    expect(footerQr(pdf, 1)).toBe(URL_)
  })

  it('keeps a multi-page document\'s footer and numbering on every page', async () => {
    const long = general('letter', { ...letter.values, body: Array.from({ length: 140 }, (_, i) => `Paragraf ${i + 1}: isi surat uji yang cukup panjang untuk memenuhi halaman.`).join('\n') })
    const pdf = await renderGeneral(long, issuer, URL_)
    const pages = await pdfPages(pdf)
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach((p, i) => { expect(squash(p)).toContain(`HALAMAN ${i + 1} DARI ${pages.length}`); expect(squash(p)).toContain('VORA | VERIFIKASI DOKUMEN') })
    for (const [i, links] of (await pdfLinks(pdf)).entries()) expect(links, `page ${i + 1}`).toContain(URL_)
  })
})
