import type { Locale } from './index'

/**
 * What to write in the cargo box of a quotation request, by service. Shown under the box once a service is chosen; nothing here is required
 * and nothing is a promise about price or time. Units are written out because the commonest reason for a second question is a missing unit.
 */
export const rfqGuidance: Record<string, Record<Locale, string[]>> = {
  _default: {
    en: ['What the goods are (a plain description, not only a product code).', 'Number of packages and how they are packed (cartons, pallets, crates, loose).', 'Gross weight in kg and the size of each package in cm (L × W × H), or the total volume in cbm.', 'The date the cargo is ready and anything that limits access at pickup or delivery.'],
    id: ['Jenis barang (deskripsi singkat, bukan hanya kode produk).', 'Jumlah kemasan dan cara pengemasannya (karton, pallet, peti, curah).', 'Berat kotor dalam kg dan ukuran tiap kemasan dalam cm (P × L × T), atau total volume dalam cbm.', 'Tanggal barang siap dan kendala akses di lokasi penjemputan atau pengantaran.'],
  },
  'international-freight-forwarding': {
    en: ['Air or ocean, import or export, and the Incoterm agreed with the other party if there is one.', 'For ocean: FCL (container type and quantity) or LCL (cbm and kg).', 'For air: gross weight and package dimensions, because the charge follows the greater of actual and volumetric weight.', 'Whether the quotation should cover origin pickup, destination delivery and customs coordination, or only the main leg.'],
    id: ['Udara atau laut, impor atau ekspor, dan Incoterm yang disepakati dengan pihak lawan bila ada.', 'Untuk laut: FCL (tipe dan jumlah kontainer) atau LCL (cbm dan kg).', 'Untuk udara: berat kotor dan dimensi kemasan, karena biaya mengikuti yang lebih besar antara berat aktual dan berat volumetrik.', 'Apakah quotation perlu mencakup penjemputan di asal, pengantaran di tujuan, dan koordinasi kepabeanan, atau hanya pengiriman utama.'],
  },
  'customs-brokerage': {
    en: ['Import or export, and the port or airport of entry or exit.', 'The goods in plain words, plus the HS code you were given, marked as supplier-suggested or already confirmed.', 'Which documents you already have: commercial invoice, packing list, transport document, certificates or permits.', 'Any earlier question from the authorities about this product.'],
    id: ['Impor atau ekspor, dan pelabuhan atau bandara masuk atau keluar.', 'Barang dalam bahasa sederhana, beserta kode HS yang Anda terima, ditandai sebagai usulan pemasok atau sudah dikonfirmasi.', 'Dokumen yang sudah ada: commercial invoice, packing list, dokumen angkutan, sertifikat atau izin.', 'Pertanyaan sebelumnya dari instansi terkait tentang produk ini, bila ada.'],
  },
  '3pl-warehousing': {
    en: ['What is stored: number of SKUs, storage unit (pallet, carton, loose) and the size of a typical unit.', 'How goods arrive and leave: receipts and dispatches per week, order lines per day.', 'Special conditions: temperature, stacking limits, batch or expiry tracking.', 'The reports you need and the system the stock records must connect to, if any.'],
    id: ['Apa yang disimpan: jumlah SKU, satuan penyimpanan (pallet, karton, curah) dan ukuran satuan yang umum.', 'Arus barang: jumlah penerimaan dan pengiriman per minggu, jumlah order line per hari.', 'Kondisi khusus: suhu, batas tumpukan, pelacakan batch atau tanggal kedaluwarsa.', 'Laporan yang dibutuhkan dan sistem yang harus terhubung dengan catatan stok, bila ada.'],
  },
  'domestic-distribution': {
    en: ['Pickup and delivery addresses at city level, and the access at each (dock, ramp, size limits for vehicles).', 'FTL: the vehicle body you need. LTL: number of pallets or cartons and their size. FCL or LCL: container type or cbm.', 'The pickup window and the delivery window you need, and who loads and unloads.', 'Whether a signed proof of delivery is required and who signs it.'],
    id: ['Alamat penjemputan dan pengantaran sampai tingkat kota, dan kondisi akses di tiap lokasi (dock, ramp, batas ukuran kendaraan).', 'FTL: jenis bak kendaraan. LTL: jumlah pallet atau karton dan ukurannya. FCL atau LCL: tipe kontainer atau cbm.', 'Jendela waktu penjemputan dan pengantaran, serta siapa yang memuat dan membongkar.', 'Apakah bukti serah terima bertanda tangan diperlukan dan siapa yang menandatangani.'],
  },
  'project-cargo': {
    en: ['Overall length, width, height and the mass of each piece, with the drawing or datasheet attached if you have it (send it by email after the inquiry).', 'Centre of gravity and lifting or lashing points as shown on the drawing.', 'The route constraints you already know: site access, ground bearing limits, height or width limits.', 'The date window and the party responsible for lifting at each end.'],
    id: ['Panjang, lebar, tinggi, dan massa tiap unit, dengan gambar teknis atau datasheet bila ada (kirim lewat email setelah permintaan ini).', 'Titik berat serta titik angkat atau pengikatan sesuai gambar.', 'Kendala rute yang sudah diketahui: akses lokasi, batas daya dukung tanah, batas tinggi atau lebar.', 'Jendela waktu dan pihak yang bertanggung jawab atas pengangkatan di masing-masing ujung.'],
  },
}

export const guidanceFor = (mode: string, locale: Locale): string[] => (rfqGuidance[mode.split('/')[0]] ?? rfqGuidance._default)[locale]
