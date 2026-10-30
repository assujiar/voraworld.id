import type { Locale } from './index'

/**
 * What decides each mode, what to prepare, and what is deliberately not assumed. Written for the visitor who has to make a choice, so every point names
 * a decision or an input. Nothing here states a price, a transit time, a free-time allowance, a carrier's acceptance or a place VORA operates: those are
 * confirmed per inquiry, in writing.
 */
export interface ModeGuide {
  /** The heading over the points. */
  title: string
  /** [what decides it, why it matters] */
  points: Array<[string, string]>
  /** What to have ready when asking for a quotation. */
  ask: string[]
  /** What is not assumed or promised. */
  limit: string
}

export const modeGuides: Record<string, Record<Locale, ModeGuide>> = {
  'international-freight-forwarding/air-import': {
    en: {
      title: 'What decides an air import',
      points: [
        ['Cargo ready at the origin airport', 'Air cargo moves on the date it is accepted, not the date it is booked. The packing list, weights and dimensions have to match what the shipper hands over.'],
        ['Chargeable weight', 'The charge follows the greater of actual and volumetric weight. A light, bulky carton is priced on its volume.'],
        ['Transport document handover', 'The air waybill and the commercial documents must reach the destination side before the cargo does, or the release waits for them.'],
        ['Destination handling and customs inputs', 'Importer identity, goods description and classification are needed at arrival. Preparing them early is what keeps the cargo from sitting in the terminal.'],
      ],
      ask: ['Origin airport and destination airport', 'Number of packages, gross weight and the size of each package', 'Commercial invoice and packing list, even in draft', 'Who clears the cargo at destination, and the delivery address after release'],
      limit: 'We do not state a clearance time. It depends on the documents, the classification and the authority\'s process for that shipment.',
    },
    id: {
      title: 'Yang menentukan impor udara',
      points: [
        ['Barang siap di bandara asal', 'Kargo udara berangkat pada tanggal barang diterima, bukan tanggal booking. Packing list, berat, dan dimensi harus sesuai dengan barang yang diserahkan shipper.'],
        ['Chargeable weight', 'Biaya mengikuti yang lebih besar antara berat aktual dan berat volumetrik. Karton ringan yang besar dihitung dari volumenya.'],
        ['Serah terima dokumen angkut', 'Air waybill dan dokumen komersial harus sampai di sisi tujuan sebelum barangnya, kalau tidak proses pengeluaran menunggu dokumen.'],
        ['Penanganan di tujuan dan data kepabeanan', 'Identitas importir, deskripsi barang, dan klasifikasi dibutuhkan saat kedatangan. Menyiapkannya lebih awal mencegah barang tertahan di terminal.'],
      ],
      ask: ['Bandara asal dan bandara tujuan', 'Jumlah kemasan, berat kotor, dan ukuran tiap kemasan', 'Commercial invoice dan packing list, meski masih draf', 'Siapa yang mengurus kepabeanan di tujuan, dan alamat pengantaran setelah barang keluar'],
      limit: 'Kami tidak menyebut waktu clearance. Waktunya bergantung pada dokumen, klasifikasi, dan proses instansi untuk pengiriman tersebut.',
    },
  },
  'international-freight-forwarding/sea-import': {
    en: {
      title: 'What decides a sea import',
      points: [
        ['FCL or LCL', 'A full container is planned around the container; a consolidated load is planned around the cargo\'s cubic metres and the consolidator\'s schedule. The two have different handover points.'],
        ['Release readiness', 'The bill of lading, the importer\'s documents and any permit have to be in order before the container can be released from the terminal.'],
        ['Local charges and free time', 'Free time and storage terms are set by the shipping line and the terminal, and they differ. Ask for them in writing for the booking, not from a general table.'],
        ['Inland delivery', 'Trucking from the port is a separate decision: the delivery address, access limits and unloading arrangements change the vehicle and the timing.'],
      ],
      ask: ['Port of loading, port of discharge and the Incoterm', 'FCL: container type and quantity. LCL: cbm and kg', 'Bill of lading draft, commercial invoice and packing list', 'Delivery address and who unloads'],
      limit: 'We do not assume a free-time allowance, a container\'s availability or a carrier\'s acceptance. Each is confirmed for your shipment.',
    },
    id: {
      title: 'Yang menentukan impor laut',
      points: [
        ['FCL atau LCL', 'Satu kontainer penuh direncanakan berdasarkan kontainernya; muatan konsolidasi berdasarkan kubikasi barang dan jadwal konsolidator. Titik serah terimanya berbeda.'],
        ['Kesiapan pengeluaran barang', 'Bill of lading, dokumen importir, dan izin yang diperlukan harus lengkap sebelum kontainer dapat dikeluarkan dari terminal.'],
        ['Biaya lokal dan free time', 'Free time dan ketentuan penumpukan ditetapkan oleh pelayaran dan terminal, dan berbeda-beda. Mintalah tertulis untuk booking Anda, jangan dari tabel umum.'],
        ['Pengantaran darat', 'Trucking dari pelabuhan adalah keputusan tersendiri: alamat pengantaran, batas akses, dan pengaturan bongkar mengubah pilihan kendaraan dan waktunya.'],
      ],
      ask: ['Pelabuhan muat, pelabuhan bongkar, dan Incoterm', 'FCL: tipe dan jumlah kontainer. LCL: cbm dan kg', 'Draf bill of lading, commercial invoice, dan packing list', 'Alamat pengantaran dan siapa yang membongkar'],
      limit: 'Kami tidak mengasumsikan jumlah free time, ketersediaan kontainer, atau penerimaan pelayaran. Masing-masing dikonfirmasi untuk pengiriman Anda.',
    },
  },
  'international-freight-forwarding/air-export': {
    en: {
      title: 'What decides an air export',
      points: [
        ['Cargo acceptance', 'The airline accepts the cargo against its own conditions: packing, labelling, dimensions and any special handling have to be declared before the cargo arrives at the terminal.'],
        ['Security screening', 'Cargo has to pass screening and be documented as secure. A consignment that cannot be screened as packed has to be repacked, which costs the cut-off.'],
        ['Booking and cut-off', 'A booking secures space on a flight; the cut-off is the latest time the cargo and documents can be at the terminal. Missing it moves the cargo to the next flight.'],
        ['Destination scope', 'Say whether the quotation ends at the destination airport or includes delivery. Export documents for the consignee must be consistent with the invoice.'],
      ],
      ask: ['Origin airport, destination airport and requested flight window', 'Goods description, packaging, number of pieces, gross weight and dimensions', 'Any special handling: batteries, liquids, temperature, fragile goods', 'Shipper and consignee names exactly as they should print on the air waybill'],
      limit: 'Flights, space and cut-off times are the airline\'s. We confirm them per booking and do not quote them as standing.',
    },
    id: {
      title: 'Yang menentukan ekspor udara',
      points: [
        ['Penerimaan kargo', 'Maskapai menerima kargo menurut ketentuannya sendiri: kemasan, pelabelan, dimensi, dan penanganan khusus harus dideklarasikan sebelum kargo tiba di terminal.'],
        ['Pemeriksaan keamanan', 'Kargo harus melewati screening dan didokumentasikan sebagai aman. Barang yang tidak bisa diperiksa dalam kemasannya harus dikemas ulang, dan itu memakan waktu menuju cut-off.'],
        ['Booking dan cut-off', 'Booking mengamankan ruang di penerbangan; cut-off adalah batas waktu terakhir kargo dan dokumen berada di terminal. Terlewat berarti pindah ke penerbangan berikutnya.'],
        ['Cakupan di tujuan', 'Tentukan apakah quotation berakhir di bandara tujuan atau termasuk pengantaran. Dokumen ekspor untuk consignee harus konsisten dengan invoice.'],
      ],
      ask: ['Bandara asal, bandara tujuan, dan rentang penerbangan yang diminta', 'Deskripsi barang, kemasan, jumlah koli, berat kotor, dan dimensi', 'Penanganan khusus: baterai, cairan, suhu, barang mudah pecah', 'Nama shipper dan consignee persis seperti yang harus tercetak di air waybill'],
      limit: 'Penerbangan, ruang, dan waktu cut-off adalah milik maskapai. Kami konfirmasi per booking dan tidak menyebutnya sebagai ketentuan tetap.',
    },
  },
  'international-freight-forwarding/sea-export': {
    en: {
      title: 'What decides a sea export',
      points: [
        ['Equipment and space', 'A booking needs a container type, a vessel and space, and each is the shipping line\'s to confirm. Ask what is confirmed and what is requested.'],
        ['Shipping instructions', 'The names, the description of goods and the package counts that go on the bill of lading come from the shipping instructions. Errors here are corrected at a cost and a delay.'],
        ['Verified gross mass', 'The container\'s verified gross mass has to be declared before loading. Who determines it, and who submits it, has to be agreed in advance.'],
        ['Cut-offs and document review', 'The terminal has cut-offs for cargo and for documents. A document review before the cut-off is cheaper than a correction after it.'],
      ],
      ask: ['Port of loading, port of discharge and the Incoterm', 'Container type and quantity, or cbm and kg for LCL', 'Shipper, consignee and notify party exactly as they should appear', 'Whether the quotation includes pickup, export customs coordination and terminal delivery'],
      limit: 'We do not assume a fixed free time, a carrier\'s acceptance or equipment availability. These are confirmed with the booking.',
    },
    id: {
      title: 'Yang menentukan ekspor laut',
      points: [
        ['Peralatan dan ruang', 'Booking memerlukan tipe kontainer, kapal, dan ruang, dan masing-masing dikonfirmasi oleh pelayaran. Tanyakan mana yang sudah pasti dan mana yang masih permintaan.'],
        ['Shipping instructions', 'Nama pihak, deskripsi barang, dan jumlah kemasan di bill of lading berasal dari shipping instructions. Kesalahan di sini dikoreksi dengan biaya dan penundaan.'],
        ['Verified gross mass', 'Verified gross mass kontainer harus dideklarasikan sebelum dimuat. Siapa yang menentukan dan siapa yang menyampaikannya harus disepakati sejak awal.'],
        ['Cut-off dan peninjauan dokumen', 'Terminal punya cut-off untuk kargo dan untuk dokumen. Meninjau dokumen sebelum cut-off lebih murah daripada mengoreksi sesudahnya.'],
      ],
      ask: ['Pelabuhan muat, pelabuhan bongkar, dan Incoterm', 'Tipe dan jumlah kontainer, atau cbm dan kg untuk LCL', 'Shipper, consignee, dan notify party persis seperti yang harus tercantum', 'Apakah quotation mencakup penjemputan, koordinasi kepabeanan ekspor, dan pengantaran ke terminal'],
      limit: 'Kami tidak mengasumsikan free time tetap, penerimaan pelayaran, atau ketersediaan peralatan. Semuanya dikonfirmasi bersama booking.',
    },
  },
  'domestic-distribution/ftl': {
    en: {
      title: 'What decides a full truckload',
      points: [
        ['Does the load fill a vehicle', 'A dedicated vehicle is worth it when the load is large enough, urgent enough or fragile enough that sharing is not practical. Below that, part load is usually the better comparison.'],
        ['Body and equipment', 'Wingbox, box, flatbed or a vehicle with a tail lift: the cargo and the loading method decide, and the site has to accept that vehicle.'],
        ['Access at both ends', 'Dock height, turning space, permitted vehicle size and working hours decide whether a vehicle can load or unload at all.'],
        ['Windows and proof of delivery', 'Agree the pickup window, the delivery window and who signs for the goods. The signed proof of delivery is the record of the handover.'],
      ],
      ask: ['Pickup and delivery addresses with a contact at each', 'Cargo type, weight, dimensions and number of pallets or pieces', 'Who loads and unloads, and with what equipment', 'Pickup window, delivery window and the proof of delivery you need'],
      limit: 'We coordinate vehicles for the movement. We do not state that VORA owns a fleet, and no transit time is promised before the booking is confirmed.',
    },
    id: {
      title: 'Yang menentukan full truckload',
      points: [
        ['Apakah muatan memenuhi satu kendaraan', 'Kendaraan khusus layak bila muatan cukup besar, mendesak, atau rapuh sehingga berbagi kendaraan tidak praktis. Di bawah itu, part load biasanya pembanding yang lebih tepat.'],
        ['Bak dan perlengkapan', 'Wingbox, box, flatbed, atau kendaraan dengan tail lift: barang dan cara bongkar muat yang menentukan, dan lokasi harus bisa menerima kendaraan itu.'],
        ['Akses di kedua ujung', 'Tinggi dock, ruang putar, ukuran kendaraan yang diizinkan, dan jam kerja menentukan apakah kendaraan bisa memuat atau membongkar.'],
        ['Jendela waktu dan bukti serah terima', 'Sepakati jendela penjemputan, jendela pengantaran, dan siapa yang menandatangani penerimaan. Bukti serah terima bertanda tangan adalah catatan serah terimanya.'],
      ],
      ask: ['Alamat penjemputan dan pengantaran dengan kontak di masing-masing', 'Jenis barang, berat, dimensi, dan jumlah pallet atau koli', 'Siapa yang memuat dan membongkar, dan dengan alat apa', 'Jendela penjemputan, jendela pengantaran, dan bukti serah terima yang dibutuhkan'],
      limit: 'Kami mengoordinasikan kendaraan untuk pengiriman. Kami tidak menyatakan VORA memiliki armada, dan tidak ada waktu tempuh yang dijanjikan sebelum booking dikonfirmasi.',
    },
  },
  'domestic-distribution/ltl': {
    en: {
      title: 'What decides a part load',
      points: [
        ['Consolidation', 'The load shares a vehicle with other cargo, so the pickup and delivery windows follow the route of the whole vehicle, not only yours.'],
        ['Handling interfaces', 'Cargo is handled more often than in a dedicated vehicle. Packing has to survive transfers, stacking and forklift movement.'],
        ['Chargeable basis', 'Part loads are commonly priced on weight, volume or pallet positions, whichever is greater. State all three when you ask.'],
        ['Delivery window trade-offs', 'A shorter or fixed window usually means a different arrangement. Say what the receiver can accept.'],
      ],
      ask: ['Number of pallets or cartons, each with weight and dimensions', 'How the goods are packed and whether they can be stacked', 'Pickup and delivery addresses with access conditions', 'The latest delivery date and what happens if it is missed'],
      limit: 'We do not promise a delivery date for a consolidated load before the arrangement is confirmed. Cargo that cannot be consolidated is advised separately.',
    },
    id: {
      title: 'Yang menentukan part load',
      points: [
        ['Konsolidasi', 'Muatan berbagi kendaraan dengan kargo lain, sehingga jendela penjemputan dan pengantaran mengikuti rute seluruh kendaraan, bukan hanya muatan Anda.'],
        ['Titik penanganan', 'Barang ditangani lebih sering daripada di kendaraan khusus. Kemasan harus tahan terhadap pemindahan, penumpukan, dan gerakan forklift.'],
        ['Dasar perhitungan biaya', 'Part load umumnya dihitung dari berat, volume, atau posisi pallet, mana yang lebih besar. Sebutkan ketiganya saat meminta penawaran.'],
        ['Konsekuensi jendela pengantaran', 'Jendela yang lebih pendek atau pasti biasanya berarti pengaturan lain. Sampaikan apa yang bisa diterima penerima.'],
      ],
      ask: ['Jumlah pallet atau karton, masing-masing dengan berat dan dimensi', 'Cara pengemasan dan apakah barang boleh ditumpuk', 'Alamat penjemputan dan pengantaran beserta kondisi akses', 'Tanggal pengantaran paling akhir dan apa yang terjadi bila terlewat'],
      limit: 'Kami tidak menjanjikan tanggal pengantaran muatan konsolidasi sebelum pengaturannya dikonfirmasi. Barang yang tidak bisa dikonsolidasi kami sarankan terpisah.',
    },
  },
  'domestic-distribution/fcl': {
    en: {
      title: 'What decides a domestic full container',
      points: [
        ['Container and port pair', 'Container type, the port of loading and the port of discharge define the booking. The lines serving that pair, and their cut-offs, are confirmed per request.'],
        ['Stuffing and unstuffing', 'Who loads the container, where, and who unloads it at the other end are part of the scope. Ask for them in writing.'],
        ['Pickup and return interfaces', 'Empty pickup, loaded delivery to the port and the return of the empty container each have their own place, time and responsibility.'],
        ['Scope in writing', 'Door to door, door to port or port to port are different quotations. The written scope says which charges are included.'],
      ],
      ask: ['Port of loading and port of discharge', 'Container type and quantity, and the cargo\'s weight', 'Where the container is stuffed and where it is unstuffed', 'Whether the quotation covers trucking at one end, both ends or neither'],
      limit: 'We do not assume equipment availability, free time or a line\'s acceptance. They are confirmed with the booking.',
    },
    id: {
      title: 'Yang menentukan FCL domestik',
      points: [
        ['Kontainer dan pasangan pelabuhan', 'Tipe kontainer, pelabuhan muat, dan pelabuhan bongkar menentukan booking. Pelayaran yang melayani pasangan itu beserta cut-off-nya dikonfirmasi per permintaan.'],
        ['Stuffing dan unstuffing', 'Siapa yang memuat kontainer, di mana, dan siapa yang membongkarnya di ujung lain adalah bagian dari cakupan. Mintalah tertulis.'],
        ['Titik pengambilan dan pengembalian', 'Pengambilan kontainer kosong, pengantaran muatan ke pelabuhan, dan pengembalian kontainer kosong masing-masing punya tempat, waktu, dan penanggung jawab.'],
        ['Cakupan tertulis', 'Door to door, door to port, atau port to port adalah penawaran yang berbeda. Cakupan tertulis menyebutkan biaya mana yang termasuk.'],
      ],
      ask: ['Pelabuhan muat dan pelabuhan bongkar', 'Tipe dan jumlah kontainer, serta berat barang', 'Di mana kontainer di-stuffing dan di mana di-unstuffing', 'Apakah penawaran mencakup trucking di satu ujung, kedua ujung, atau tidak sama sekali'],
      limit: 'Kami tidak mengasumsikan ketersediaan peralatan, free time, atau penerimaan pelayaran. Semuanya dikonfirmasi bersama booking.',
    },
  },
  'domestic-distribution/lcl': {
    en: {
      title: 'What decides a domestic consolidated load',
      points: [
        ['Measurement', 'The charge follows measured volume and weight. Measure the packed cargo, not the product.'],
        ['Consolidation timing', 'The cargo travels when the consolidation closes, not when it is ready. Ask when it closes and what happens if the cargo misses it.'],
        ['Packing and handling', 'Cargo is handled at the consolidation point and again at the deconsolidation point. Pack for both.'],
        ['Port to port or door to door', 'A port-to-port price does not include collection or delivery. Say where the cargo starts and where it must end.'],
      ],
      ask: ['Packed dimensions, number of packages and gross weight', 'Port of loading, port of discharge and the final delivery address if needed', 'The date the cargo is ready and the latest date it must arrive', 'Cargo acceptance conditions you already know of (fragile, stackable, hazardous)'],
      limit: 'No consolidation date or transit time is promised in advance. Cargo acceptance is confirmed per booking.',
    },
    id: {
      title: 'Yang menentukan LCL domestik',
      points: [
        ['Pengukuran', 'Biaya mengikuti volume dan berat hasil pengukuran. Ukur barang yang sudah dikemas, bukan produknya.'],
        ['Waktu konsolidasi', 'Barang berangkat saat konsolidasi ditutup, bukan saat barang siap. Tanyakan kapan ditutup dan apa yang terjadi bila barang terlewat.'],
        ['Kemasan dan penanganan', 'Barang ditangani di titik konsolidasi dan lagi di titik dekonsolidasi. Kemas untuk keduanya.'],
        ['Port to port atau door to door', 'Harga port to port tidak termasuk penjemputan atau pengantaran. Sebutkan dari mana barang mulai dan ke mana harus berakhir.'],
      ],
      ask: ['Dimensi setelah dikemas, jumlah kemasan, dan berat kotor', 'Pelabuhan muat, pelabuhan bongkar, dan alamat pengantaran akhir bila perlu', 'Tanggal barang siap dan tanggal paling akhir barang harus tiba', 'Kondisi penerimaan barang yang sudah Anda ketahui (mudah pecah, bisa ditumpuk, berbahaya)'],
      limit: 'Tidak ada tanggal konsolidasi atau waktu tempuh yang dijanjikan di muka. Penerimaan barang dikonfirmasi per booking.',
    },
  },
  'domestic-distribution/air-freight': {
    en: {
      title: 'What decides a domestic air shipment',
      points: [
        ['Actual and volumetric weight', 'The charge follows the greater of the two. Measure the packed cargo and state both weights.'],
        ['Cargo acceptance', 'The airline accepts cargo on its own conditions and screening. Batteries, liquids and some materials need to be declared early.'],
        ['Uplift subject to confirmation', 'Space on a flight is requested, then confirmed. Plan for the cargo to move on the confirmed flight, not the requested one.'],
        ['Airport handling and last mile', 'Collection at the airport and delivery to the final address are separate steps. Say whether the quotation includes them.'],
      ],
      ask: ['Origin and destination airports, and the final delivery address', 'Packed dimensions, number of pieces and gross weight', 'The date and time the cargo is ready, and the date it is needed', 'Special handling: batteries, liquids, temperature control, fragile goods'],
      limit: 'Domestic air freight is a separate service from international air import and export. Flights and space are the airline\'s to confirm.',
    },
    id: {
      title: 'Yang menentukan air freight domestik',
      points: [
        ['Berat aktual dan volumetrik', 'Biaya mengikuti yang lebih besar dari keduanya. Ukur barang yang sudah dikemas dan sebutkan kedua berat itu.'],
        ['Penerimaan kargo', 'Maskapai menerima kargo menurut ketentuan dan pemeriksaannya sendiri. Baterai, cairan, dan beberapa material perlu dideklarasikan sejak awal.'],
        ['Uplift menunggu konfirmasi', 'Ruang penerbangan diminta lalu dikonfirmasi. Rencanakan barang berangkat pada penerbangan yang terkonfirmasi, bukan yang diminta.'],
        ['Penanganan bandara dan pengantaran akhir', 'Pengambilan di bandara dan pengantaran ke alamat akhir adalah langkah terpisah. Sebutkan apakah penawaran mencakupnya.'],
      ],
      ask: ['Bandara asal dan tujuan, serta alamat pengantaran akhir', 'Dimensi setelah dikemas, jumlah koli, dan berat kotor', 'Tanggal dan jam barang siap, dan tanggal barang dibutuhkan', 'Penanganan khusus: baterai, cairan, kontrol suhu, barang mudah pecah'],
      limit: 'Air freight domestik adalah layanan yang berbeda dari impor dan ekspor udara internasional. Penerbangan dan ruang dikonfirmasi oleh maskapai.',
    },
  },
}

