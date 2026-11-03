import { serviceGroups, serviceModes, type Locale } from './index'
import { faqEntries } from './faq'
import { workingNotes } from './working-notes'
import { serviceExtras } from './service-extras'
import { modeGuides } from './service-guides'

export type LocalCopy = Record<Locale, string>
const copy = (en: string, id: string): LocalCopy => ({ en, id })
export const glossary = {
  CBM: copy('Cubic metres: the volume of a package. Multiply length × width × height in metres. Add the volumes of all packages.', 'Meter kubik, yaitu volume kemasan. Kalikan panjang × lebar × tinggi dalam meter, lalu jumlahkan volume semua kemasan.'),
  'Chargeable weight': copy('The weight used to calculate freight charges. Depending on the service, this may be actual gross weight or volumetric weight. Ask which formula and minimum apply.', 'Berat yang menjadi dasar biaya angkut. Tergantung layanannya, dasar ini bisa berupa berat kotor aktual atau berat volumetrik. Pastikan rumus dan minimum yang berlaku.'),
  FTL: copy('Full Truck Load: a truck is allocated to your shipment. Vehicle size, cargo fit and loading access still need to be checked.', 'Full Truck Load: satu truk dialokasikan untuk kiriman Anda. Ukuran kendaraan, kecocokan muatan, dan akses bongkar muat tetap perlu diperiksa.'),
  LTL: copy('Less Than Truck Load: your cargo shares truck capacity with other shipments. Consolidation and additional handling affect the plan.', 'Less Than Truck Load: barang Anda berbagi kapasitas truk dengan kiriman lain. Konsolidasi dan penanganan tambahan ikut menentukan rencana pengiriman.'),
  FCL: copy('Full Container Load: a container is allocated to one shipment. Check the usable dimensions, payload and loading arrangement.', 'Full Container Load: satu kontainer dialokasikan untuk satu kiriman. Pastikan dimensi yang dapat digunakan, batas muatan, dan pengaturan pemuatannya.'),
  LCL: copy('Less Than Container Load: cargo from several shippers shares a container. Packing must suit consolidation and handling at both ends.', 'Less Than Container Load: barang dari beberapa pengirim digabung dalam satu kontainer. Kemasan perlu sesuai untuk konsolidasi dan penanganan di asal maupun tujuan.'),
  POD: copy('Proof of Delivery: the record of a delivery handover. Read the recipient details, time, condition and any exceptions recorded with it.', 'Proof of Delivery: catatan serah terima barang. Periksa penerima, waktu, kondisi barang, dan catatan pengecualian yang menyertainya.'),
  'HS code': copy('A customs classification code for goods. Product specifications help establish the classification; a suggested code still needs review.', 'Kode klasifikasi barang untuk kepabeanan. Spesifikasi produk membantu penetapan klasifikasi; kode yang diusulkan tetap perlu ditinjau.'),
} satisfies Record<string, LocalCopy>

export interface CompareOption { key: string; title: LocalCopy; fit: LocalCopy; handling: LocalCopy; tradeoff: LocalCopy; prepare: LocalCopy }
const domestic = 'domestic-distribution/'
export const comparisonOptions: CompareOption[] = [
  { key: domestic+'ftl', title: copy('FTL · Dedicated truck', 'FTL · Truk khusus'), fit: copy('Cargo that needs dedicated truck capacity.', 'Barang yang membutuhkan kapasitas truk khusus.'), handling: copy('Confirm vehicle type, loading access and unloading arrangements.', 'Pastikan jenis kendaraan, akses pemuatan, dan pengaturan bongkarnya.'), tradeoff: copy('You book the vehicle capacity. A smaller load may leave space unused.', 'Anda memesan kapasitas kendaraan. Sebagian ruang bisa tidak terpakai jika muatannya kecil.'), prepare: copy('Route, package count, dimensions, gross weight and site access.', 'Rute, jumlah kemasan, dimensi, berat kotor, dan akses lokasi.') },
  { key: domestic+'ltl', title: copy('LTL · Shared truck', 'LTL · Muatan gabungan truk'), fit: copy('Cargo that can travel with other shipments.', 'Barang yang dapat dikirim bersama muatan lain.'), handling: copy('Allow for consolidation and handling between vehicles or hubs.', 'Perhitungkan konsolidasi serta pemindahan di kendaraan atau hub.'), tradeoff: copy('Shared capacity can suit smaller loads; routing and timing depend on consolidation.', 'Kapasitas bersama bisa sesuai untuk muatan kecil; rute dan jadwal mengikuti konsolidasi.'), prepare: copy('Route, package count, dimensions, gross weight, packing and readiness.', 'Rute, jumlah kemasan, dimensi, berat kotor, kemasan, dan kesiapan barang.') },
  { key: domestic+'fcl', title: copy('FCL · Dedicated container', 'FCL · Kontainer khusus'), fit: copy('Cargo planned around a dedicated container.', 'Barang yang direncanakan menggunakan kontainer khusus.'), handling: copy('Plan container loading, securing and equipment at each end.', 'Rencanakan pemuatan, pengamanan muatan, dan alat bantu di kedua lokasi.'), tradeoff: copy('Container capacity is allocated to you. Ports, cut-offs and inland access shape the schedule.', 'Kapasitas kontainer dialokasikan untuk Anda. Pelabuhan, cut-off, dan akses darat menentukan jadwal.'), prepare: copy('Route, container requirement, dimensions, weight and loading method.', 'Rute, kebutuhan kontainer, dimensi, berat, dan metode pemuatan.') },
  { key: domestic+'lcl', title: copy('LCL · Shared container', 'LCL · Muatan gabungan kontainer'), fit: copy('Smaller sea shipments that can share a container.', 'Kiriman laut lebih kecil yang bisa berbagi kontainer.'), handling: copy('Cargo is consolidated and separated again at destination.', 'Barang digabung di asal dan dipisahkan kembali di tujuan.'), tradeoff: copy('You use shared space; consolidation, packing and local handling need to be included in the scope.', 'Anda memakai ruang bersama; konsolidasi, kemasan, dan handling lokal perlu masuk dalam cakupan.'), prepare: copy('Route, package dimensions, gross weight, packing and cargo type.', 'Rute, dimensi kemasan, berat kotor, kemasan, dan jenis barang.') },
  { key: domestic+'air-freight', title: copy('Domestic air freight', 'Kargo udara domestik'), fit: copy('Time-sensitive domestic cargo suitable for air transport.', 'Barang domestik yang peka waktu dan sesuai untuk angkutan udara.'), handling: copy('Check airline acceptance, packing, cut-off and delivery beyond the airport.', 'Periksa penerimaan maskapai, kemasan, cut-off, dan pengantaran dari bandara.'), tradeoff: copy('Review the full door-to-door schedule and chargeable weight, alongside the flight.', 'Tinjau jadwal dari asal sampai tujuan dan berat yang ditagihkan, selain jadwal penerbangan.'), prepare: copy('Route, dimensions, gross weight, contents, readiness and deadline.', 'Rute, dimensi, berat kotor, isi barang, tanggal siap, dan tenggat.') },
]

