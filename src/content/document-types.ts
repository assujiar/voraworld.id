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
  /** Supplied by a purpose-built control in the form (the seal placer), not by an input of its own. The value is still validated like any other. */
  hidden?: boolean
}

/** One person or company named in the document (the "parties" layout). */
export interface PartyDef { key: string; caption: Bi; positionRequired?: boolean }
export interface SignerDef { party: string; role: Bi; /** A box for the e-meterai / stamp duty or the company stamp. */ box?: Bi }

export type Family = 'letter' | 'billing' | 'parties' | 'certificate' | 'agreement' | 'seal'

/** One article (Pasal) of an agreement. The list is edited as a table; these are the clauses a new agreement starts from. */
export interface Article { title: string; body: string }

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
  /** Agreements only: the articles a new agreement starts from, per language. Every `[isi: ...]` / `[fill in: ...]` must be completed before the agreement can be issued. */
  articles?: Record<Lang, Article[]>
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


/** The two parties of an agreement: the company, who it is represented by, their position and the address. Party one starts as VORA. */
function agreementParty(key: 'first' | 'second'): FieldDef[] {
  const caption = key === 'first' ? T('PIHAK PERTAMA', 'FIRST PARTY') : T('PIHAK KEDUA', 'SECOND PARTY')
  const vora = key === 'first'
  return [
    { name: `${key}_company`, label: T('Nama perusahaan / pihak', 'Company / party'), input: 'text', required: true, max: 200, section: caption, ...(vora ? { initial: T('PT Satu Arah International', 'PT Satu Arah International') } : {}) },
    { name: `${key}_name`, label: T('Diwakili oleh (nama)', 'Represented by (name)'), input: 'text', required: true, max: 160 },
    { name: `${key}_position`, label: T('Jabatan', 'Position'), input: 'text', required: true, max: 160 },
    { name: `${key}_address`, label: T('Alamat', 'Address'), input: 'textarea', rows: 2, required: true, max: 400,
      ...(vora ? { initial: T('Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810', 'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810') } : {}) },
  ]
}

const agreementType = (o: { key: string; prefix: string; label: Bi; summary: Bi; subject: Bi; background: Bi; closing: Bi; articles: Record<Lang, Article[]> }): DocumentType => ({
  key: o.key, prefix: o.prefix, family: 'agreement', label: o.label, summary: o.summary, articles: o.articles,
  signers: [{ party: 'first', role: T('PIHAK PERTAMA', 'FIRST PARTY'), box: T('Cap perusahaan', 'Company stamp') }, { party: 'second', role: T('PIHAK KEDUA', 'SECOND PARTY'), box: T('Meterai', 'Stamp duty') }],
  fields: [
    place,
    { name: 'subject', label: T('Judul perjanjian', 'Agreement title'), input: 'text', required: true, max: 200, section: T('Perjanjian', 'Agreement'), initial: o.subject },
    ...agreementParty('first'), ...agreementParty('second'),
    { name: 'background', label: T('Latar belakang (opsional)', 'Background (optional)'), input: 'textarea', rows: 4, max: 3000, section: T('Latar belakang', 'Background'), initial: o.background,
      hint: T('Satu butir per baris. Hapus bila tidak diperlukan.', 'One point per line. Delete it if it is not needed.') },
    { name: 'closing', label: T('Kalimat penutup', 'Closing sentence'), input: 'textarea', rows: 3, required: true, max: 1200, section: T('Penutup', 'Closing'), initial: o.closing },
  ],
})