/** The air or ocean choice, as a ledger: one row per question, one column per movement. Rows are decisions to make, not promises. */
export const forwardingLedger: Record<Locale, { columns: string[]; rows: Array<{ question: string; cells: string[] }> }> = {
  en: {
    columns: ['Air import', 'Sea import', 'Air export', 'Sea export'],
    rows: [
      { question: 'What the cargo must be ready for', cells: ['Arrival documents sent ahead of the flight', 'Release documents and importer identity in order before the vessel arrives', 'Acceptance and security screening at the terminal', 'Container and space confirmed, shipping instructions filed'] },
      { question: 'What the charge follows', cells: ['The greater of actual and volumetric weight', 'FCL: the container. LCL: cubic metres or tonnes, whichever is greater', 'The greater of actual and volumetric weight', 'FCL: the container. LCL: cubic metres or tonnes, whichever is greater'] },
      { question: 'The handover that most often goes wrong', cells: ['Air waybill and invoice reaching the destination side late', 'A missing document that holds the release', 'Cargo or papers at the terminal after the cut-off', 'Names or counts on the instructions that differ from the invoice'] },
      { question: 'What is confirmed per booking', cells: ['Flight and space, set by the airline', 'Free time and storage terms, set by the line and terminal', 'Flight, space and cut-off, set by the airline', 'Equipment, vessel and cut-off, set by the line and terminal'] },
    ],
  },
  id: {
    columns: ['Impor udara', 'Impor laut', 'Ekspor udara', 'Ekspor laut'],
    rows: [
      { question: 'Yang harus siap', cells: ['Dokumen kedatangan dikirim sebelum penerbangan', 'Dokumen pengeluaran dan identitas importir lengkap sebelum kapal tiba', 'Penerimaan dan pemeriksaan keamanan di terminal', 'Kontainer dan ruang terkonfirmasi, shipping instructions diajukan'] },
      { question: 'Yang menjadi dasar biaya', cells: ['Yang lebih besar antara berat aktual dan volumetrik', 'FCL: kontainernya. LCL: meter kubik atau ton, mana yang lebih besar', 'Yang lebih besar antara berat aktual dan volumetrik', 'FCL: kontainernya. LCL: meter kubik atau ton, mana yang lebih besar'] },
      { question: 'Serah terima yang paling sering bermasalah', cells: ['Air waybill dan invoice terlambat sampai di sisi tujuan', 'Dokumen kurang yang menahan pengeluaran barang', 'Barang atau dokumen tiba di terminal setelah cut-off', 'Nama atau jumlah di instruksi berbeda dengan invoice'] },
      { question: 'Yang dikonfirmasi per booking', cells: ['Penerbangan dan ruang, ditetapkan maskapai', 'Free time dan ketentuan penumpukan, ditetapkan pelayaran dan terminal', 'Penerbangan, ruang, dan cut-off, ditetapkan maskapai', 'Peralatan, kapal, dan cut-off, ditetapkan pelayaran dan terminal'] },
    ],
  },
}

