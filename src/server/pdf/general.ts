import { BILLING_HEADINGS, documentType, longDate, WORDS, type DocumentType, type Lang, type SignerDef } from '../../content/document-types'
import { daysBetween } from '../dates'
import { money } from '../money'
import { SIGNATURE_HEIGHT, signatureHeight } from '../../content/verification-blocks'
import { Flow } from './flow'
import { BAND_H, H, INK, RED, SLATE, TAGLINE, W, WHITE, PdfLayoutError, Sheet } from './kit'
import type { GeneralDocData, Issuer } from './types'

/**
 * Letters, billing letters, statements, powers of attorney, certification and assignment letters: one flowing A4 layout under the VORA
 * letterhead, in the language the document was written in. Text runs over as many pages as it needs (nothing is clipped); a signature
 * block is never split from the text it signs. Every page carries the verification QR code and its clickable address. A draft or void
 * document is marked across every page so it cannot pass for an issued one.
 */
const LEFT = 50
const RIGHT = W - 50
const WIDTH = RIGHT - LEFT
const FOOTER_TOP = 86
const LIMIT = FOOTER_TOP + 14
const TOP = H - BAND_H - 30
const BODY = 9.2
const LEADING = 13
const METERAI = 72
/** The space left for a signature (wet ink, or the VORA signing stamp placed later). The verification QR code is NOT a signature and is never drawn here. */
const SIGN_SPACE = 72

const MARKER = /^(\s*(?:\d+[.)]|[a-z][.)]|[-*•]))\s+/

export async function renderGeneral(d: GeneralDocData, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  const type = documentType(d.kind)
  if (!type || type.family === 'certificate') throw new PdfLayoutError('This document type has no page layout')
  const lang = d.language
  const title = type.label[lang].toUpperCase()
  const s = await Sheet.create({ title: `${type.label[lang]} | ${d.number}`, author: issuer.legalName, subject: 'Document with online verification' })
  const f = new Flow(s, { top: TOP, limit: LIMIT, left: LEFT, right: RIGHT })

  layout(s, f, type, d, issuer, verificationUrl)

  const pageWord = lang === 'id' ? ['HALAMAN', 'DARI'] : ['PAGE', 'OF']
  f.draw((pageNo, total) => {
    s.background({ x: W / 2 - 168, y: H / 2 - 101, w: 336, h: 202 })
    if (d.status === 'draft') s.stampWord('DRAFT')
    if (d.status === 'void') s.stampWord('VOID')
    s.header({ x: LEFT, logoWidth: 144, info: { address: issuer.address, taxId: issuer.taxId } })
    s.right(RIGHT, H - 46, title, title.length > 22 ? 13 : 16, WHITE, true)
    s.right(RIGHT, H - 66, d.number, 6.8, WHITE)
    if (d.status !== 'issued') s.right(RIGHT, H - 86, d.status.toUpperCase(), 7, '#E8B3AA', true)
    s.pageEdge()
    const pageText = `${title}  |  ${pageWord[0]} ${pageNo} ${pageWord[1]} ${total}`
    if (type.family === 'agreement') {
      // An agreement carries no verification footer: its verification (Signature Type 2) is the block that closes it. Only the page numbering stays.
      s.rule(FOOTER_TOP - 12, LEFT, RIGHT)
      s.text(LEFT, 24, pageText, 7.1, SLATE)
    } else {
      s.verificationFooter({
        left: LEFT, right: RIGHT, top: FOOTER_TOP - 3, bottom: 9, url: verificationUrl, number: d.number, issuedOn: d.documentDate, issuer: { address: issuer.address, taxId: issuer.taxId, email: issuer.email }, tagline: TAGLINE,
        heading: lang === 'id' ? 'VORA | VERIFIKASI DOKUMEN' : 'VORA | DOCUMENT VERIFICATION', instruction: WORDS.verifyOnline[lang], pageLine: pageText,
      })
    }
  })
  return s.save()
}

