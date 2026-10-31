import { longDate, WORDS } from '../../content/document-types'
import { BAND_H, INK, RED, SLATE, TAGLINE, WHITE, Sheet } from './kit'
import type { GeneralDocData, Issuer } from './types'

/**
 * The certificate: one landscape A4 page under the VORA letterhead, in the language it was written in. The holder's name is the
 * largest thing on it (set smaller, or over two lines, only when it is very long). Each signatory has a line to sign on, with the name and position printed
 * under it. The verification mark (QR code, VORA lockup and the clickable address) sits in the foot, small and apart from the signatures: it checks the
 * certificate online, it is not anybody's signature.
 */

export async function renderCertificate(d: GeneralDocData, issuer: Issuer, verificationUrl: string): Promise<Uint8Array> {
  const lang = d.language
  const v = d.values
  const s = await Sheet.create({ title: `${v.title} | ${d.number}`, author: issuer.legalName, subject: 'Certificate with online verification', landscape: true })
  const { w, h } = s
  const left = 50
  const right = w - 50
  const mid = w / 2
  const centred = (text: string, y: number, size: number, fill = INK, bold = false) => s.text(mid - s.width(text, size, bold) / 2, y, text, size, fill, bold)

  s.background({ x: mid - 168, y: h / 2 - 101, w: 336, h: 202 })
  if (d.status === 'draft') s.stampWord('DRAFT')
  if (d.status === 'void') s.stampWord('VOID')
  s.header({ x: left, logoWidth: 144, info: { address: issuer.address, taxId: issuer.taxId } })
  const label = lang === 'id' ? 'SERTIFIKAT' : 'CERTIFICATE'
  s.right(right, h - 46, label, 16, WHITE, true)
  s.right(right, h - 66, d.number, 6.8, WHITE)
  if (d.status !== 'issued') s.right(right, h - 86, d.status.toUpperCase(), 7, '#E8B3AA', true)

  // The certificate itself, framed.
  const top = h - BAND_H - 4
  s.outline(24, 100, w - 48, top - 100 - 20, '#DCE0E1', 0.8)
  let y = top - 56
  const title = v.title.toUpperCase()
  let titleSize = 24
  while (s.width(title, titleSize, true) > w - 160 && titleSize > 12) titleSize -= 0.5
  centred(title, y, titleSize, INK, true)
  s.rect(mid - 20, y - 14, 40, 2.5, RED)
  y -= 48
  centred(WORDS.presented[lang], y, 10.5, SLATE)
  y -= 38

  // The holder's name: as large as it fits on one line, otherwise two lines.
  const name = v.recipient_name
  let nameSize = 26
  while (s.width(name, nameSize, true) > w - 200 && nameSize > 14) nameSize -= 0.5
  const nameRows = s.width(name, nameSize, true) > w - 200 ? s.wrap(name, w - 200, nameSize, true).slice(0, 2) : [name]
  nameRows.forEach((row, i) => centred(row, y - i * (nameSize + 4), nameSize, INK, true))
  y -= (nameRows.length - 1) * (nameSize + 4)
  s.rule(y - 9, mid - 170, mid + 170, '#B8C0C4', 0.7)
  y -= 36

  const body = s.wrap(v.body, w - 240, 10.5).slice(0, 5)
  body.forEach((row, i) => centred(row, y - i * 15, 10.5, INK))
  y -= body.length * 15 + 6
  if (v.valid_until) { centred(`${WORDS.validUntil[lang]}: ${longDate(v.valid_until, lang)}`, y, 9, SLATE); y -= 16 }
  centred(`${v.place}, ${longDate(d.documentDate, lang)}`, Math.max(y - 4, 206), 9.5, INK)

  // Signatories: a line to sign on (wet ink, or the VORA signing stamp placed later); the name and position are printed under it.
  const people = [[v.signatory_name, v.signatory_title], [v.signatory2_name, v.signatory2_title]].filter(([n]) => n)
  const slot = people.length === 2 ? [w * 0.3, w * 0.7] : [mid]
  people.forEach(([n, t], i) => {
    const cx = slot[i]
    s.rule(150, cx - 85, cx + 85, '#AEB6BA', 0.6)
    centred2(s, cx, n, 130, 9.5, true)
    if (t) centred2(s, cx, t, 118, 8.2, false, SLATE)
  })

  // Footer: how to verify it.
  s.pageEdge()
  s.verificationFooter({
    left, right, top: 83, bottom: 9, url: verificationUrl, number: d.number, issuedOn: d.documentDate, issuer: { address: issuer.address, taxId: issuer.taxId, email: issuer.email }, tagline: TAGLINE,
    heading: lang === 'id' ? 'VORA | VERIFIKASI SERTIFIKAT' : 'VORA | CERTIFICATE VERIFICATION', instruction: WORDS.verifyOnline[lang], pageLine: `${label}  |  ${d.number}`,
  })
  return s.save()
}

function centred2(s: Sheet, cx: number, text: string, y: number, size: number, bold: boolean, fill = INK): void {
  const shown = s.width(text, size, bold) > 230 ? s.ellipsize(text, 230, size) : text
  s.text(cx - s.width(shown, size, bold) / 2, y, shown, size, fill, bold)
}