/** Warehousing: what goes in, what comes out. */
export const warehouseIo: Record<Locale, { inputs: Array<[string, string]>; outputs: Array<[string, string]>; caption: string }> = {
  en: {
    inputs: [['SKU profile', 'Number of items, size and weight of a unit, batch or expiry tracking'], ['Storage units', 'Pallets, cartons or loose items, and how many of each'], ['Throughput', 'Receipts and dispatches per week, and how they peak'], ['Order lines', 'Orders per day, lines per order and the packing each needs']],
    outputs: [['A proposed layout', 'Zones and locations matched to how the goods move'], ['A stock record', 'What is where, by lot, and how it is reported to you'], ['Handover records', 'Receipts and dispatches with the condition at the time'], ['A written scope', 'What is included, what is charged on and how it is measured']],
    caption: 'Conceptual cross-section of a warehouse flow. An illustration of the stages, not a picture of a VORA facility.',
  },
  id: {
    inputs: [['Profil SKU', 'Jumlah item, ukuran dan berat satuan, pelacakan batch atau kedaluwarsa'], ['Satuan penyimpanan', 'Pallet, karton, atau curah, dan jumlah masing-masing'], ['Arus barang', 'Penerimaan dan pengiriman per minggu, dan kapan puncaknya'], ['Order line', 'Pesanan per hari, baris per pesanan, dan kemasan yang dibutuhkan']],
    outputs: [['Usulan tata letak', 'Zona dan lokasi yang disesuaikan dengan arus barang'], ['Catatan stok', 'Apa di mana, per lot, dan cara pelaporannya kepada Anda'], ['Catatan serah terima', 'Penerimaan dan pengiriman beserta kondisi barang saat itu'], ['Cakupan tertulis', 'Apa yang termasuk, apa yang dikenai biaya, dan cara pengukurannya']],
    caption: 'Penampang konseptual alur gudang. Ilustrasi tahapan, bukan foto fasilitas VORA.',
  },
}

