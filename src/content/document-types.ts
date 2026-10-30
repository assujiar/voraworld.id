/**
 * The kinds of general document the portal can write (letters, statements, certificates...). Everything that differs between
 * them is data in this file: the fields of the form, the wording the form starts from, the labels printed in the document's
 * language, and which of the four layouts draws it. The form, the validation and the PDF all read from here.
 */
export type Lang = 'id' | 'en'
export type Bi = Record<Lang, string>
export const LANGS: readonly Lang[] = ['id', 'en']
export const LANGUAGE_NAMES: Bi = { id: 'Bahasa Indonesia', en: 'English' }
export const isLang = (v: unknown): v is Lang => v === 'id' || v === 'en'

export interface FieldDef {
  name: string
  label: Bi
  input: 'text' | 'textarea' | 'date' | 'select'
  required?: boolean
  /** Longest accepted text. Longer text is refused, never cut short. */
  max: number
  rows?: number
  options?: Array<{ value: string; label: Bi }>
  /** Wording the form starts from, per language (complete sentences only: nothing that would be issued by mistake). */
  initial?: Bi
  placeholder?: Bi
  hint?: Bi
  /** A heading shown in the form above this field. */
  section?: Bi
}

/** One person or company named in the document (the "parties" layout). */
export interface PartyDef { key: string; caption: Bi; positionRequired?: boolean }
export interface SignerDef { party: string; role: Bi; /** A box for the e-meterai / stamp duty or the company stamp. */ box?: Bi }

export type Family = 'letter' | 'billing' | 'parties' | 'certificate'

export interface DocumentType {
  key: string
  /** Prefix of the document number (KIND-VORA-OWNER-YYYYMM-RANDOM5). */
  prefix: string
  family: Family
  label: Bi
  summary: Bi
  fields: FieldDef[]
  parties?: PartyDef[]
  /** Printed before the body in the "parties" layout. */
  lead?: Bi
  signers?: SignerDef[]
  /** Certificates only: the public verification page names the holder. */
  publicHolder?: boolean
}

const T = (id: string, en: string): Bi => ({ id, en })

const place: FieldDef = { name: 'place', label: T('Tempat', 'Place'), input: 'text', required: true, max: 80, initial: T('Jakarta', 'Jakarta'), hint: T('Dicetak di depan tanggal dokumen.', 'Printed before the document date.') }
const signatory: FieldDef[] = [
  { name: 'signatory_name', label: T('Nama penandatangan', 'Signatory name'), input: 'text', required: true, max: 160, section: T('Penandatangan', 'Signatory') },
  { name: 'signatory_title', label: T('Jabatan penandatangan', 'Signatory position'), input: 'text', required: true, max: 160 },
]
const recipient: FieldDef[] = [
  { name: 'recipient_name', label: T('Kepada Yth.', 'To'), input: 'text', required: true, max: 240, section: T('Penerima surat', 'Recipient') },
  { name: 'recipient_address', label: T('Alamat penerima', 'Recipient address'), input: 'textarea', rows: 3, max: 600 },
  { name: 'attention', label: T('U.p. (untuk perhatian)', 'Attention'), input: 'text', max: 240 },
]
const closing = (id: string, en: string): FieldDef => ({ name: 'closing', label: T('Kalimat penutup', 'Closing sentence'), input: 'textarea', rows: 3, required: true, max: 800, initial: T(id, en) })

/** A person or company named in the document, as four fields. */
function partyFields(p: PartyDef): FieldDef[] {
  return [
    { name: `${p.key}_name`, label: T('Nama', 'Name'), input: 'text', required: true, max: 160, section: p.caption },
    { name: `${p.key}_id_number`, label: T('No. KTP / NIK / Paspor', 'ID card / passport number'), input: 'text', max: 40, hint: T('Opsional. Data pribadi: isi hanya bila diperlukan.', 'Optional. Personal data: fill in only when needed.') },
    { name: `${p.key}_position`, label: T('Jabatan', 'Position'), input: 'text', required: p.positionRequired, max: 160 },
    { name: `${p.key}_address`, label: T('Alamat', 'Address'), input: 'textarea', rows: 3, max: 400 },
  ]
}

const subjectField = (required: boolean, id = '', en = ''): FieldDef => ({
  name: 'subject', label: T('Perihal', 'Subject'), input: 'text', required, max: 240, section: T('Surat', 'Letter'), ...(id ? { initial: T(id, en) } : {}),
})

