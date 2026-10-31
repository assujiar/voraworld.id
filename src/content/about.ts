import type { Locale } from './index'

/**
 * The words of the About page, English and Bahasa Indonesia side by side. House rules for this copy (and for any edit of it): plain sentences with concrete nouns; nothing that
 * cannot be shown (no size, age, coverage, client, result or price); no superlatives and no "journey"; a commitment is only written if the page already behaves that way.
 * The founder is not named and no story is invented beyond what is known: more than ten years in freight forwarding, logistics and cargo, and the problems that work kept showing.
 * To add the founder's name or a real episode, edit FOUNDER below.
 */
export interface Bi { en: string; id: string }
export const pick = (b: Bi, locale: Locale) => b[locale]

export const ABOUT = {
  eyebrow: { en: 'About VORA', id: 'Tentang VORA' },
  cta: { quote: { en: 'Request a quote', id: 'Minta penawaran' }, verify: { en: 'See how we verify', id: 'Lihat cara kami memverifikasi' } },
  hint: { hero: { en: 'Move over the logo. Press it.', id: 'Gerakkan kursor di atas logo. Tekan.' }, hintTouch: { en: 'Touch the logo.', id: 'Sentuh logonya.' } },
  manifesto: {
    label: { en: 'How VORA works', id: 'Cara VORA bekerja' },
    words: {
      en: 'Capabilities and coverage are confirmed for each inquiry. The scope is written down. Every step has a name next to it.',
      id: 'Kapabilitas dan jangkauan dikonfirmasi untuk setiap permintaan. Cakupannya ditulis. Setiap langkah ada penanggung jawabnya.',
    },
  },
}

export const FOUNDER = {
  label: { en: 'Why VORA exists', id: 'Mengapa VORA ada' },
  title: { en: 'The same problems kept coming back.', id: 'Masalah yang sama terus kembali.' },
  lead: {
    en: 'VORA was started by a professional with more than ten years in freight forwarding, logistics and cargo.',
    id: 'VORA didirikan oleh seorang profesional dengan pengalaman lebih dari sepuluh tahun di freight forwarding, logistik, dan kargo.',
  },
  body: {
    en: 'In that time the same problems came back, shipment after shipment. Most of them had little to do with the truck or the vessel. They came from what happened around the cargo: who had agreed to what, which document said what, and who was meant to act next.',
    id: 'Selama itu, masalah yang sama terus muncul di pengiriman demi pengiriman. Sebagian besar tidak berkaitan dengan truk atau kapalnya. Asalnya dari apa yang terjadi di sekitar barang: siapa menyepakati apa, dokumen mana menyebut apa, dan siapa yang harus bertindak berikutnya.',
  },
  choose: {
    en: 'VORA is the founder’s answer to four of them. Select a problem to see what we do about it.',
    id: 'VORA adalah jawaban founder untuk empat di antaranya. Pilih satu masalah untuk melihat apa yang kami lakukan.',
  },
  problemLabel: { en: 'What went wrong', id: 'Yang bermasalah' },
  answerLabel: { en: 'What VORA does', id: 'Yang dilakukan VORA' },
  closed: { en: 'Closed', id: 'Teratasi' },
  open: { en: 'Open', id: 'Terbuka' },
  items: [
    {
      title: { en: 'Quote and bill', id: 'Penawaran dan tagihan' },
      problem: { en: 'The quote and the final bill did not match, and the difference was hard to explain.', id: 'Penawaran dan tagihan akhir tidak sama, dan selisihnya sulit dijelaskan.' },
      answer: {
        en: 'The scope is written down before the cargo moves: what is included, what is not, and what still depends on the final facts of the shipment.',
        id: 'Cakupan ditulis sebelum barang bergerak: apa yang termasuk, apa yang tidak, dan apa yang masih bergantung pada fakta akhir pengiriman.',
      },
    },
    {
      title: { en: 'Documents', id: 'Dokumen' },
      problem: {
        en: 'The invoice, the packing list and the transport document described the same cargo in different words.',
        id: 'Invoice, packing list, dan dokumen angkutan menyebut barang yang sama dengan kata-kata berbeda.',
      },
      answer: {
        en: 'We ask for the goods in plain words, with the HS code, at the start. Every document VORA issues carries a QR code that opens its public verification page.',
        id: 'Kami meminta uraian barang dengan kata yang jelas beserta kode HS di awal. Setiap dokumen yang diterbitkan VORA memuat kode QR yang membuka halaman verifikasi publiknya.',
      },
    },
    {
      title: { en: 'Handoffs', id: 'Serah terima' },
      problem: {
        en: 'The forwarder, the broker, the trucker and the warehouse each did their part, and the shipment still stalled between them.',
        id: 'Forwarder, broker, pengangkut, dan gudang masing-masing mengerjakan bagiannya, tetapi pengiriman tetap macet di antara mereka.',
      },
      answer: {
        en: 'Responsibilities and milestones are lined up before the move starts, and each step has a named party behind it.',
        id: 'Tanggung jawab dan tahapan diselaraskan sebelum pengiriman mulai, dan setiap langkah punya pihak yang disebut namanya.',
      },
    },
    {
      title: { en: 'Promises', id: 'Janji' },
      problem: {
        en: 'Capacity and coverage were promised before anyone had checked them for that cargo on that route.',
        id: 'Kapasitas dan jangkauan dijanjikan sebelum ada yang memeriksanya untuk barang dan rute tersebut.',
      },
      answer: {
        en: 'Capabilities and coverage are confirmed for each inquiry. If something cannot be done, that is said at the start.',
        id: 'Kapabilitas dan jangkauan dikonfirmasi untuk setiap permintaan. Jika sesuatu tidak bisa dikerjakan, itu disampaikan di awal.',
      },
    },
  ],
  after: {
    en: 'The three steps we follow, understand, validate and coordinate, are these four problems turned into a way of working.',
    id: 'Tiga langkah yang kami jalani, pahami, validasi, dan koordinasikan, adalah keempat masalah ini yang dijadikan cara kerja.',
  },
  byline: { en: 'Founder, VORA', id: 'Founder VORA' },
}