/** Customs: three stages of working through a set of documents. */
export const customsStages: Record<Locale, Array<[string, string, string[]]>> = {
  en: [
    ['Prepare', 'Collect what the declaration will rest on.', ['Commercial invoice and packing list', 'Transport document', 'Importer or exporter identity', 'Permits or certificates the goods may need']],
    ['Check', 'Make the documents agree with each other.', ['Names, addresses and tax identity match across documents', 'Quantities and weights agree', 'The goods description is specific enough to classify', 'Value, currency and Incoterm are stated the same way']],
    ['Review', 'Resolve what does not agree before it is filed.', ['Questions on classification are sent to the right party', 'Differences are corrected at the source', 'What remains open is written down, with who decides', 'Filing is done by the party licensed to do it']],
  ],
  id: [
    ['Siapkan', 'Kumpulkan dasar untuk pemberitahuan.', ['Commercial invoice dan packing list', 'Dokumen angkut', 'Identitas importir atau eksportir', 'Izin atau sertifikat yang mungkin dibutuhkan barang']],
    ['Periksa', 'Pastikan dokumen saling sesuai.', ['Nama, alamat, dan identitas pajak sama di semua dokumen', 'Jumlah dan berat sesuai', 'Deskripsi barang cukup spesifik untuk diklasifikasikan', 'Nilai, mata uang, dan Incoterm ditulis dengan cara yang sama']],
    ['Tinjau', 'Selesaikan yang belum sesuai sebelum diajukan.', ['Pertanyaan klasifikasi dikirim ke pihak yang tepat', 'Perbedaan dikoreksi di sumbernya', 'Yang masih terbuka dicatat, beserta siapa yang memutuskan', 'Pengajuan dilakukan oleh pihak yang berwenang melakukannya']],
  ],
}