const partiesType = (o: Omit<DocumentType, 'family' | 'fields'> & { parties: PartyDef[]; extra: FieldDef[] }): DocumentType => ({
  ...o, family: 'parties', fields: [place, subjectField(false), ...o.parties.flatMap(partyFields), ...o.extra],
})

export const DOCUMENT_TYPES: DocumentType[] = [
  {
    key: 'letter', prefix: 'LTR', family: 'letter', label: T('Surat Umum', 'General letter'),
    summary: T('Surat resmi dengan kop surat VORA, perihal, penerima, isi dan tanda tangan.', 'A formal letter on the VORA letterhead: subject, recipient, body and signature.'),
    fields: [
      place, subjectField(true), ...recipient,
      { name: 'attachments', label: T('Lampiran', 'Attachments'), input: 'text', max: 160 },
      { name: 'body', label: T('Isi surat', 'Letter'), input: 'textarea', rows: 12, required: true, max: 8000, initial: T('Dengan hormat,\n\n', 'Dear Sir or Madam,\n\n') },
      closing('Demikian kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.', 'Thank you for your attention and cooperation.'),
      ...signatory,
      { name: 'cc', label: T('Tembusan', 'Copy to'), input: 'textarea', rows: 2, max: 400, hint: T('Satu per baris.', 'One per line.') },
    ],
  },
  {
    key: 'billing_letter', prefix: 'BIL', family: 'billing', label: T('Surat Tagihan', 'Billing letter'),
    summary: T('Tagihan atas invoice yang belum dibayar, lengkap dengan tabel invoice, batas pembayaran dan rekening.', 'A request for payment of open invoices, with the invoice table, the pay-by date and the bank accounts.'),
    fields: [
      place, subjectField(true, 'Surat Tagihan', 'Payment request'),
      { name: 'level', label: T('Tingkat', 'Level'), input: 'select', required: true, max: 20, options: [
        { value: 'first', label: T('Tagihan', 'Payment request') },
        { value: 'second', label: T('Tagihan kedua (peringatan)', 'Second reminder') },
        { value: 'final', label: T('Peringatan terakhir', 'Final notice') },
      ] },
      { name: 'pay_by', label: T('Dibayar paling lambat', 'Pay by'), input: 'date', required: true, max: 10 },
      ...recipient,
      { name: 'body', label: T('Isi surat (sebelum tabel)', 'Letter (before the table)'), input: 'textarea', rows: 6, required: true, max: 4000,
        initial: T('Dengan hormat,\n\nBerdasarkan catatan kami, invoice berikut belum kami terima pembayarannya. Mohon Bapak/Ibu dapat melakukan pembayaran paling lambat pada tanggal yang tercantum di bawah ini.',
          'Dear Sir or Madam,\n\nOur records show that the invoices below remain unpaid. Please arrange payment no later than the date stated below.') },
      closing('Apabila pembayaran telah dilakukan, mohon abaikan surat ini dan kirimkan bukti transfer kepada kami. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.',
        'If you have already paid, please disregard this letter and send us the transfer confirmation. Thank you for your cooperation.'),
      ...signatory,
    ],
  },
  partiesType({
    key: 'statement', prefix: 'STM', label: T('Surat Pernyataan', 'Statement letter'),
    summary: T('Pernyataan dari satu pihak, dengan data pembuat pernyataan, butir pernyataan dan kotak meterai.', 'A declaration by one person, with the declarant\'s details, the statements and a stamp-duty box.'),
    parties: [{ key: 'declarant', caption: T('Yang bertanda tangan di bawah ini', 'The undersigned') }],
    lead: T('Dengan ini menyatakan bahwa:', 'Hereby declares that:'),
    signers: [{ party: 'declarant', role: T('Yang membuat pernyataan', 'Declarant'), box: T('Meterai', 'Stamp duty') }],
    extra: [
      { name: 'body', label: T('Butir pernyataan', 'Statements'), input: 'textarea', rows: 9, required: true, max: 6000, section: T('Pernyataan', 'Statement'), placeholder: T('1. Bahwa ...\n2. Bahwa ...', '1. That ...\n2. That ...'), hint: T('Satu butir per baris, boleh diberi nomor.', 'One statement per line; numbering is yours.') },
      closing('Demikian surat pernyataan ini saya buat dengan sebenar-benarnya, dalam keadaan sadar dan tanpa paksaan dari pihak mana pun. Apabila di kemudian hari pernyataan ini terbukti tidak benar, saya bersedia menanggung segala akibat hukum yang timbul.',
        'I make this statement truthfully, of my own free will and without coercion from anyone. If it is later shown to be untrue, I accept the legal consequences.'),
      { name: 'stamp_duty', label: T('Kotak meterai', 'Stamp-duty box'), input: 'select', required: true, max: 3, options: [{ value: 'yes', label: T('Tampilkan', 'Show') }, { value: 'no', label: T('Sembunyikan', 'Hide') }], initial: T('yes', 'yes') },
    ],
  }),
  partiesType({
    key: 'authorization', prefix: 'AUT', label: T('Surat Kuasa', 'Power of attorney'),
    summary: T('Pemberian kuasa dari pemberi kuasa kepada penerima kuasa, dengan dua kolom tanda tangan.', 'The grantor authorises the attorney to act, with two signature boxes.'),
    parties: [{ key: 'grantor', caption: T('Yang bertanda tangan di bawah ini, selaku Pemberi Kuasa', 'The undersigned, as the Grantor') }, { key: 'grantee', caption: T('Dengan ini memberikan kuasa kepada, selaku Penerima Kuasa', 'Hereby authorises, as the Attorney') }],
    lead: T('Untuk dan atas nama Pemberi Kuasa, melakukan hal-hal berikut:', 'To act on behalf of the Grantor in the following matters:'),
    signers: [{ party: 'grantee', role: T('Penerima Kuasa', 'Attorney') }, { party: 'grantor', role: T('Pemberi Kuasa', 'Grantor'), box: T('Meterai', 'Stamp duty') }],
    extra: [
      { name: 'body', label: T('Hal yang dikuasakan', 'Powers granted'), input: 'textarea', rows: 8, required: true, max: 6000, section: T('Kuasa', 'Powers'), placeholder: T('1. Mengurus ...\n2. Menandatangani ...', '1. To handle ...\n2. To sign ...') },
      { name: 'period', label: T('Masa berlaku', 'Valid until'), input: 'text', max: 160, placeholder: T('mis. sampai dengan 31 Desember 2026', 'e.g. until 31 December 2026') },
      closing('Demikian surat kuasa ini dibuat untuk dipergunakan sebagaimana mestinya.', 'This power of attorney is issued for use as appropriate.'),
    ],
  }),
  partiesType({
    key: 'information', prefix: 'INF', label: T('Surat Keterangan', 'Certification letter'),
    summary: T('Keterangan resmi dari perusahaan tentang seseorang atau suatu hal, dengan kotak cap perusahaan.', 'An official statement by the company about a person or a matter, with a company-stamp box.'),
    parties: [{ key: 'certifier', caption: T('Yang bertanda tangan di bawah ini', 'The undersigned'), positionRequired: true }, { key: 'subject', caption: T('Menerangkan bahwa', 'Hereby certifies that') }],
    signers: [{ party: 'certifier', role: T('Yang menerangkan', 'Certified by'), box: T('Cap perusahaan', 'Company stamp') }],
    extra: [
      { name: 'body', label: T('Keterangan', 'Statement'), input: 'textarea', rows: 8, required: true, max: 6000, section: T('Keterangan', 'Statement') },
      closing('Demikian surat keterangan ini kami buat untuk dipergunakan sebagaimana mestinya.', 'This letter is issued for use as appropriate.'),
    ],
  }),
  partiesType({
    key: 'assignment', prefix: 'ASG', label: T('Surat Tugas', 'Assignment letter'),
    summary: T('Penugasan kepada karyawan atau mitra, dengan lokasi, jangka waktu dan kotak cap perusahaan.', 'An assignment to a team member or partner, with location, period and a company-stamp box.'),
    parties: [{ key: 'issuer', caption: T('Yang bertanda tangan di bawah ini', 'The undersigned'), positionRequired: true }, { key: 'assignee', caption: T('Dengan ini menugaskan kepada', 'Hereby assigns') }],
    signers: [{ party: 'issuer', role: T('Yang menugaskan', 'Assigned by'), box: T('Cap perusahaan', 'Company stamp') }],
    extra: [
      { name: 'body', label: T('Tugas', 'Assignment'), input: 'textarea', rows: 6, required: true, max: 4000, section: T('Penugasan', 'Assignment') },
      { name: 'location', label: T('Lokasi / tujuan', 'Location / destination'), input: 'text', max: 240 },
      { name: 'period', label: T('Waktu pelaksanaan', 'Period'), input: 'text', max: 160 },
      closing('Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.', 'This assignment letter is issued to be carried out with due responsibility.'),
    ],
  }),
  {
    key: 'certificate', prefix: 'CRT', family: 'certificate', label: T('Sertifikat', 'Certificate'), publicHolder: true,
    summary: T('Sertifikat landscape dengan nama penerima, uraian, tanda tangan dan kode QR untuk validasi.', 'A landscape certificate with the holder\'s name, a description, signatures and a QR code for validation.'),
    fields: [
      place,
      { name: 'title', label: T('Judul sertifikat', 'Certificate title'), input: 'text', required: true, max: 80, section: T('Sertifikat', 'Certificate'), initial: T('SERTIFIKAT PENGHARGAAN', 'CERTIFICATE OF APPRECIATION') },
      { name: 'recipient_name', label: T('Nama penerima sertifikat', 'Name of the holder'), input: 'text', required: true, max: 120, hint: T('Nama ini tampil di halaman verifikasi publik.', 'This name is shown on the public verification page.') },
      { name: 'body', label: T('Uraian', 'Description'), input: 'textarea', rows: 4, required: true, max: 600 },
      { name: 'valid_until', label: T('Berlaku sampai (opsional)', 'Valid until (optional)'), input: 'date', max: 10 },
      ...signatory,
      { name: 'signatory2_name', label: T('Nama penandatangan kedua (opsional)', 'Second signatory name (optional)'), input: 'text', max: 160 },
      { name: 'signatory2_title', label: T('Jabatan penandatangan kedua', 'Second signatory position'), input: 'text', max: 160 },
    ],
  },
]

