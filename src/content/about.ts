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
  cta: { quote: { en: 'Request a quote', id: 'Minta penawaran' } },
  hint: { hero: { en: 'Click VORA to reveal our line.', id: 'Klik VORA untuk melihat semboyan kami.' }, hintTouch: { en: 'Tap VORA to reveal our line.', id: 'Ketuk VORA untuk melihat semboyan kami.' } },
  manifesto: {
    label: { en: 'How VORA works', id: 'Cara kerja VORA' },
    words: {
      en: 'Capabilities and coverage are confirmed for each inquiry. The scope is written down. Every step has a name next to it.',
      id: 'Kami memastikan kapabilitas dan jangkauan untuk setiap permintaan. Cakupan pekerjaan dituliskan. Setiap langkah ada penanggung jawabnya.',
    },
  },
}

export const FOUNDER = {
  label: { en: 'Why VORA exists', id: 'Mengapa VORA ada' },
  title: { en: 'The same problems kept coming back.', id: 'Masalahnya selalu berulang.' },
  lead: {
    en: 'VORA was started by a professional with more than ten years in freight forwarding, logistics and cargo.',
    id: 'VORA didirikan oleh seorang profesional yang sudah lebih dari sepuluh tahun bekerja di freight forwarding, logistik, dan kargo.',
  },
  body: {
    en: 'In that time the same problems came back, shipment after shipment. Most of them had little to do with the truck or the vessel. They came from what happened around the cargo: who had agreed to what, which document said what, and who was meant to act next.',
    id: 'Selama itu, masalah yang sama muncul lagi dan lagi, dari satu pengiriman ke pengiriman berikutnya. Sebagian besar tidak ada hubungannya dengan truk atau kapal. Masalahnya ada di sekitar barang: siapa menyepakati apa, dokumen mana menyebut apa, dan siapa yang harus bergerak berikutnya.',
  },
  choose: {
    en: 'VORA is the founder’s answer to six of them. Select a problem to see what we do about it.',
    id: 'VORA adalah jawaban founder untuk enam di antaranya. Pilih satu masalah untuk melihat apa yang kami lakukan.',
  },
  problemLabel: { en: 'What went wrong', id: 'Yang bermasalah' },
  answerLabel: { en: 'What VORA does', id: 'Yang kami lakukan' },
  closed: { en: 'Closed', id: 'Teratasi' },
  open: { en: 'Open', id: 'Terbuka' },
  items: [
    {
      title: { en: 'Quote and bill', id: 'Penawaran dan tagihan' },
      problem: { en: 'The quote and the final bill did not match, and the difference was hard to explain.', id: 'Penawaran dan tagihan akhir tidak cocok, dan selisihnya sulit dijelaskan.' },
      answer: {
        en: 'The scope is written down before the cargo moves: what is included, what is not, and what still depends on the final facts of the shipment.',
        id: 'Cakupan pekerjaan kami tuliskan sebelum barang bergerak: apa yang termasuk, apa yang tidak, dan apa yang masih bergantung pada kondisi akhir pengiriman.',
      },
    },
    {
      title: { en: 'Handoffs', id: 'Serah terima' },
      problem: {
        en: 'The forwarder, the broker, the trucker and the warehouse each did their part, and the shipment still stalled between them.',
        id: 'Forwarder, broker, pengangkut, dan gudang sudah mengerjakan bagian masing-masing, tetapi pengiriman tetap tersendat di sela-sela mereka.',
      },
      answer: {
        en: 'Responsibilities and milestones are lined up before the move starts, and each step has a named party behind it.',
        id: 'Sebelum pengiriman dimulai, kami selaraskan tanggung jawab dan tahapannya, dan setiap langkah punya penanggung jawab yang jelas.',
      },
    },
    {
      title: { en: 'Updates', id: 'Kabar perkembangan' },
      problem: { en: 'Updates came late, or only after someone chased for them.', id: 'Kabar perkembangan datang terlambat, atau baru datang setelah ditanya.' },
      answer: {
        en: 'Milestones and the way we communicate are agreed before the move starts, so you hear from us at the points we named.',
        id: 'Tahapan dan cara berkomunikasi kami sepakati sebelum pengiriman mulai, sehingga kabar datang pada titik yang sudah ditentukan.',
      },
    },
    {
      title: { en: 'Customs', id: 'Kepabeanan' },
      problem: { en: 'Permit and customs requirements turned up late, when the cargo was already moving.', id: 'Syarat izin dan kepabeanan baru muncul belakangan, ketika barang sudah berjalan.' },
      answer: {
        en: 'Documents, permits and restrictions are reviewed in the validate step, and the ones that apply are confirmed before we commit.',
        id: 'Dokumen, izin, dan pembatasan barang kami tinjau di langkah validasi, dan yang berlaku kami pastikan sebelum kami menyanggupi.',
      },
    },
    {
      title: { en: 'Promises', id: 'Janji' },
      problem: {
        en: 'Capacity and coverage were promised before anyone had checked them for that cargo on that route.',
        id: 'Kapasitas dan jangkauan sudah dijanjikan, padahal belum ada yang memeriksanya untuk barang dan rute itu.',
      },
      answer: {
        en: 'Capabilities and coverage are confirmed for each inquiry. If something cannot be done, that is said at the start.',
        id: 'Kapabilitas dan jangkauan kami pastikan untuk setiap permintaan. Kalau ada yang tidak bisa kami kerjakan, kami katakan sejak awal.',
      },
    },
    {
      title: { en: 'Paperwork', id: 'Dokumen' },
      problem: {
        en: 'The invoice, the packing list and the transport document described the same cargo in different words.',
        id: 'Invoice, packing list, dan dokumen angkutan menguraikan barang yang sama dengan kata yang berbeda-beda.',
      },
      answer: {
        en: 'We ask for the goods in plain words, with the HS code, at the start, so that the paperwork describes one cargo.',
        id: 'Sejak awal kami minta uraian barang dalam bahasa sehari-hari, lengkap dengan kode HS, supaya semua dokumen menguraikan satu barang yang sama.',
      },
    },
  ],
  after: {
    en: 'The three steps we follow, understand, validate and coordinate, are these problems turned into a way of working.',
    id: 'Tiga langkah kerja kami (pahami, validasi, koordinasikan) lahir dari masalah-masalah ini.',
  },
  byline: { en: 'Founder, VORA', id: 'Founder VORA' },
}

