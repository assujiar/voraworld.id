import type { Locale } from './index'

/**
 * What each service page asks the visitor to prepare, and (warehousing) the stages of the flow. These are requirements for a quotation, not claims
 * about capacity or coverage: nothing here promises a rate, a transit time or a location.
 */
export interface ServiceExtras { needsTitle: string; needs: string[]; flowTitle?: string; flow?: Array<[string, string]> }

export const serviceExtras: Record<string, Record<Locale, ServiceExtras>> = {
  'international-freight-forwarding': {
    en: { needsTitle: 'What a quotation needs from you', needs: ['What the cargo is, with weight, dimensions and packing', 'Origin and destination, and whether it is an import or an export', 'The Incoterm and any trade terms already agreed with the other party', 'The dates the cargo is ready and the date it must arrive', 'The commercial invoice and packing list, if they exist yet'] },
    id: { needsTitle: 'Yang kami butuhkan untuk membuat penawaran', needs: ['Jenis barang, beserta berat, dimensi, dan kemasannya', 'Asal dan tujuan, serta apakah ini impor atau ekspor', 'Incoterm dan ketentuan dagang yang sudah disepakati dengan pihak lawan', 'Tanggal barang siap dan tanggal barang harus tiba', 'Commercial invoice dan packing list, bila sudah ada'] },
  },
  'customs-brokerage': {
    en: { needsTitle: 'What we check before filing', needs: ['Commercial invoice, packing list and the transport document (bill of lading or air waybill)', 'The HS classification of each item, and whether it is already agreed', 'Permits, licences or import restrictions that apply to the goods', 'Who the importer or exporter of record is, with the tax identity', 'The value, currency and Incoterm declared on the documents'] },
    id: { needsTitle: 'Yang kami periksa sebelum pengajuan', needs: ['Commercial invoice, packing list, dan dokumen angkut (bill of lading atau air waybill)', 'Klasifikasi HS tiap barang, dan apakah sudah disepakati', 'Izin, lisensi, atau pembatasan impor yang berlaku untuk barang tersebut', 'Siapa importir atau eksportir yang tercatat, beserta identitas pajaknya', 'Nilai, mata uang, dan Incoterm yang tertulis pada dokumen'] },
  },
  '3pl-warehousing': {
    en: {
      needsTitle: 'What we ask before proposing a layout',
      needs: ['What is stored, and any condition it needs (temperature, stacking, hazard class)', 'Pallets or cartons in storage, and how that is expected to change', 'How often goods arrive and leave, and in what lot sizes', 'For fulfilment: orders per day and lines per order', 'The stock reports or system access you expect to have'],
      flowTitle: 'The flow we plan around',
      flow: [['Receive', 'Goods arrive, are counted against the notice and checked for damage.'], ['Store', 'Each lot is put away in a location that is recorded.'], ['Pick and pack', 'Each order is picked, then packed the way you specified.'], ['Dispatch', 'Packed orders are handed to the carrier, with the handover recorded.']],
    },
    id: {
      needsTitle: 'Yang kami tanyakan sebelum mengusulkan tata letak',
      needs: ['Apa yang disimpan, dan kondisi yang diperlukan (suhu, tumpukan, kelas bahaya)', 'Jumlah pallet atau karton yang disimpan, dan perkiraan perubahannya', 'Seberapa sering barang masuk dan keluar, dan dalam ukuran lot berapa', 'Untuk fulfilment: jumlah pesanan per hari dan baris per pesanan', 'Laporan stok atau akses sistem yang Anda harapkan'],
      flowTitle: 'Alur yang kami rencanakan',
      flow: [['Terima', 'Barang tiba, dihitung terhadap pemberitahuan, dan diperiksa kerusakannya.'], ['Simpan', 'Setiap lot ditempatkan di lokasi yang dicatat.'], ['Ambil dan kemas', 'Pesanan diambil dari stok dan dikemas sesuai instruksi Anda.'], ['Kirim', 'Pesanan yang dikemas diserahkan ke pengangkut, dengan serah terima yang dicatat.']],
    },
  },
  'domestic-distribution': {
    en: { needsTitle: 'What we need to choose the mode', needs: ['Pickup and delivery addresses, with the contact at each', 'Dimensions, weight and packing of the cargo', 'The window in which the cargo must be picked up and delivered', 'Loading and unloading limits at both ends (dock, forklift, access hours)', 'Whether proof of delivery must reach you on the same day'] },
    id: { needsTitle: 'Yang kami butuhkan untuk memilih moda', needs: ['Alamat pengambilan dan pengantaran, beserta kontak di setiap lokasi', 'Dimensi, berat, dan kemasan barang', 'Rentang waktu barang harus diambil dan diantar', 'Batasan bongkar muat di kedua ujung (dock, forklift, jam akses)', 'Apakah bukti serah terima harus sampai pada hari yang sama'] },
  },
  'project-cargo': {
    en: { needsTitle: 'What we need to assess a movement', needs: ['Drawings with the weight, centre of gravity and lifting points', 'Overall length, width and height, packed and unpacked', 'The route constraints you already know of (bridges, roads, port or airport limits)', 'Site access and lifting equipment at origin and at destination', 'The schedule, and the earliest and latest dates the movement can happen'] },
    id: { needsTitle: 'Yang kami butuhkan untuk menilai pengiriman', needs: ['Gambar teknis dengan berat, titik berat, dan titik angkat', 'Panjang, lebar, dan tinggi keseluruhan, saat dikemas dan tidak dikemas', 'Kendala rute yang sudah Anda ketahui (jembatan, jalan, batas pelabuhan atau bandara)', 'Akses lokasi dan alat angkat di asal dan di tujuan', 'Jadwal, serta tanggal paling awal dan paling akhir pengiriman dapat dilakukan'] },
  },
}