/** Text still to be completed in a template. An agreement with any of these left in it cannot be issued. */
export const PLACEHOLDER = /\[(isi|fill in):/i

const COOPERATION_ID: Article[] = [
  { title: 'Maksud dan Tujuan', body: 'Perjanjian ini dibuat untuk mengatur kerja sama antara Para Pihak di bidang [isi: bidang kerja sama].' },
  { title: 'Ruang Lingkup', body: 'Ruang lingkup kerja sama meliputi: [isi: uraikan layanan atau kegiatan]. Rincian teknis, tarif dan jadwal dituangkan dalam lampiran atau penawaran harga yang disetujui Para Pihak secara tertulis.' },
  { title: 'Hak dan Kewajiban', body: 'Masing-masing Pihak wajib melaksanakan bagiannya dengan itikad baik, memberikan informasi dan dokumen yang akurat tepat waktu, serta mematuhi peraturan perundang-undangan yang berlaku.' },
  { title: 'Jangka Waktu', body: 'Perjanjian ini berlaku sejak tanggal ditandatangani selama [isi: jangka waktu] dan dapat diperpanjang dengan persetujuan tertulis Para Pihak.' },
  { title: 'Biaya dan Pembayaran', body: 'Biaya dan tata cara pembayaran mengikuti penawaran harga atau lampiran yang disetujui. Pembayaran dilakukan ke rekening yang tercantum pada invoice paling lambat [isi: jumlah] hari sejak invoice diterima.' },
  { title: 'Kerahasiaan', body: 'Para Pihak wajib menjaga kerahasiaan informasi yang diperoleh dari Pihak lain selama dan setelah berakhirnya Perjanjian ini, dan tidak menggunakannya untuk kepentingan di luar Perjanjian ini.' },
  { title: 'Keadaan Memaksa', body: 'Pihak yang terhalang melaksanakan kewajibannya karena keadaan di luar kendali yang wajar wajib memberitahukan Pihak lainnya secara tertulis sesegera mungkin. Kewajiban yang terhalang ditangguhkan selama keadaan tersebut berlangsung.' },
  { title: 'Pengakhiran', body: 'Masing-masing Pihak dapat mengakhiri Perjanjian ini dengan pemberitahuan tertulis paling lambat [isi: jumlah] hari sebelumnya. Kewajiban yang telah timbul sebelum pengakhiran tetap harus diselesaikan.' },
  { title: 'Penyelesaian Perselisihan', body: 'Perselisihan diselesaikan terlebih dahulu secara musyawarah. Bila tidak tercapai kesepakatan, Para Pihak memilih domisili hukum di Pengadilan Negeri [isi: kota].' },
  { title: 'Ketentuan Penutup', body: 'Perubahan atas Perjanjian ini hanya sah bila dibuat tertulis dan ditandatangani Para Pihak. Perjanjian ini dibuat dalam dua rangkap yang masing-masing mempunyai kekuatan hukum yang sama.' },
]
const COOPERATION_EN: Article[] = [
  { title: 'Purpose', body: 'This Agreement sets out the cooperation between the Parties in the field of [fill in: field of cooperation].' },
  { title: 'Scope', body: 'The scope of cooperation covers: [fill in: describe the services or activities]. Technical details, rates and schedules are set out in an annex or a quotation approved by the Parties in writing.' },
  { title: 'Rights and Obligations', body: 'Each Party shall perform its part in good faith, provide accurate information and documents on time, and comply with applicable laws and regulations.' },
  { title: 'Term', body: 'This Agreement takes effect on the date of signing for [fill in: term] and may be extended with the written consent of the Parties.' },
  { title: 'Fees and Payment', body: 'Fees and payment terms follow the approved quotation or annex. Payment is made to the account stated on the invoice within [fill in: number] days of receiving the invoice.' },
  { title: 'Confidentiality', body: 'The Parties shall keep confidential the information obtained from the other Party during and after this Agreement, and shall not use it for any purpose outside this Agreement.' },
  { title: 'Force Majeure', body: 'A Party prevented from performing by circumstances beyond its reasonable control shall notify the other Party in writing as soon as possible. The affected obligations are suspended while the circumstances last.' },
  { title: 'Termination', body: 'Either Party may terminate this Agreement by giving at least [fill in: number] days\' written notice. Obligations that arose before termination remain to be performed.' },
  { title: 'Dispute Resolution', body: 'Disputes shall first be settled by consultation. If no agreement is reached, the Parties choose the domicile of the District Court of [fill in: city].' },
  { title: 'Closing Provisions', body: 'Amendments are valid only if made in writing and signed by the Parties. This Agreement is made in two originals, each with equal legal force.' },
]
const SERVICE_ID: Article[] = [
  { title: 'Ruang Lingkup Layanan', body: 'Pihak Pertama sebagai penyedia jasa menyediakan layanan logistik bagi Pihak Kedua, yaitu: [isi: pilih dan uraikan, mis. freight forwarding udara/laut, kepabeanan, pergudangan, distribusi domestik, project cargo].' },
  { title: 'Pemesanan Layanan', body: 'Setiap pengiriman dipesan melalui penawaran harga yang telah disetujui atau instruksi tertulis Pihak Kedua. Rincian muatan, rute, Incoterms dan jadwal dicantumkan pada pesanan tersebut.' },
  { title: 'Kewajiban Penyedia Jasa', body: 'Pihak Pertama melaksanakan layanan dengan ketelitian yang wajar, menginformasikan perkembangan pengiriman, dan menyerahkan dokumen yang menjadi tanggung jawabnya.' },
  { title: 'Kewajiban Pengguna Jasa', body: 'Pihak Kedua wajib memberikan data dan dokumen yang benar dan lengkap (termasuk deskripsi barang, kode HS, berat, dimensi dan keterangan barang berbahaya bila ada), serta memastikan barang bukan barang terlarang.' },
  { title: 'Tarif dan Pembayaran', body: 'Tarif mengikuti penawaran harga yang disetujui. Pihak Pertama menerbitkan invoice, dan Pihak Kedua membayar paling lambat [isi: jumlah] hari sejak invoice diterima ke rekening yang tercantum pada invoice. Pajak mengikuti peraturan yang berlaku.' },
  { title: 'Tanggung Jawab', body: 'Tanggung jawab Pihak Pertama atas kehilangan atau kerusakan barang dalam penguasaannya diatur menurut peraturan perundang-undangan, konvensi pengangkutan yang berlaku, dan batas yang disepakati: [isi: batas tanggung jawab].' },
  { title: 'Asuransi', body: 'Asuransi muatan dilakukan atas permintaan tertulis Pihak Kedua. Tanpa permintaan tersebut, muatan tidak diasuransikan oleh Pihak Pertama.' },
  { title: 'Keadaan Memaksa', body: 'Keterlambatan atau kegagalan yang disebabkan keadaan di luar kendali yang wajar, termasuk cuaca ekstrem, penutupan pelabuhan atau bandara, dan keputusan otoritas, tidak dianggap pelanggaran Perjanjian. Pihak yang terdampak segera memberitahukan Pihak lainnya.' },
  { title: 'Kerahasiaan', body: 'Para Pihak menjaga kerahasiaan data komersial dan dokumen pengiriman yang diperoleh melalui Perjanjian ini.' },
  { title: 'Jangka Waktu dan Pengakhiran', body: 'Perjanjian ini berlaku selama [isi: jangka waktu] sejak ditandatangani. Masing-masing Pihak dapat mengakhirinya dengan pemberitahuan tertulis [isi: jumlah] hari sebelumnya; pengiriman yang sedang berjalan tetap diselesaikan.' },
  { title: 'Penyelesaian Perselisihan', body: 'Perselisihan diselesaikan secara musyawarah. Bila tidak tercapai kesepakatan, Para Pihak memilih domisili hukum di Pengadilan Negeri [isi: kota].' },
  { title: 'Ketentuan Penutup', body: 'Perubahan atas Perjanjian ini hanya sah bila dibuat tertulis dan ditandatangani Para Pihak. Perjanjian ini dibuat dalam dua rangkap yang masing-masing mempunyai kekuatan hukum yang sama.' },
]
const SERVICE_EN: Article[] = [
  { title: 'Scope of Services', body: 'The First Party, as service provider, supplies logistics services to the Second Party, namely: [fill in: select and describe, e.g. air or sea freight forwarding, customs clearance, warehousing, domestic distribution, project cargo].' },
  { title: 'Ordering', body: 'Each shipment is ordered through an approved quotation or the Second Party\'s written instruction. Cargo details, route, Incoterms and schedule are stated in that order.' },
  { title: 'Obligations of the Service Provider', body: 'The First Party performs the services with reasonable care, keeps the Second Party informed of shipment progress, and delivers the documents it is responsible for.' },
  { title: 'Obligations of the Customer', body: 'The Second Party shall provide correct and complete data and documents (including goods description, HS code, weight, dimensions and dangerous-goods information where applicable) and ensure the goods are not prohibited.' },
  { title: 'Rates and Payment', body: 'Rates follow the approved quotation. The First Party issues an invoice and the Second Party pays within [fill in: number] days of receiving it, to the account stated on the invoice. Taxes follow applicable regulations.' },
  { title: 'Liability', body: 'The First Party\'s liability for loss of or damage to goods in its custody is governed by applicable law, the applicable transport conventions and the agreed limit: [fill in: liability limit].' },
  { title: 'Insurance', body: 'Cargo insurance is arranged on the Second Party\'s written request. Without such a request the cargo is not insured by the First Party.' },
  { title: 'Force Majeure', body: 'Delay or failure caused by circumstances beyond reasonable control, including extreme weather, port or airport closure and orders of authorities, is not a breach of this Agreement. The affected Party shall notify the other without delay.' },
  { title: 'Confidentiality', body: 'The Parties keep confidential the commercial data and shipping documents obtained through this Agreement.' },
  { title: 'Term and Termination', body: 'This Agreement runs for [fill in: term] from signing. Either Party may end it with [fill in: number] days\' written notice; shipments in progress are completed.' },
  { title: 'Dispute Resolution', body: 'Disputes are settled by consultation. If no agreement is reached, the Parties choose the domicile of the District Court of [fill in: city].' },
  { title: 'Closing Provisions', body: 'Amendments are valid only if made in writing and signed by the Parties. This Agreement is made in two originals, each with equal legal force.' },
]
const NDA_ID: Article[] = [
  { title: 'Informasi Rahasia', body: 'Informasi Rahasia adalah seluruh informasi non-publik yang diberikan salah satu Pihak kepada Pihak lain, baik tertulis, lisan maupun elektronik, yang berkaitan dengan [isi: tujuan pengungkapan informasi].' },
  { title: 'Kewajiban Menjaga Kerahasiaan', body: 'Pihak Penerima wajib menjaga kerahasiaan Informasi Rahasia dengan tingkat kehati-hatian yang sama dengan informasinya sendiri, dan tidak mengungkapkannya kepada pihak ketiga tanpa persetujuan tertulis Pihak Pengungkap.' },
  { title: 'Penggunaan Terbatas', body: 'Informasi Rahasia hanya boleh digunakan untuk tujuan yang disebut pada Pasal 1 dan hanya diteruskan kepada karyawan atau penasihat yang membutuhkannya dan terikat kewajiban kerahasiaan yang setara.' },
  { title: 'Pengecualian', body: 'Kewajiban ini tidak berlaku atas informasi yang telah menjadi publik bukan karena pelanggaran, telah diketahui Pihak Penerima secara sah sebelumnya, diperoleh secara sah dari pihak ketiga, atau wajib diungkapkan berdasarkan perintah pengadilan atau otoritas yang berwenang (dengan pemberitahuan kepada Pihak Pengungkap bila diizinkan hukum).' },
  { title: 'Pengembalian dan Pemusnahan', body: 'Atas permintaan tertulis, Pihak Penerima mengembalikan atau memusnahkan Informasi Rahasia dan salinannya, dan menyatakannya secara tertulis.' },
  { title: 'Jangka Waktu', body: 'Perjanjian ini berlaku sejak ditandatangani. Kewajiban kerahasiaan tetap berlaku selama [isi: jumlah] tahun sejak berakhirnya hubungan atau pengungkapan terakhir.' },
  { title: 'Pelanggaran', body: 'Pihak yang melanggar Perjanjian ini bertanggung jawab atas kerugian yang timbul bagi Pihak lain, sesuai ketentuan hukum yang berlaku.' },
  { title: 'Penyelesaian Perselisihan', body: 'Perselisihan diselesaikan secara musyawarah. Bila tidak tercapai kesepakatan, Para Pihak memilih domisili hukum di Pengadilan Negeri [isi: kota].' },
  { title: 'Ketentuan Penutup', body: 'Perubahan atas Perjanjian ini hanya sah bila dibuat tertulis dan ditandatangani Para Pihak. Perjanjian ini dibuat dalam dua rangkap yang masing-masing mempunyai kekuatan hukum yang sama.' },
]
const NDA_EN: Article[] = [
  { title: 'Confidential Information', body: 'Confidential Information means all non-public information that one Party discloses to the other, whether written, oral or electronic, relating to [fill in: purpose of the disclosure].' },
  { title: 'Duty of Confidentiality', body: 'The Receiving Party shall protect the Confidential Information with the same care it applies to its own information and shall not disclose it to any third party without the Disclosing Party\'s written consent.' },
  { title: 'Limited Use', body: 'Confidential Information may be used only for the purpose stated in Article 1 and passed only to employees or advisers who need it and are bound by equivalent confidentiality duties.' },
  { title: 'Exceptions', body: 'These duties do not apply to information that is or becomes public without breach, was lawfully known to the Receiving Party before, is lawfully obtained from a third party, or must be disclosed by order of a court or competent authority (with notice to the Disclosing Party where the law allows).' },
  { title: 'Return and Destruction', body: 'On written request, the Receiving Party shall return or destroy the Confidential Information and all copies and confirm this in writing.' },
  { title: 'Term', body: 'This Agreement takes effect on signing. The confidentiality duties continue for [fill in: number] years after the relationship ends or the last disclosure, whichever is later.' },
  { title: 'Breach', body: 'A Party that breaches this Agreement is liable for the loss caused to the other Party, in accordance with applicable law.' },
  { title: 'Dispute Resolution', body: 'Disputes are settled by consultation. If no agreement is reached, the Parties choose the domicile of the District Court of [fill in: city].' },
  { title: 'Closing Provisions', body: 'Amendments are valid only if made in writing and signed by the Parties. This Agreement is made in two originals, each with equal legal force.' },
]
const AGREEMENT_CLOSING = T('Demikian Perjanjian ini dibuat dan ditandatangani oleh Para Pihak pada hari dan tanggal tersebut di atas dalam keadaan sadar, sehat dan tanpa paksaan dari pihak mana pun.',
  'This Agreement is made and signed by the Parties on the date stated above, of sound mind and without coercion from anyone.')

const sealSelect = (name: string, label: Bi, options: Array<[string, string, string]>, initial: string): FieldDef => ({
  name, label, input: 'select', required: true, max: 20, options: options.map(([value, id, en]) => ({ value, label: T(id, en) })), initial: T(initial, initial),
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
  agreementType({
    key: 'cooperation_agreement', prefix: 'PKS', label: T('Perjanjian Kerja Sama', 'Cooperation agreement'),
    summary: T('Perjanjian kerja sama antara dua pihak: para pihak, latar belakang, pasal-pasal yang bisa diubah, dan kolom tanda tangan dengan kode QR.', 'A cooperation agreement between two parties: the parties, background, editable articles and signature columns with a QR code.'),
    subject: T('Perjanjian Kerja Sama', 'Cooperation Agreement'),
    background: T('1. Pihak Pertama bergerak di bidang jasa logistik dan pengiriman barang.\n2. Pihak Kedua membutuhkan jasa tersebut dan bermaksud bekerja sama dengan Pihak Pertama.', '1. The First Party provides logistics and freight services.\n2. The Second Party requires those services and wishes to cooperate with the First Party.'),
    closing: AGREEMENT_CLOSING, articles: { id: COOPERATION_ID, en: COOPERATION_EN },
  }),
  agreementType({
    key: 'logistics_service_agreement', prefix: 'PLL', label: T('Perjanjian Layanan Logistik', 'Logistics service agreement'),
    summary: T('Perjanjian antara VORA dan pengguna jasa tentang layanan pengiriman, kepabeanan, pergudangan atau distribusi, dengan pasal-pasal yang bisa diubah.', 'An agreement between VORA and a customer for freight, customs, warehousing or distribution services, with editable articles.'),
    subject: T('Perjanjian Layanan Logistik', 'Logistics Service Agreement'),
    background: T('1. Pihak Pertama adalah perusahaan penyedia jasa logistik.\n2. Pihak Kedua bermaksud menggunakan jasa logistik Pihak Pertama.', '1. The First Party is a logistics service provider.\n2. The Second Party wishes to use the First Party\'s logistics services.'),
    closing: AGREEMENT_CLOSING, articles: { id: SERVICE_ID, en: SERVICE_EN },
  }),
  agreementType({
    key: 'nda', prefix: 'NDA', label: T('Perjanjian Kerahasiaan (NDA)', 'Non-disclosure agreement (NDA)'),
    summary: T('Perjanjian untuk menjaga kerahasiaan informasi yang dipertukarkan dua pihak, dengan pasal-pasal yang bisa diubah.', 'An agreement to keep information exchanged between two parties confidential, with editable articles.'),
    subject: T('Perjanjian Kerahasiaan', 'Non-Disclosure Agreement'),
    background: T('Para Pihak akan saling bertukar informasi yang bersifat rahasia dalam rangka pembicaraan kerja sama dan sepakat untuk melindungi informasi tersebut.', 'The Parties will exchange confidential information in the course of discussing cooperation and agree to protect it.'),
    closing: AGREEMENT_CLOSING, articles: { id: NDA_ID, en: NDA_EN },
  }),
  {
    key: 'seal', prefix: 'SEL', family: 'seal', label: T('Segel QR pada Dokumen Pihak Lain', 'QR seal on a third-party document'),
    summary: T('Unggah PDF yang diterbitkan pihak lain secara digital; VORA membubuhkan kode QR pengesahan beserta nama penandatangan. Pemindai QR melihat keaslian dan sidik jari (SHA-256) berkas.', 'Upload a PDF issued digitally by another party; VORA adds a QR code of endorsement with the signatory\'s name. Scanning the QR shows its authenticity and the file\'s fingerprint (SHA-256).'),
    fields: [
      { name: 'source_title', label: T('Judul / jenis dokumen', 'Document title / type'), input: 'text', required: true, max: 160, section: T('Dokumen yang disahkan', 'Document to be sealed'), hint: T('Tampil di halaman verifikasi publik.', 'Shown on the public verification page.') },
      { name: 'source_issuer', label: T('Diterbitkan oleh (pihak lain)', 'Issued by (the other party)'), input: 'text', required: true, max: 160, hint: T('Tampil di halaman verifikasi publik.', 'Shown on the public verification page.') },
      { name: 'source_reference', label: T('Nomor dokumen asal', 'Number of the original document'), input: 'text', max: 100, hint: T('Tampil di halaman verifikasi publik.', 'Shown on the public verification page.') },
      { name: 'signatory_name', label: T('Nama penandatangan VORA', 'VORA signatory name'), input: 'text', required: true, max: 160, section: T('Pengesahan', 'Endorsement') },
      { name: 'signatory_title', label: T('Jabatan penandatangan', 'Signatory position'), input: 'text', required: true, max: 160 },
      sealSelect('purpose', T('Makna pengesahan', 'Meaning of the endorsement'), [['verified', 'Diperiksa dan disahkan', 'Checked and endorsed'], ['approved', 'Disetujui', 'Approved'], ['acknowledged', 'Diketahui', 'Acknowledged']], 'verified'),
      { ...sealSelect('pages', T('Halaman yang diberi segel', 'Pages that carry the seal'), [['last', 'Halaman terakhir', 'Last page'], ['first', 'Halaman pertama', 'First page'], ['all', 'Semua halaman', 'Every page'], ['one', 'Satu halaman pilihan', 'One page I choose']], 'last'), hidden: true },
      { name: 'page_number', label: T('Nomor halaman', 'Page number'), input: 'text', max: 3, hidden: true },
      { ...sealSelect('corner', T('Posisi segel', 'Position of the seal'), [['bottom-right', 'Kanan bawah', 'Bottom right'], ['bottom-left', 'Kiri bawah', 'Bottom left'], ['top-right', 'Kanan atas', 'Top right'], ['top-left', 'Kiri atas', 'Top left'], ['custom', 'Digeser sendiri', 'Dragged by hand']], 'bottom-right'), hidden: true },
      { name: 'pos_x', label: T('Posisi mendatar', 'Horizontal position'), input: 'text', max: 8, hidden: true },
      { name: 'pos_y', label: T('Posisi tegak', 'Vertical position'), input: 'text', max: 8, hidden: true },
      { ...sealSelect('size', T('Ukuran segel', 'Size of the seal'), [['medium', 'Sedang', 'Medium'], ['small', 'Kecil', 'Small']], 'medium'), hidden: true },
    ],
  },
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
  regards: T('Hormat kami,', 'Sincerely,'), issuedByVora: T('Diterbitkan oleh VORA', 'Issued by VORA'),
  verifyHow: T('Penerbitan dan status dokumen ini diperiksa melalui tautan dan kode QR verifikasi di bawah. Kode QR bukan tanda tangan pribadi.', 'The issuance and status of this document are checked through the verification link and QR code below. The QR code is not a personal signature.'),
  verifyTitle: T('VERIFIKASI DOKUMEN', 'DOCUMENT VERIFICATION'), signHere: T('Tanda tangan / cap', 'Signature / stamp'), copyTo: T('Tembusan', 'Copy to'), validUntil: T('Berlaku sampai', 'Valid until'),
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