export const customsNote: Record<Locale, string> = {
  en: 'VORA coordinates the documents and the questions around them. Filing a customs declaration is done by a party licensed to do it, and we say who that is for each shipment. The example document is synthetic: it shows what is compared, not a real record.',
  id: 'VORA mengoordinasikan dokumen dan pertanyaan di sekitarnya. Pengajuan pemberitahuan pabean dilakukan oleh pihak yang berlisensi, dan kami sebutkan siapa pihaknya untuk setiap pengiriman. Dokumen contoh bersifat sintetis: menunjukkan apa yang dibandingkan, bukan catatan sebenarnya.',
}

/** Domestic: the five questions that choose the mode. */
export const domesticFit: Record<Locale, Array<[string, string]>> = {
  en: [['How big is the load?', 'A few pallets suggest part load; a full vehicle suggests FTL; a container-sized load points to FCL.'], ['How tight is the delivery window?', 'A fixed window narrows the choice to dedicated or air.'], ['Does the route cross water?', 'Between islands the choice is container, consolidated or air.'], ['How fragile or valuable is it?', 'The more handling a mode involves, the more the packing has to carry.'], ['Who loads and unloads, and where?', 'Dock, forklift and access hours decide which vehicles can be used.']],
  id: [['Seberapa besar muatannya?', 'Beberapa pallet mengarah ke part load; satu kendaraan penuh ke FTL; muatan sebesar kontainer ke FCL.'], ['Seketat apa jendela pengantarannya?', 'Jendela yang pasti mempersempit pilihan ke kendaraan khusus atau udara.'], ['Apakah rutenya melintasi laut?', 'Antarpulau, pilihannya kontainer, konsolidasi, atau udara.'], ['Seberapa rapuh atau bernilai barangnya?', 'Semakin banyak penanganan sebuah moda, semakin banyak yang harus ditanggung kemasan.'], ['Siapa yang memuat dan membongkar, dan di mana?', 'Dock, forklift, dan jam akses menentukan kendaraan yang bisa dipakai.']],
}