function layout(s: Sheet, f: Flow, type: DocumentType, d: GeneralDocData, issuer: Issuer, verificationUrl: string): void {
  const lang = d.language
  const v = d.values
  const t = (key: keyof typeof WORDS) => WORDS[key][lang]

  /** Wraps `content` and draws it, moving to the next page whenever a line would not fit. A list marker keeps its indent. */
  const paragraphs = (content: string, o: { x?: number; width?: number; size?: number; leading?: number; bold?: boolean; fill?: string } = {}) => {
    const x = o.x ?? LEFT, width = o.width ?? WIDTH, size = o.size ?? BODY, leading = o.leading ?? LEADING
    for (const line of content.split('\n')) {
      if (!line.trim()) { f.keep(leading); f.y -= leading * 0.6; continue }
      const marker = MARKER.exec(line)
      const hang = marker ? s.width(`${marker[1].trim()} `, size, o.bold) : 0
      const rows = s.wrap(marker ? line.slice(marker[0].length) : line.trim(), width - hang, size, o.bold)
      rows.forEach((row, i) => {
        f.keep(leading)
        if (marker && i === 0) f.text(x, f.y, marker[1].trim(), size, o.fill ?? INK, o.bold)
        if (row) f.text(x + hang, f.y, row, size, o.fill ?? INK, o.bold)
        f.y -= leading
      })
    }
  }
  const gap = (h: number) => { f.y -= h }
  const centered = (text: string, size: number, bold = true, fill = INK) => { f.keep(size + 6); f.text(LEFT + (WIDTH - s.width(text, size, bold)) / 2, f.y, text, size, fill, bold); f.y -= size + 6 }
  /** "Label : value" with the values lined up in one column. */
  const definition = (rows: Array<[string, string]>, labelWidth: number, x = LEFT, bold = false) => {
    for (const [label, value] of rows) {
      if (!value) continue
      const lines = s.wrap(value, WIDTH - (x - LEFT) - labelWidth - 10, BODY, bold)
      f.keep(LEADING * Math.min(lines.length, 2))
      f.text(x, f.y, label, BODY, SLATE)
      f.text(x + labelWidth, f.y, ':', BODY, SLATE)
      lines.forEach((row, i) => {
        if (i) f.keep(LEADING)
        if (row) f.text(x + labelWidth + 10, f.y, row, BODY, INK, bold)
        f.y -= LEADING
      })
    }
  }
  /** Centred text that wraps onto as many lines as it needs. */
  const centeredWrap = (text: string, size: number, bold = true, fill = INK) => {
    for (const row of s.wrap(text, WIDTH, size, bold)) { f.keep(size + 6); f.text(LEFT + (WIDTH - s.width(row, size, bold)) / 2, f.y, row, size, fill, bold); f.y -= size + 6 }
  }
  /** An agreement: title, the two parties, the background, the articles one after the other, the closing and a signature column for each party. */
  const agreement = () => {
    const id = lang === 'id'
    centeredWrap(v.subject.toUpperCase(), 12)
    centered(`${t('number')}: ${d.number}`, 8.4, false, SLATE)
    gap(LEADING * 0.6)
    paragraphs(id
      ? `Perjanjian ini dibuat dan ditandatangani pada tanggal ${longDate(d.documentDate, lang)}, bertempat di ${v.place}, oleh dan antara:`
      : `This Agreement is made and signed on ${longDate(d.documentDate, lang)}, in ${v.place}, by and between:`)
    gap(LEADING * 0.3)
    ;(['first', 'second'] as const).forEach((key, i) => {
      const caption = key === 'first' ? (id ? 'PIHAK PERTAMA' : 'FIRST PARTY') : (id ? 'PIHAK KEDUA' : 'SECOND PARTY')
      const represented = id ? `diwakili oleh ${v[`${key}_name`]}, selaku ${v[`${key}_position`]}` : `represented by ${v[`${key}_name`]}, as ${v[`${key}_position`]}`
      const address = id ? `beralamat di ${v[`${key}_address`]}` : `having its address at ${v[`${key}_address`]}`
      paragraphs(`${i + 1}. ${v[`${key}_company`]}, ${represented}, ${address}; ${id ? 'selanjutnya disebut' : 'hereinafter called'} "${caption}".`)
      gap(LEADING * 0.3)
    })
    paragraphs(id ? 'PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut "Para Pihak".' : 'The FIRST PARTY and the SECOND PARTY are together called the "Parties".')
    if (v.background) {
      gap(LEADING * 0.6); f.keep(LEADING * 3)
      f.text(LEFT, f.y, id ? 'Latar belakang' : 'Background', BODY, INK, true); f.y -= LEADING
      paragraphs(v.background)
    }
    gap(LEADING * 0.6)
    paragraphs(id ? 'Para Pihak sepakat untuk mengadakan Perjanjian dengan ketentuan sebagai berikut:' : 'The Parties agree as follows:')
    d.articles.forEach((a, i) => {
      gap(LEADING * 0.7)
      f.keep(LEADING * 4)
      centered(`${id ? 'PASAL' : 'ARTICLE'} ${i + 1}`, BODY)
      centeredWrap(a.title.toUpperCase(), BODY)
      paragraphs(a.body)
    })
    gap(LEADING)
    paragraphs(v.closing)
    gap(LEADING)
    signers(s, f, type, d, lang)
    endBlock()
  }
  const placeAndDate = () => { f.keep(LEADING * 2); f.right(RIGHT, f.y, `${v.place}, ${longDate(d.documentDate, lang)}`, BODY, INK); f.y -= LEADING * 1.6 }

  /**
   * The signature block, kept in one piece: greeting, company, room to sign, name and position. The QR code is not part of it: it is a way to CHECK the
   * document, not a signature (see the verification block at the end).
   */
  const signature = (name: string, position: string) => {
    const ROOM = signatureHeight(1)                                   // a personal or company signature on a letter is Signature Type 1
    f.keep(LEADING * 4 + ROOM + 14)
    f.text(LEFT, f.y, t('regards'), BODY, INK); f.y -= LEADING
    f.text(LEFT, f.y, issuer.legalName, BODY, INK, true); f.y -= 8
    const top = f.y
    // Room for the signing mark exactly the size of the mark, between the company and the printed name: the signing ceremony starts it here.
    f.put(() => {
      s.markSignSlot(LEFT, top)
      // Issued with the company's own signature: the Signature Type 1 mark of the company sits in the room. Otherwise the room is left for a personal signature.
      if (d.companySignature && d.issuedAt) s.signatureBlock({ type: 1, lang, url: verificationUrl, number: d.number, registeredAt: d.issuedAt, name: issuer.legalName, position: lang === 'id' ? 'Penerbit dokumen' : 'Document issuer', left: LEFT, top, background: d.signatureBackground })
      else s.rule(top - ROOM - 3, LEFT, LEFT + 170, '#AEB6BA', 0.5)
    })
    f.y -= ROOM + 14
    if (name) { f.text(LEFT, f.y, name, BODY, INK, true); f.y -= LEADING }
    if (position) { f.text(LEFT, f.y, position, BODY, SLATE); f.y -= LEADING }
  }
  /**
   * The verification block that closes an AGREEMENT: Signature Type 2 (QR, document number, registration, issuer, and the complete verification link, in one box of the
   * same size as every other signature). Every other document carries Footer Type 3 on each page instead, and this block is not used for it.
   */
  const endBlock = () => {
    if (type.family !== 'agreement') return
    gap(LEADING)
    f.keep(SIGNATURE_HEIGHT + 12)
    const top = f.y
    f.put(() => s.signatureBlock({ type: 2, lang, url: verificationUrl, number: d.number, registeredAt: d.issuedAt, name: issuer.legalName, position: lang === 'id' ? 'Penerbit dokumen' : 'Document issuer', left: LEFT, top, background: d.signatureBackground }))
    f.y = top - SIGNATURE_HEIGHT - 12
  }
  const copies = () => {
    if (!v.cc) return
    gap(LEADING * 0.8)
    f.keep(LEADING * 2)
    f.text(LEFT, f.y, `${t('copyTo')}:`, 8.2, SLATE, true); f.y -= LEADING
    paragraphs(v.cc.split('\n').map((c) => `- ${c.trim().replace(MARKER, '')}`).join('\n'), { size: 8.2, leading: 11.5 })
  }

  if (type.family === 'letter' || type.family === 'billing') {
    placeAndDate()
    definition([[t('number'), d.number], [t('attachments'), v.attachments ?? ''], [t('subject'), v.subject ?? '']], 62)
    gap(LEADING)
    f.keep(LEADING * 4)
    f.text(LEFT, f.y, t('to'), BODY, INK); f.y -= LEADING
    paragraphs(v.recipient_name, { bold: true })
    if (v.recipient_address) paragraphs(v.recipient_address)
    if (v.attention) paragraphs(`${t('attention')} ${v.attention}`)
    gap(LEADING * 0.8)
    paragraphs(v.body)
    if (type.family === 'billing') billing(s, f, d, lang, paragraphs, gap)
    gap(LEADING * 0.4)
    paragraphs(v.closing)
    gap(LEADING)
    signature(v.signatory_name, v.signatory_title)
    copies()
    endBlock()
    return
  }

  if (type.family === 'agreement') { agreement(); return }

  // Parties: heading, the people named, what is declared, the closing and one signature box per signer.
  centered(type.label[lang].toUpperCase(), 12)
  centered(`${t('number')}: ${d.number}`, 8.4, false, SLATE)
  if (v.subject) { gap(2); centered(v.subject, 9.2, true) }
  gap(LEADING * 0.8)
  const parties = type.parties ?? []
  parties.forEach((party) => {
    f.keep(LEADING * 5)
    f.text(LEFT, f.y, party.caption[lang], BODY, INK, true); f.y -= LEADING
    definition([[t('name'), v[`${party.key}_name`] ?? ''], [t('idNumber'), v[`${party.key}_id_number`] ?? ''], [t('position'), v[`${party.key}_position`] ?? ''], [t('address'), v[`${party.key}_address`] ?? '']], 84, LEFT + 14)
    gap(LEADING * 0.6)
  })
  if (type.lead) { paragraphs(type.lead[lang]); gap(LEADING * 0.2) }
  paragraphs(v.body)
  definition([[t('location'), v.location ?? ''], [type.key === 'authorization' ? t('validity') : t('period'), v.period ?? '']], 84)
  gap(LEADING * 0.4)
  paragraphs(v.closing)
  gap(LEADING)
  placeAndDate()
  signers(s, f, type, d, lang)
  endBlock()
}