// The same published scope and preparation requirements used on each service page.
for (const [group, g] of Object.entries(serviceGroups)) {
  comparisonOptions.push({ key:group, title:copy(g.en.name,g.id.name), fit:copy(g.en.audience,g.id.audience), handling:copy(g.en.scope,g.id.scope), tradeoff:copy(g.en.process,g.id.process), prepare:copy(serviceExtras[group].en.needs.join('; '),serviceExtras[group].id.needs.join('; ')) })
  if (group === 'international-freight-forwarding') for (const mode of g.modes) {
    const c = serviceModes[group][mode], guide = modeGuides[`${group}/${mode}`]
    comparisonOptions.push({ key:`${group}/${mode}`, title:copy(c.en[0],c.id[0]), fit:copy(c.en[1],c.id[1]), handling:copy(c.en[2],c.id[2]), tradeoff:copy(guide.en.limit,guide.id.limit), prepare:copy(guide.en.ask.join('; '),guide.id.ask.join('; ')) })
  }
}

export interface SearchItem { href: string; title: string; body: string; category: string; aliases?: string[] }
export const searchAliases: Record<string, string[]> = {
  'customs-brokerage': ['bea cukai', 'bea masuk', 'urus impor', 'urus ekspor', 'customs', 'hs code', 'izin impor', 'clearance'],
  '3pl-warehousing': ['gudang', 'simpan barang', 'stok', 'fulfillment', 'warehouse', 'storage', 'pick and pack'],
  'project-cargo': ['alat berat', 'barang besar', 'muatan berat', 'oversized', 'heavy lift', 'heavy cargo'],
  'international-freight-forwarding': ['luar negeri', 'kirim internasional', 'international shipping', 'overseas', 'export', 'import'],
  'domestic-distribution': ['antar kota', 'antarkota', 'antar pulau', 'antarpulau', 'dalam negeri', 'domestic shipping'],
  [domestic+'ltl']: ['nggak penuh satu truk', 'tidak penuh satu truk', 'muatan sedikit', 'truk gabungan', 'shared truck', 'small truck load', 'ltl'],
  [domestic+'ftl']: ['satu truk penuh', 'truk khusus', 'dedicated truck', 'full truck', 'ftl'],
  [domestic+'lcl']: ['kontainer gabungan', 'container gabungan', 'tidak penuh satu kontainer', 'shared container', 'small sea shipment', 'lcl'],
  [domestic+'fcl']: ['satu kontainer penuh', 'kontainer khusus', 'full container', 'dedicated container', 'fcl'],
  [domestic+'air-freight']: ['pesawat domestik', 'domestic air', 'kargo udara domestik'],
}

export function publicSearchItems(locale: Locale): SearchItem[] {
  const cat = locale === 'en' ? 'Service' : 'Layanan'
  return [
    ...Object.entries(serviceGroups).flatMap(([key, g]) => [
      { href:`/${locale}/services/${key}`, title:g[locale].name, body:g[locale].intro, category:cat, aliases:searchAliases[key] },
      ...g.modes.map(mode => ({ href:`/${locale}/services/${key}/${mode}`, title:serviceModes[key][mode][locale][0], body:serviceModes[key][mode][locale][1], category:cat, aliases:searchAliases[`${key}/${mode}`] })),
    ]),
    ...faqEntries.map(f => ({ href:`/${locale}/faq#${f.id}`, title:f.q[locale], body:f.a[locale], category:'FAQ' })),
    ...workingNotes.map(n => ({ href:`/${locale}/insights#note-${n.id}`, title:n.title[locale], body:n.items[locale].join(' '), category:locale === 'en' ? 'Field note' : 'Catatan praktis' })),
    { href:`/${locale}/document-samples`, title:locale === 'en' ? 'Sample shipment documents' : 'Contoh dokumen pengiriman', body:locale === 'en' ? 'Quotation, delivery note and proof of delivery. Illustrative examples with no customer data.' : 'Penawaran, surat jalan, dan bukti serah terima. Contoh tanpa data pelanggan.', category:locale === 'en' ? 'Reference' : 'Referensi', aliases:['pod', 'quotation', 'surat jalan', 'contoh dokumen', 'sample documents', 'bukti serah terima'] },
  ]
}