/** Project cargo: the technical inputs a movement is assessed from. */
export const projectInputs: Record<Locale, { title: string; items: Array<[string, string]>; caution: string }> = {
  en: {
    title: 'The technical brief',
    items: [['Dimensions and mass', 'Overall length, width and height of each piece, packed and unpacked, and its mass.'], ['Centre of gravity', 'Its position as shown on the drawing, not estimated from the outside.'], ['Lifting and lashing points', 'The points the manufacturer designed for lifting and securing, with their rated loads.'], ['Access at both ends', 'Gates, ground bearing, overhead limits and the equipment available at the site.'], ['Method review', 'Who reviews the method and signs it off before the movement is committed.']],
    caution: 'We do not publish lifting instructions or engineering calculations. A method is proposed after the drawings are reviewed, and it is approved by a qualified engineer before it is used.',
  },
  id: {
    title: 'Brief teknis',
    items: [['Dimensi dan massa', 'Panjang, lebar, dan tinggi keseluruhan tiap unit, saat dikemas dan tidak dikemas, serta massanya.'], ['Titik berat', 'Posisinya sesuai gambar teknis, bukan diperkirakan dari luar.'], ['Titik angkat dan pengikatan', 'Titik yang dirancang pabrikan untuk mengangkat dan mengamankan, beserta beban nominalnya.'], ['Akses di kedua ujung', 'Gerbang, daya dukung tanah, batas ketinggian, dan peralatan yang tersedia di lokasi.'], ['Peninjauan metode', 'Siapa yang meninjau metode dan menyetujuinya sebelum pengiriman dijalankan.']],
    caution: 'Kami tidak menerbitkan instruksi pengangkatan atau perhitungan rekayasa. Metode diusulkan setelah gambar ditinjau, dan disetujui oleh insinyur yang berkualifikasi sebelum dipakai.',
  },
}
