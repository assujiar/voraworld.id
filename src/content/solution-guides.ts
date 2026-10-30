import type { Locale } from './index'

/**
 * What each kind of business tends to bring to a quotation, in the same order as `solutions` in site.json. These are characteristics of the work,
 * not claims about customers: no client is named, no result is promised, and nothing says VORA has already handled such a programme.
 */
export interface SolutionGuide { traits: string[]; limits: string[]; inputs: string[] }

export const solutionGuides: Record<Locale, SolutionGuide[]> = {
  en: [
    { traits: ['Parts arrive against a production schedule, so the date matters as much as the rate.', 'Inbound and outbound often follow different routes and different modes.', 'Part numbers and quantities must match the documents exactly.'],
      limits: ['A missed inbound date can stop a line; ask what the fallback is before booking.', 'Customs documents must describe components the same way on every shipment.'],
      inputs: ['The production schedule that sets the need date', 'Part list with quantities and packing', 'Supplier ready dates and the agreed trade term'] },
    { traits: ['Many small orders, uneven demand and seasonal peaks.', 'Returns and exceptions are part of normal volume.', 'Delivery accuracy depends on clean order and stock records.'],
      limits: ['Peak weeks reduce the options for last-minute capacity.', 'A warehouse arrangement should be sized from order lines and receipts, not from floor area alone.'],
      inputs: ['Orders and order lines per day, and the peak', 'SKU count, storage unit and expiry control', 'Pick type, carriers and cut-off times'] },
    { traits: ['Single pieces with drawings, mass and lifting points set by the manufacturer.', 'The route and the site limit the method as much as the item does.', 'Schedule is tied to a construction or installation step.'],
      limits: ['Method and price wait for the technical brief and, often, a route survey.', 'Lift plans and securing calculations are engineering work by qualified people, not a forwarder’s quotation.'],
      inputs: ['General arrangement drawing and mass of each piece', 'Origin and destination site conditions', 'The installation date and which dates can move'] },
    { traits: ['Cartons, pallets and mixed goods with ordinary handling needs.', 'The main decisions are mode, scope and documents.', 'Packing quality decides most of the damage risk.'],
      limits: ['Cargo that looks ordinary can still need special acceptance, such as batteries or liquids.', 'The quotation covers the steps it lists; others stay with another party.'],
      inputs: ['Goods in plain words, packing and package count', 'Gross weight and dimensions per package', 'Route, trade term and which steps to quote'] },
  ],
  id: [
    { traits: ['Komponen tiba mengikuti jadwal produksi, jadi tanggal sama pentingnya dengan rate.', 'Inbound dan outbound sering lewat rute dan moda yang berbeda.', 'Nomor part dan jumlahnya harus sama persis dengan dokumen.'],
      limits: ['Tanggal inbound yang terlewat dapat menghentikan lini; tanyakan rencana cadangan sebelum booking.', 'Dokumen kepabeanan harus menguraikan komponen dengan cara yang sama di setiap pengiriman.'],
      inputs: ['Jadwal produksi yang menetapkan tanggal kebutuhan', 'Daftar part dengan jumlah dan kemasannya', 'Tanggal siap dari pemasok dan term perdagangan yang disepakati'] },
    { traits: ['Banyak pesanan kecil, permintaan tidak merata, dan puncak musiman.', 'Retur dan pengecualian adalah bagian dari volume normal.', 'Akurasi pengantaran bergantung pada catatan pesanan dan stok yang rapi.'],
      limits: ['Pada minggu puncak, pilihan kapasitas mendadak berkurang.', 'Pengaturan gudang sebaiknya dihitung dari order line dan penerimaan, bukan dari luas lantai saja.'],
      inputs: ['Pesanan dan order line per hari, serta puncaknya', 'Jumlah SKU, satuan simpan, dan kontrol kedaluwarsa', 'Jenis picking, pengangkut, dan jam cut-off'] },
    { traits: ['Barang tunggal dengan gambar, massa, dan titik angkat yang ditetapkan produsen.', 'Rute dan lokasi membatasi metode sama besar dengan barangnya.', 'Jadwal terkait dengan tahap konstruksi atau pemasangan.'],
      limits: ['Metode dan harga menunggu brief teknis dan, sering kali, survei rute.', 'Rencana pengangkatan dan perhitungan pengikatan adalah pekerjaan rekayasa oleh orang kompeten, bukan penawaran forwarder.'],
      inputs: ['Gambar general arrangement dan massa tiap bagian', 'Kondisi lokasi asal dan tujuan', 'Tanggal pemasangan dan tanggal mana yang bisa bergeser'] },
    { traits: ['Karton, pallet, dan barang campuran dengan kebutuhan penanganan biasa.', 'Keputusan utamanya adalah moda, cakupan, dan dokumen.', 'Kualitas kemasan menentukan sebagian besar risiko kerusakan.'],
      limits: ['Barang yang tampak biasa tetap bisa memerlukan penerimaan khusus, misalnya baterai atau cairan.', 'Penawaran mencakup langkah yang disebutkan; langkah lain tetap di pihak lain.'],
      inputs: ['Barang dalam bahasa sederhana, kemasan, dan jumlah kemasan', 'Berat kotor dan dimensi per kemasan', 'Rute, term perdagangan, dan langkah yang ingin dihitung'] },
  ],
}