export const CAPABILITIES = {
  label: { en: 'What we coordinate', id: 'Yang kami koordinasikan' },
  title: { en: 'Five services, one way of working.', id: 'Lima layanan, satu cara kerja.' },
  body: { en: 'Choose one. Coverage and capability are confirmed for each inquiry.', id: 'Pilih salah satu. Jangkauan dan kapabilitas kami pastikan untuk setiap permintaan.' },
  more: { en: 'Read more about this service', id: 'Baca lebih lanjut tentang layanan ini' },
}

export const COMMITMENTS = {
  label: { en: 'How we work', id: 'Cara kami bekerja' },
  title: { en: 'Three steps, in this order.', id: 'Tiga langkah, berurutan.' },
  hint: { en: 'Press a step to build the mark.', id: 'Tekan salah satu langkah untuk menyusun logonya.' },
  steps: [
    { title: { en: 'Understand', id: 'Pahami' }, text: { en: 'Identify shipment, cargo and commercial requirements.', id: 'Kami petakan kebutuhan pengiriman, kargo, dan komersialnya.' } },
    { title: { en: 'Validate', id: 'Validasi' }, text: { en: 'Assess applicable routing, handling and documentation options.', id: 'Kami tinjau pilihan rute, penanganan, dan dokumen yang berlaku.' } },
    { title: { en: 'Coordinate', id: 'Koordinasikan' }, text: { en: 'Align responsibilities, milestones and communication.', id: 'Kami selaraskan tanggung jawab, tahapan, dan cara berkomunikasi.' } },
  ],
  chips: [
    { en: 'Clear scope', id: 'Cakupan yang jelas' },
    { en: 'Named responsibilities', id: 'Penanggung jawab yang disebut' },
    { en: 'Open conversation about requirements', id: 'Terbuka soal kebutuhan pengiriman' },
    { en: 'Confirmed, not asserted', id: 'Dipastikan, bukan sekadar diklaim' },
  ],
}

export const COMPANY = {
  label: { en: 'Who is behind VORA', id: 'Siapa di balik VORA' },
  title: { en: 'The company behind the brand.', id: 'Perusahaan di balik brand ini.' },
  body: {
    en: 'VORA is operated by PT Satu Arah International in Jakarta. Send us the cargo, the route and the date, and we reply with what we can confirm.',
    id: 'VORA dijalankan oleh PT Satu Arah International di Jakarta. Kirimkan barang, rute, dan tanggalnya, dan kami jawab dengan apa yang bisa kami pastikan.',
  },
  note: {
    en: 'Our quotations, invoices, delivery notes and payment receipts carry a QR code. Scan it to see the record of that document.',
    id: 'Penawaran, invoice, surat jalan, dan tanda terima pembayaran kami memuat kode QR. Pindai untuk melihat catatan dokumen itu.',
  },
}

export const MEMORY = {
  tagline: 'Bringing the World Within Reach.',
  body: { en: 'VORA is a logistics brand operated by PT Satu Arah International in Jakarta.', id: 'VORA adalah brand logistik di bawah PT Satu Arah International, Jakarta.' },
  hint: { en: 'Move across the marks. Press to send a wave.', id: 'Gerakkan kursor di atas logo-logo ini, atau tekan untuk mengirim gelombang.' },
}
