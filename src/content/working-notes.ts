import type { Locale } from './index'

/** Short reference notes for the Insights page while the archive articles are not yet published. Plain checklists, no claims about VORA's operations. */
export const workingNotes: Array<{ id: string; title: Record<Locale, string>; items: Record<Locale, string[]> }> = [
  {
    id: 'brief',
    title: { en: 'A shipment brief that can be quoted', id: 'Brief pengiriman yang bisa dihitung' },
    items: {
      en: ['Goods in plain words, with the packing: cartons, pallets, crates or loose.', 'Gross weight in kg and the size of each package in cm.', 'Origin and destination, and the access at both ends.', 'The date the cargo is ready and the agreed trade term.', 'What the quotation should cover, and what stays with another party.'],
      id: ['Barang dalam bahasa sederhana, beserta kemasannya: karton, pallet, peti, atau curah.', 'Berat kotor dalam kg dan ukuran tiap kemasan dalam cm.', 'Asal dan tujuan, serta kondisi akses di kedua ujung.', 'Tanggal barang siap dan term perdagangan yang disepakati.', 'Apa yang perlu tercakup dalam penawaran, dan apa yang tetap di pihak lain.'],
    },
  },
  {
    id: 'documents',
    title: { en: 'Documents to line up before arrival', id: 'Dokumen yang disiapkan sebelum barang tiba' },
    items: {
      en: ['Commercial invoice and packing list that describe the goods the same way.', 'The transport document, and the names on it matching the invoice.', 'Importer identity details held by the party who will declare.', 'Permits or certificates the product may need, asked about early.', 'The HS code you were given, marked as suggested or confirmed.'],
      id: ['Commercial invoice dan packing list yang menggambarkan barang dengan cara yang sama.', 'Dokumen angkutan, dengan nama yang sesuai dengan invoice.', 'Data identitas importir pada pihak yang akan melakukan pemberitahuan.', 'Izin atau sertifikat yang mungkin dibutuhkan produk, ditanyakan sejak awal.', 'Kode HS yang Anda terima, ditandai sebagai usulan atau sudah dikonfirmasi.'],
    },
  },
  {
    id: 'handover',
    title: { en: 'Questions to settle before a handover', id: 'Hal yang disepakati sebelum serah terima' },
    items: {
      en: ['Who loads, who unloads and who checks the count.', 'Which condition the goods are accepted in, and how an exception is recorded.', 'Who signs for the receiver and what identification they show.', 'Which photographs are taken at pickup and at delivery.', 'Whom to call when the window is missed.'],
      id: ['Siapa yang memuat, siapa yang membongkar, dan siapa yang memeriksa jumlah.', 'Dalam kondisi apa barang diterima, dan bagaimana pengecualian dicatat.', 'Siapa yang menandatangani atas nama penerima dan identitas apa yang ditunjukkan.', 'Foto apa saja yang diambil saat penjemputan dan pengantaran.', 'Siapa yang dihubungi bila jendela waktu terlewat.'],
    },
  },
]
