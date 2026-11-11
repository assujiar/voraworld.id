import type { Locale } from '@/content'
import type { AgentSource } from './knowledge'

/** Educational summaries, NOT a substitute for the ICC text, a tariff or a legal decision. */
const topics = [
  {
    id: 'incoterms',
    title: 'Incoterms 2020 / International Commercial Terms',
    url: 'https://iccwbo.org/business-solutions/incoterms-rules/',
    en: 'Incoterms® 2020 is the latest ICC edition (11 terms). It allocates seller/buyer delivery tasks, transportation-related costs and the point where risk transfers. Seven can be used for any mode: EXW, FCA, CPT, CIP, DAP, DPU, DDP. Four are for sea/inland waterway only: FAS, FOB, CFR, CIF. Incoterms do not determine ownership/title, payment terms, customs tariff classification or replace the sales contract. Always specify the rule, named place/port, and edition, e.g. FCA Jakarta Warehouse, Incoterms® 2020. FCA is often more appropriate than FOB for container shipments delivered to a container terminal.',
    idn: 'Incoterms® 2020 adalah edisi ICC terbaru, berisi 11 terms. Mengatur kewajiban penjual/pembeli, pembagian biaya pengiriman, dan titik perpindahan risiko. Tujuh terms untuk semua moda: EXW, FCA, CPT, CIP, DAP, DPU, DDP. Empat terms khusus laut/sungai: FAS, FOB, CFR, CIF. Incoterms tidak mengatur perpindahan kepemilikan barang, syarat pembayaran, HS code atau menggantikan sales contract. Selalu sebut term, named place/port dan edisi, contoh FCA Jakarta Warehouse, Incoterms® 2020. Untuk container yang diserahkan ke terminal, FCA sering lebih tepat daripada FOB.',
  },
  {
    id: 'incoterms-risk',
    title: 'FOB CIF CFR DAP DDP FCA EXW CIP CPT DPU allocation',
    url: 'https://library.iccwbo.org/clp/clp-incoterms-qa-2020.htm?AGENT=ICC_HQ',
    en: 'FOB: seller delivers on board the vessel at named shipment port; buyer pays main carriage; risk passes on board. CFR: seller pays freight to named destination port, but risk passes once on board at origin. CIF: CFR plus seller-procured minimum cargo insurance under ICC 2020. CPT: seller pays carriage to destination but risk passes on delivery to first carrier. CIP: CPT plus higher default insurance coverage. DAP: seller delivers ready for unloading at destination; buyer normally handles import clearance, duties and taxes. DPU: seller unloads at named destination; buyer generally handles import clearance. DDP: seller handles import clearance and import duties/taxes where legally feasible. EXW: seller makes cargo available at named location, buyer takes on most transport/export responsibilities. FCA: seller delivers to buyer-nominated carrier at named place, with seller responsible for export clearance where applicable. Always check named places, contracts and jurisdiction.',
    idn: 'FOB: risiko pindah saat barang sudah on board di port muat; main freight dibayar pembeli. CFR: seller membayar freight sampai port tujuan, tetapi risiko pindah sejak on board di origin. CIF: CFR plus asuransi cargo minimum sesuai ICC 2020. CPT: seller membayar pengangkutan ke tujuan, risiko pindah saat diserahkan ke first carrier. CIP: seperti CPT dengan standar asuransi lebih tinggi. DAP: delivery siap dibongkar di tujuan, import clearance dan bea/pajak umumnya oleh buyer. DPU: seller menanggung unloading di tempat tujuan, import clearance umumnya oleh buyer. DDP: seller menanggung import clearance, bea/pajak jika secara hukum bisa dilakukan. EXW: barang tersedia di lokasi seller, sebagian besar pengangkutan dan formalitas menjadi tanggung jawab buyer. FCA: seller menyerahkan barang ke carrier yang ditunjuk buyer di lokasi yang disepakati, termasuk export clearance bila relevan. Selalu periksa named place, kontrak dan aturan negara.',
  },
  {
    id: 'freight-modes',
    title: 'Freight forwarding modes FCL LCL air sea breakbulk RoRo charter OOG heavy-lift',
    url: '/en/services/international-freight-forwarding',
    en: 'FCL is a container shipment used by one customer; LCL consolidates smaller cargo and involves CFS handling. Air cargo is faster but chargeable weight/volumetric weight matters. Breakbulk is cargo loaded as individual pieces instead of containers; OOG may require flat rack/open top or breakbulk depending on size, weight and vessel suitability. Heavy-lift and project cargo require lifting plans, verified weight/CoG, lashing/securing, route surveys and port handling assessment. RoRo requires rolling-capable cargo and vessel/terminal suitability; charter feasibility depends on vessel market, laycan, permits and port conditions. Never promise lift capacity or price without a vendor assessment.',
    idn: 'FCL memakai container untuk satu pengirim; LCL mengonsolidasikan muatan kecil dan melibatkan CFS handling. Air freight biasanya lebih cepat dengan perhitungan chargeable/volumetric weight. Breakbulk adalah muatan per piece di luar container; OOG bisa menggunakan flat rack/open top atau breakbulk tergantung dimensi, berat dan kecocokan vessel. Heavy-lift/project cargo perlu lifting plan, verifikasi berat dan center of gravity, lashing/securing, route survey dan kajian handling pelabuhan. RoRo memerlukan cargo yang bisa bergerak/diangkut pada sistem rolling dan terminal/vessel yang sesuai. Charter bergantung pada market vessel, laycan, izin, dan kondisi port. Jangan menjanjikan kapasitas atau tarif sebelum assessment vendor.',
  },
  {
    id: 'freight-documents',
    title: 'International shipping documents BL AWB HBL MBL HAWB MAWB packing list commercial invoice COO',
    url: '/en/services/international-freight-forwarding',
    en: 'Typical documents can include commercial invoice, packing list, B/L for sea freight or AWB for air freight, applicable origin certificates and permits. HBL/HAWB may be issued by a forwarder, while MBL/MAWB is carrier level. BL vs sea waybill has different delivery/document implications. A packing list generally details number of packages, dimensions and weights; commercial invoice supports transaction and customs declaration. Required document sets depend on commodity, origin/destination, customs regime and carrier. Do not claim one list is universal.',
    idn: 'Dokumen yang lazim: commercial invoice, packing list, B/L untuk sea freight atau AWB untuk air freight, certificate of origin dan izin bila relevan. HBL/HAWB umumnya dokumen level forwarder, MBL/MAWB level carrier. B/L dan sea waybill punya konsekuensi delivery/dokumen berbeda. Packing list memuat jumlah koli, dimensi dan berat; commercial invoice memuat informasi transaksi untuk customs. Kelengkapan wajib bergantung komoditas, origin/destination, rezim customs dan carrier; tidak ada daftar tunggal yang pasti berlaku untuk semua shipment.',
  },
  {
    id: 'customs',
    title: 'Customs clearance HS code duties taxes lartas PIB PEB SPPB Indonesia',
    url: '/en/services/customs-brokerage',
    en: 'Customs clearance typically requires accurate goods classification (HS code), customs value, origin, documents, and checks for licensing/restrictions. In Indonesia import declarations (PIB) and export declarations (PEB) involve customs processes; SPPB refers to a customs goods release approval. Import duty/tax amounts, licensing and examination depend on commodity, HS code, shipment specifics and live regulations. Never guarantee customs treatment, clearance timing or a permit. Request complete commodity specs and forward unusual cases for expert review.',
    idn: 'Customs clearance perlu klasifikasi HS code, nilai pabean, asal barang, dokumen dan pengecekan perizinan/lartas. Di Indonesia, PIB untuk impor, PEB untuk ekspor, dan SPPB terkait persetujuan pengeluaran barang. Tarif bea/pajak, izin, jalur pemeriksaan dan prosedur bergantung pada detail barang, HS code, skema perdagangan dan aturan terkini. Jangan menjamin perlakuan customs, waktu clearance, atau izin. Minta detail barang lengkap dan eskalasikan kasus khusus ke tim.',
  },
  {
    id: 'dg-cargo',
    title: 'Dangerous goods DG IMO IMDG IATA DGR MSDS SDS lithium batteries',
    url: '/en/services/international-freight-forwarding',
    en: 'DG shipments may need a verified UN number, proper shipping name, hazard class, packing group, quantity, packaging and SDS. Sea shipments refer to the applicable IMDG Code and air shipments to IATA Dangerous Goods Regulations/carrier requirements; rules change and acceptance is carrier-specific. Lithium battery shipping depends on chemistry, configuration, Wh rating and packaging. Request SDS and cargo details; refer classification, acceptance, labeling and pricing to a qualified DG specialist.',
    idn: 'Dangerous Goods/DG memerlukan identifikasi UN number, proper shipping name, hazard class, packing group, kuantitas, kemasan dan SDS bila relevan. Sea freight mengacu IMDG Code yang berlaku, air cargo mengacu IATA DGR/ketentuan carrier. Aturan dapat berubah dan acceptance tergantung carrier. Pengiriman lithium battery bergantung jenis baterai, konfigurasi, kapasitas Wh dan packing. Minta SDS/detail cargo, lalu validasikan klasifikasi, acceptance, label dan harga ke spesialis DG.',
  },
  {
    id: 'rates',
    title: 'Freight quotation chargeable weight CBM W/M local charges demurrage detention free time transit time',
    url: '/en/request-quote',
    en: 'Sea LCL often uses W/M, comparing weight in metric tonnes and measurement in m³, subject to specific tariff rules. Air chargeable weight is often the greater of actual and volumetric weight, with divisor varying by carrier/service. Ocean freight can have origin/destination local charges, THC, CFS, documentation, customs brokerage and trucking. Demurrage is commonly associated with containers staying in the terminal beyond free time; detention usually applies to equipment held outside the terminal, but carrier tariffs define the specifics. All actual charges, transit times, free time, cutoffs and equipment availability require current rate confirmation.',
    idn: 'LCL sea freight sering menggunakan W/M, membandingkan berat ton dan volume CBM sesuai ketentuan tarif. Air cargo chargeable weight umumnya mengambil nilai terbesar antara berat aktual dan volumetric, dengan divisor yang bisa berbeda per carrier/service. Rate perlu memperhitungkan origin/destination local charges, THC, CFS, dokumen, customs clearance dan trucking. Demurrage umumnya terkait container yang tertahan di terminal melewati free time, sedangkan detention terkait pemakaian equipment di luar terminal; definisi dan tarif akhirnya mengikuti carrier. Harga, transit time, free time, cutoff dan availability harus dicek aktual.',
  },
] as const

export function freightKnowledge(locale: Locale): AgentSource[] {
  return topics.map((d) => ({ id: `domain-${d.id}`, title: d.title, url: d.url.startsWith('/') ? `/${locale}${d.url.replace(/^\/(en|id)/, '')}` : d.url, text: locale === 'id' ? d.idn : d.en }))
}