export const documentType = (key: string): DocumentType | undefined => DOCUMENT_TYPES.find((t) => t.key === key)
export const bi = (value: Bi, lang: Lang): string => value[lang]

/** The numbering prefixes of every document type, for the numbering module. */
export const DOCUMENT_PREFIXES: string[] = DOCUMENT_TYPES.map((t) => t.prefix)

/** Printed above a billing letter's table, in the document's language, by level. */
export const BILLING_HEADINGS: Record<string, Bi> = {
  first: T('SURAT TAGIHAN', 'PAYMENT REQUEST'),
  second: T('SURAT TAGIHAN II', 'SECOND PAYMENT REMINDER'),
  final: T('SURAT TAGIHAN III (PERINGATAN TERAKHIR)', 'FINAL PAYMENT NOTICE'),
}

/** Words the layouts print around the user's text, by language. */
export const WORDS = {
  number: T('Nomor', 'No.'), attachments: T('Lampiran', 'Attachments'), subject: T('Perihal', 'Subject'), to: T('Kepada Yth.', 'To'), attention: T('U.p.', 'Attn.'),
  regards: T('Hormat kami,', 'Sincerely,'), eSigned: T('Ditandatangani secara elektronik', 'Electronically signed'),
  eSignedHow: T('Kode QR ini adalah tanda tangan dokumen. Pindai untuk memeriksa keaslian dan status dokumen.', 'This QR code is the signature of the document. Scan it to check the document\'s authenticity and status.'), copyTo: T('Tembusan', 'Copy to'), validUntil: T('Berlaku sampai', 'Valid until'),
  invoiceNo: T('No. Invoice', 'Invoice no.'), issued: T('Tanggal', 'Date'), due: T('Jatuh tempo', 'Due'), overdue: T('Terlambat', 'Overdue'), outstanding: T('Sisa tagihan', 'Outstanding'),
  days: T('hari', 'days'), notDue: T('belum jatuh tempo', 'not yet due'), total: T('TOTAL TAGIHAN', 'TOTAL DUE'), payBy: T('Mohon dibayar paling lambat', 'Please pay no later than'),
  transferTo: T('Pembayaran dapat ditransfer ke:', 'Payment can be transferred to:'), stampHere: T('Tempel meterai / cap di sini', 'Stamp here'),
  presented: T('diberikan kepada', 'is proudly presented to'), scan: T('Pindai kode QR untuk memverifikasi', 'Scan the QR code to verify'),
  verifyOnline: T('Periksa keaslian dokumen ini secara online dengan membuka tautan:', 'Check this document online at:'),
  name: T('Nama', 'Name'), position: T('Jabatan', 'Position'), idNumber: T('No. Identitas', 'ID number'), address: T('Alamat', 'Address'),
  location: T('Lokasi', 'Location'), period: T('Waktu', 'Period'), validity: T('Masa berlaku', 'Valid until'),
} satisfies Record<string, Bi>

const MONTHS: Record<Lang, string[]> = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
/** 2026-10-30 -> "30 Oktober 2026" / "30 October 2026". Anything that is not a plain date is returned as it is. */
export function longDate(iso: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${MONTHS[lang][Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

/** Every field of a type, in form order. */
export const fieldsOf = (type: DocumentType): FieldDef[] => type.fields