/** The table of open invoices, the total, the pay-by date and the bank accounts. */
function billing(_s: Sheet, f: Flow, d: GeneralDocData, lang: Lang, paragraphs: (c: string, o?: { size?: number; leading?: number; bold?: boolean; fill?: string }) => void, gap: (h: number) => void): void {
  const t = (key: keyof typeof WORDS) => WORDS[key][lang]
  const invoices = d.invoices
  if (!invoices.length) throw new PdfLayoutError('A billing letter lists at least one invoice')
  const currency = invoices[0].currency
  const heading = BILLING_HEADINGS[d.values.level ?? 'first'] ?? BILLING_HEADINGS.first
  gap(6)
  f.keep(60)
  f.text(LEFT, f.y, heading[lang], 8.6, RED, true)
  f.rule(f.y - 5)
  f.y -= 20
  const size = 7.8
  const head = () => {
    f.roundRect(LEFT, f.y - 8, WIDTH, 19, 4, '#F7F7F4')
    f.text(LEFT + 6, f.y - 2, t('invoiceNo').toUpperCase(), 6.6, SLATE, true)
    f.text(LEFT + 188, f.y - 2, t('issued').toUpperCase(), 6.6, SLATE, true)
    f.text(LEFT + 246, f.y - 2, t('due').toUpperCase(), 6.6, SLATE, true)
    f.text(LEFT + 314, f.y - 2, t('overdue').toUpperCase(), 6.6, SLATE, true)
    f.right(RIGHT - 6, f.y - 2, t('outstanding').toUpperCase(), 6.6, SLATE, true)
    f.y -= 22
  }
  head()
  let total = 0
  for (const inv of invoices) {
    if (f.keep(16)) head()
    const late = daysBetween(inv.dueAt, d.documentDate)
    f.text(LEFT + 6, f.y, inv.number, size)
    f.text(LEFT + 188, f.y, inv.issuedAt, size)
    f.text(LEFT + 246, f.y, inv.dueAt, size)
    f.text(LEFT + 314, f.y, late > 0 ? `${late} ${t('days')}` : t('notDue'), size, late > 0 ? RED : SLATE, late > 0)
    f.right(RIGHT - 6, f.y, money(inv.outstandingMinor, currency), size, INK, true)
    total += inv.outstandingMinor
    f.rule(f.y - 5, LEFT, RIGHT)
    f.y -= 15
  }
  f.keep(70)
  f.y -= 18
  f.roundRect(LEFT, f.y - 9, WIDTH, 24, 5, INK)
  f.text(LEFT + 8, f.y - 1, t('total'), 8, WHITE, true)
  f.right(RIGHT - 8, f.y - 1, money(total, currency), 9.6, WHITE, true)
  f.y -= 34
  paragraphs(`${t('payBy')}: ${longDate(d.values.pay_by ?? '', lang)}`, { bold: true })
  const banks = d.banks
  if (banks.length) {
    gap(4)
    paragraphs(t('transferTo'))
    for (const b of banks) paragraphs([b.bankName, b.accountNumber, b.accountHolder, b.swiftCode && `SWIFT ${b.swiftCode}`].filter(Boolean).join(' / '), { size: 8.4, leading: 12 })
  }
}