export const CAPABILITIES = {
  label: { en: 'What we coordinate', id: 'Yang kami koordinasikan' },
  title: { en: 'Five services, one way of working.', id: 'Lima layanan, satu cara kerja.' },
  body: { en: 'Choose one. Coverage and capability are confirmed for each inquiry.', id: 'Pilih satu. Jangkauan dan kapabilitas dikonfirmasi untuk setiap permintaan.' },
  more: { en: 'Read more about this service', id: 'Baca selengkapnya tentang layanan ini' },
}

export const COMMITMENTS = {
  label: { en: 'How we work', id: 'Cara kami bekerja' },
  title: { en: 'Three steps, in this order.', id: 'Tiga langkah, dalam urutan ini.' },
  hint: { en: 'Press a step to build the mark.', id: 'Tekan satu langkah untuk menyusun logonya.' },
  steps: [
    { title: { en: 'Understand', id: 'Pahami' }, text: { en: 'Identify shipment, cargo and commercial requirements.', id: 'Identifikasi kebutuhan pengiriman, kargo, dan komersial.' } },
    { title: { en: 'Validate', id: 'Validasi' }, text: { en: 'Assess applicable routing, handling and documentation options.', id: 'Tinjau pilihan rute, penanganan, dan dokumen yang berlaku.' } },
    { title: { en: 'Coordinate', id: 'Koordinasikan' }, text: { en: 'Align responsibilities, milestones and communication.', id: 'Selaraskan tanggung jawab, tahapan, dan komunikasi.' } },
  ],
  chips: [
    { en: 'Clear scope', id: 'Cakupan yang jelas' },
    { en: 'Named responsibilities', id: 'Tanggung jawab yang disebut' },
    { en: 'Open conversation about requirements', id: 'Percakapan terbuka tentang kebutuhan' },
    { en: 'Confirmed, not asserted', id: 'Dikonfirmasi, bukan sekadar diklaim' },
  ],
}

export const TRUST = {
  label: { en: 'Verification', id: 'Verifikasi' },
  title: { en: 'Every document can be checked.', id: 'Setiap dokumen bisa diperiksa.' },
  body: {
    en: 'Every document VORA issues carries a QR code and a link to a public verification page. The page shows the record of that document and its current status.',
    id: 'Setiap dokumen yang diterbitkan VORA memuat kode QR dan tautan ke halaman verifikasi publik. Halaman itu menampilkan catatan dokumen tersebut dan statusnya saat ini.',
  },
  body2: {
    en: 'You can also check a PDF you hold against the record. The check runs in your browser and the file is not uploaded.',
    id: 'Anda juga bisa mencocokkan PDF yang Anda pegang dengan catatannya. Pemeriksaan berjalan di browser Anda dan berkas tidak diunggah.',
  },
  scan: { en: 'Scan the QR code', id: 'Pindai kode QR' },
  caption: { en: 'Illustration. A real document opens its own record.', id: 'Ilustrasi. Dokumen asli membuka catatannya sendiri.' },
  who: { en: 'Who is behind VORA', id: 'Siapa di balik VORA' },
}

export const MEMORY = {
  tagline: 'Bringing the World Within Reach.',
  body: { en: 'VORA is a logistics brand operated by PT Satu Arah International in Jakarta.', id: 'VORA adalah brand logistik di bawah PT Satu Arah International, Jakarta.' },
  hint: { en: 'Move across the marks. Press to send a wave.', id: 'Gerakkan kursor di atas logo-logo ini. Tekan untuk mengirim gelombang.' },
}