/**
 * One signature column per signer: the QR code that signs the document and, beside it, the square (1:1) for the stamp duty or the
 * company stamp when the type has one. There is no handwritten signature: the name and position are printed under the QR code.
 */
function signers(s: Sheet, f: Flow, type: DocumentType, d: GeneralDocData, lang: Lang): void {
  const list = (type.signers ?? []).filter((x) => d.values[`${x.party}_name`])
  if (!list.length) return
  const height = METERAI + 90
  f.keep(height)
  const columnWidth = WIDTH / 2 - 10
  list.forEach((signer: SignerDef, index: number) => {
    const x = list.length === 1 ? LEFT + WIDTH - columnWidth : LEFT + index * (WIDTH / 2 + 10)
    const centre = x + columnWidth / 2
    const top = f.y
    f.text(centre - s.width(signer.role[lang], BODY, true) / 2, top, signer.role[lang], BODY, INK, true)
    const hidden = type.key === 'statement' && d.values.stamp_duty === 'no'
    const box = signer.box && !hidden ? signer.box[lang].toUpperCase() : ''
    const together = box ? SIGN_SPACE * 2 + 14 : SIGN_SPACE
    const qrX = centre - together / 2
    const qrTop = top - 10
    f.put(() => s.rule(qrTop - SIGN_SPACE + 4, qrX, qrX + SIGN_SPACE, '#AEB6BA', 0.5))                        // room to sign: the QR code is not a signature
    if (box) {
      const boxX = qrX + SIGN_SPACE + 14
      f.outline(boxX, qrTop - METERAI, METERAI, METERAI, SLATE, 0.8, [3, 2])                    // a 1:1 square, dashed: "put it here"
      f.text(boxX + (METERAI - s.width(box, 6.4, true)) / 2, qrTop - METERAI / 2 - 2, box, 6.4, '#AEB6BA', true)
    }
    const caption = WORDS.signHere[lang]
    f.text(qrX + (SIGN_SPACE - s.width(caption, 5.6)) / 2, qrTop - SIGN_SPACE - 8, caption, 5.6, SLATE)
    const name = d.values[`${signer.party}_name`]
    const position = d.values[`${signer.party}_position`] ?? ''
    const nameY = qrTop - SIGN_SPACE - 24
    const rows = s.wrap(name, columnWidth, BODY, true).slice(0, 2)
    rows.forEach((row, i) => f.text(centre - s.width(row, BODY, true) / 2, nameY - i * LEADING, row, BODY, INK, true))
    if (position) f.text(centre - s.width(position.slice(0, 40), 8.2) / 2, nameY - rows.length * LEADING, position.slice(0, 40), 8.2, SLATE)
    const company = d.values[`${signer.party}_company`]
    if (company) f.text(centre - s.width(company.slice(0, 40), 8.2) / 2, nameY - (rows.length + (position ? 1 : 0)) * LEADING, company.slice(0, 40), 8.2, SLATE)
  })
  f.y -= height
}
