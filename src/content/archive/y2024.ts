import type { ArchiveDraft } from './types'

export const y2024: ArchiveDraft[] = [
  {
    group: 'import-readiness', year: 2024, quarter: 1,
    topic: { en: 'Customs', id: 'Kepabeanan' },
    sources: ['S5', 'S6'],
    en: {
      slug: 'import-readiness-starts-before-arrival',
      title: 'Import Readiness Starts Before Arrival',
      excerpt: 'Clearance goes smoothly when the documents agree with each other before the goods land. A consistency review of the invoice, packing list and transport document catches most problems while they are still cheap to fix.',
      seoTitle: 'Import Readiness Starts Before Arrival | VORA',
      seoDescription: 'Which documents to line up before an import shipment arrives in Indonesia, how to check them against each other, and what preparation cannot guarantee.',
      coverAlt: 'Three import documents laid side by side with matching fields highlighted',
      sections: [
        { h: 'Preparation is not clearance', p: [
          'Importing goods into Indonesia for use or ownership by a party domiciled there follows the process described by the Directorate General of Customs and Excise (DJBC) under "Impor Untuk Dipakai". In outline, the importer files an import declaration (PIB) based on supporting documents such as the invoice, the packing list and the bill of lading or airway bill, then calculates and pays the duties and taxes owed. Depending on the routing the system assigns, the shipment is released with or without a document check and physical inspection, and release follows the issue of the release approval.',
          'Notice what is missing from that outline: a promise about timing. Preparation makes a clean outcome more likely and removes avoidable delays. It does not decide the routing, the classification or the outcome of a check, which belong to the authority. Readiness is about removing your own errors early.',
        ] },
        { h: 'The documents, and what each one proves', table: {
          head: ['Document', 'What it establishes', 'Common source of error'],
          rows: [
            ['Commercial invoice', 'The transaction: parties, goods, quantity, value, terms', 'Goods described in different words than the packing list'],
            ['Packing list', 'What is in which package, with weights and counts', 'Package count that differs from the transport document'],
            ['Transport document (bill of lading or airway bill)', 'The contract of carriage and the consignee named', 'Consignee or notify party spelled differently from the importer'],
            ['Importer identity details', 'Who declares and who is liable', 'Out-of-date registration details'],
            ['Permits or certificates', 'That the goods may enter, where required', 'Discovered late, when the goods are already on the water'],
          ],
        } },
        { h: 'A consistency review', p: ['Read the documents against each other, not one at a time. A single document can be perfect and still disagree with its neighbours.'], steps: [
          'Compare the goods description across the invoice, packing list and transport document. Different words for the same item invite questions.',
          'Compare quantities and units: pieces, cartons, kilograms. A carton count on the packing list should equal the package count on the transport document.',
          'Compare names and addresses: the importer, the consignee and the notify party should match what the importer’s registration shows.',
          'Compare values and currency on the invoice with what the declaration will state.',
          'Check dates in order: invoice, packing list, shipment, arrival.',
          'List every product that may need a permit or certificate, and ask the relevant authority or an adviser early.',
        ] },
        { h: 'A hypothetical review, with a mismatch', example: {
          label: 'Hypothetical example, invented for illustration',
          p: [
            'An importer receives three documents for a shipment of "stainless steel kitchen fittings." The invoice says 450 pieces, the packing list says 18 cartons of 25 pieces (450 pieces), and the bill of lading says 20 packages. Two packages are unaccounted for.',
            'The importer writes to the supplier before the vessel arrives. The supplier answers that two additional cartons of samples were loaded and not invoiced. Now the importer knows to ask for a corrected invoice and packing list rather than discovering the difference at inspection.',
          ],
        }, after: ['This review does not decide any classification and does not claim a result for any real shipment.'] },
        { h: 'Classification is a question to ask, not a code to copy', p: [
          'Goods are identified for customs with a code from the Harmonized System, an international nomenclature maintained by the World Customs Organization. A supplier will often write a code on the invoice. That code is a suggestion. The declaration needs a classification that fits the goods as the authority reads the nomenclature, and the importer carries the responsibility for the declaration. If the code is uncertain, say so in your documents and ask an adviser or the authority before the goods ship.',
        ] },
        { h: 'A preparation checklist', list: [
          'Invoice, packing list and transport document read against each other and corrected where they differ.',
          'Importer details current and the same on every document.',
          'Goods described in plain words as well as by code.',
          'Permits and certificates identified, with a date for obtaining them.',
          'A named person who answers questions from the authority or the broker, with access to the original documents.',
        ] },
        { h: 'Limits of this guide', p: [
          'The rules and the process change. This article summarizes a page of DJBC guidance as read on the access date listed in the sources, and the WCO page should be rechecked before publication. It is not a legal opinion or a classification ruling, and it does not describe what applied in any earlier period. Confirm current requirements with DJBC, the national single window or a licensed customs broker before you act.',
        ] },
      ],
    },
    id: {
      slug: 'kesiapan-impor-dimulai-sebelum-barang-tiba',
      title: 'Kesiapan Impor Dimulai Sebelum Barang Tiba',
      excerpt: 'Clearance berjalan lancar bila dokumen sudah saling cocok sebelum barang mendarat. Pemeriksaan konsistensi invoice, packing list, dan dokumen angkutan menangkap sebagian besar masalah selagi perbaikannya masih murah.',
      seoTitle: 'Kesiapan Impor Dimulai Sebelum Barang Tiba | VORA',
      seoDescription: 'Dokumen yang perlu disiapkan sebelum kiriman impor tiba di Indonesia, cara memeriksanya satu sama lain, dan hal yang tidak bisa dijamin oleh persiapan.',
      coverAlt: 'Tiga dokumen impor berdampingan dengan kolom yang sesuai disorot',
      sections: [
        { h: 'Persiapan bukan clearance', p: [
          'Mengimpor barang ke Indonesia untuk dipakai atau dimiliki pihak yang berdomisili di sini mengikuti proses yang dijelaskan Direktorat Jenderal Bea dan Cukai (DJBC) dalam laman "Impor Untuk Dipakai". Garis besarnya: importir menyampaikan pemberitahuan impor barang (PIB) berdasarkan dokumen pendukung seperti invoice, packing list, dan bill of lading atau airway bill, lalu menghitung dan membayar bea dan pajak yang terutang. Bergantung pada jalur yang ditetapkan sistem, barang dikeluarkan dengan atau tanpa pemeriksaan dokumen dan fisik, dan pengeluaran mengikuti terbitnya persetujuan pengeluaran barang.',
          'Perhatikan apa yang tidak ada dalam garis besar itu: janji tentang waktu. Persiapan membuat hasil yang bersih lebih mungkin dan menyingkirkan keterlambatan yang sebenarnya bisa dihindari. Persiapan tidak menentukan jalur, klasifikasi, atau hasil pemeriksaan, yang merupakan kewenangan otoritas. Kesiapan berarti menyingkirkan kesalahan Anda sendiri sejak dini.',
        ] },
        { h: 'Dokumen dan apa yang dibuktikan masing-masing', table: {
          head: ['Dokumen', 'Yang dibuktikan', 'Sumber kesalahan yang umum'],
          rows: [
            ['Commercial invoice', 'Transaksinya: para pihak, barang, jumlah, nilai, ketentuan', 'Barang diuraikan dengan kata yang berbeda dari packing list'],
            ['Packing list', 'Isi tiap kemasan, dengan berat dan jumlah', 'Jumlah kemasan berbeda dari dokumen angkutan'],
            ['Dokumen angkutan (bill of lading atau airway bill)', 'Kontrak pengangkutan dan consignee yang tercantum', 'Penulisan consignee atau notify party berbeda dari importir'],
            ['Data identitas importir', 'Siapa yang melakukan pemberitahuan dan siapa yang bertanggung jawab', 'Data registrasi yang sudah usang'],
            ['Izin atau sertifikat', 'Bahwa barang boleh masuk, bila diwajibkan', 'Baru diketahui terlambat, ketika barang sudah di kapal'],
          ],
        } },
        { h: 'Pemeriksaan konsistensi', p: ['Bacalah dokumen dengan membandingkan satu sama lain, jangan satu per satu. Satu dokumen bisa sempurna dan tetap bertentangan dengan dokumen di sebelahnya.'], steps: [
          'Bandingkan uraian barang pada invoice, packing list, dan dokumen angkutan. Kata yang berbeda untuk barang yang sama mengundang pertanyaan.',
          'Bandingkan jumlah dan satuan: pcs, karton, kilogram. Jumlah karton di packing list harus sama dengan jumlah kemasan di dokumen angkutan.',
          'Bandingkan nama dan alamat: importir, consignee, dan notify party harus sesuai dengan data registrasi importir.',
          'Bandingkan nilai dan mata uang pada invoice dengan yang akan dinyatakan dalam pemberitahuan.',
          'Periksa urutan tanggal: invoice, packing list, pengapalan, kedatangan.',
          'Daftar setiap produk yang mungkin memerlukan izin atau sertifikat, dan tanyakan ke instansi terkait atau penasihat sejak awal.',
        ] },
        { h: 'Contoh pemeriksaan hipotetis dengan ketidakcocokan', example: {
          label: 'Contoh hipotetis, dibuat untuk ilustrasi',
          p: [
            'Seorang importir menerima tiga dokumen untuk kiriman "perlengkapan dapur stainless steel". Invoice menyebut 450 pcs, packing list menyebut 18 karton berisi 25 pcs (450 pcs), dan bill of lading menyebut 20 kemasan. Dua kemasan tidak terjelaskan.',
            'Importir menulis kepada pemasok sebelum kapal tiba. Pemasok menjawab bahwa dua karton sampel tambahan ikut dimuat dan tidak masuk invoice. Kini importir tahu untuk meminta invoice dan packing list yang dikoreksi, bukan menemukan selisihnya saat pemeriksaan.',
          ],
        }, after: ['Pemeriksaan ini tidak menentukan klasifikasi apa pun dan tidak mengklaim hasil untuk pengiriman nyata mana pun.'] },
        { h: 'Klasifikasi adalah pertanyaan yang diajukan, bukan kode yang disalin', p: [
          'Barang diidentifikasi untuk keperluan kepabeanan dengan kode dari Harmonized System, nomenklatur internasional yang dikelola World Customs Organization. Pemasok sering menuliskan kode pada invoice. Kode itu hanya usulan. Pemberitahuan membutuhkan klasifikasi yang sesuai dengan barang menurut cara otoritas membaca nomenklatur, dan importir memikul tanggung jawab atas pemberitahuan tersebut. Bila kode meragukan, nyatakan dalam dokumen Anda dan tanyakan kepada penasihat atau otoritas sebelum barang dikirim.',
        ] },
        { h: 'Daftar periksa persiapan', list: [
          'Invoice, packing list, dan dokumen angkutan dibaca bersama dan dikoreksi bila berbeda.',
          'Data importir mutakhir dan sama di semua dokumen.',
          'Barang diuraikan dengan bahasa sederhana selain dengan kode.',
          'Izin dan sertifikat sudah teridentifikasi, lengkap dengan tanggal perolehannya.',
          'Satu orang yang ditunjuk menjawab pertanyaan dari otoritas atau broker, dengan akses ke dokumen asli.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Aturan dan prosesnya berubah. Artikel ini meringkas satu laman panduan DJBC sebagaimana dibaca pada tanggal akses yang tercantum di daftar sumber, dan laman WCO perlu diperiksa ulang sebelum terbit. Artikel ini bukan pendapat hukum atau penetapan klasifikasi, dan tidak menggambarkan aturan yang berlaku pada periode sebelumnya. Pastikan persyaratan terkini kepada DJBC, national single window, atau broker kepabeanan berlisensi sebelum bertindak.',
        ] },
      ],
    },
  },
  {
    group: 'free-time-demurrage', year: 2024, quarter: 2,
    topic: { en: 'Ocean freight', id: 'Sea freight' },
    sources: ['S10', 'S8'],
    en: {
      slug: 'free-time-demurrage-detention-and-storage-read-the-terms',
      title: 'Free Time, Demurrage, Detention and Storage: Read the Terms',
      excerpt: 'Four words describe four different clocks. Which one is running depends on where the container is, who owns it and what the carrier’s written terms say. No universal number of free days exists.',
      seoTitle: 'Free Time, Demurrage, Detention and Storage: Read the Terms | VORA',
      seoDescription: 'How free time, demurrage, detention and storage differ, why they depend on the carrier and location, and what to ask for in writing before booking.',
      coverAlt: 'A timeline of a container journey with separate clocks for terminal and equipment',
      sections: [
        { h: 'Four words, four clocks', p: [
          'Carriers describe charges for keeping a container beyond an agreed period with several terms, and they are not interchangeable. One carrier’s published terms define detention as the charge for keeping its container inside a terminal, port or depot past the agreed free time, and demurrage as the charge for the same overrun when the container is outside those facilities. The terms also describe a combined form, and free time as the window agreed between the carrier and the merchant before charges apply.',
          'That definition is one carrier’s, written for its own business, and the same words may be arranged differently elsewhere. The lesson is not the particular definition. It is that the words describe different clocks, started and stopped by different events, and that a bill can contain more than one.',
        ] },
        { h: 'What to establish, in order', steps: [
          '**What starts each clock?** Discharge from the vessel, gate-out from a terminal, arrival at a depot: the trigger differs by charge and by location.',
          '**What stops it?** Return of the empty container to a nominated depot is a common stopping event for equipment charges, but confirm which depot and which document records it.',
          '**How many free days apply, and are they calendar or working days?** The number is agreed in the booking or set by the carrier’s terms for that location. There is no standard figure that applies everywhere.',
          '**Which party is the merchant?** The party named in the transport document and the party paying may differ, and the terms follow the contract of carriage.',
          '**What is charged after free time ends?** Ask for the tariff that applies to the location and the equipment type, in writing, with the currency.',
        ] },
        { h: 'Why location and contract matter', p: [
          'The same carrier publishes different arrangements for different countries, and it states that charges can be invoiced separately or combined depending on location. Governing law and jurisdiction follow the contract of carriage. For a shipper or consignee this means that the terms attached to your booking are the ones that count, not a general understanding from a previous shipment on another route.',
          'Storage is a related but separate matter. A terminal or warehouse can charge storage for cargo left on its premises, under its own tariff, whether or not equipment charges are also running. Do not assume one clock replaces another.',
        ] },
        { h: 'A hypothetical timeline', example: {
          label: 'Hypothetical timeline, invented for illustration only. No free-time length is implied.',
          p: [
            'Day 0: the vessel discharges the container at the port. Day 3: the importer’s documents are complete and the declaration is filed. Day 6: customs release is granted. Day 7: the container is collected from the terminal and delivered to the consignee’s warehouse. Day 9: the container is unloaded. Day 11: the empty container is returned to the nominated depot.',
            'In this invented sequence several clocks could have been running at different times: terminal storage from discharge, container charges while the container sat outside the terminal, and equipment charges until the empty returned. Whether any of them produced a charge depends entirely on the free time written for that booking.',
          ],
        } },
        { h: 'Delays that move the clock', list: [
          'Documents that are not ready when the cargo is discharged.',
          'A declaration routed for inspection, which adds days between filing and release.',
          'A consignee’s warehouse that cannot receive on the day the container arrives.',
          'An empty container that cannot be returned because the depot is full or closed.',
        ], after: ['Each of these is a reason to start the document consistency work early and to confirm the delivery date with the receiver before the vessel arrives.'] },
        { h: 'What to ask for before booking', list: [
          'The free time for each charge, in days, and whether days are calendar or working.',
          'The event that starts and stops each charge.',
          'The tariff after free time, by equipment type and location, and its currency.',
          'The depot for returning the empty, and how the return is evidenced.',
          'Who is invoiced, and what the quotation does and does not include.',
        ] },
        { h: 'Limits of this guide', p: [
          'This article explains concepts and does not state any carrier’s current free time or tariff. The carrier page cited is an example of one carrier’s terms and is not universal. Check the terms that apply to your booking and the date of your shipment; a current page does not show what applied at an earlier date. A forwarder’s own conditions govern its service separately.',
        ] },
      ],
    },
    id: {
      slug: 'free-time-demurrage-detention-dan-storage-baca-ketentuannya',
      title: 'Free Time, Demurrage, Detention, dan Storage: Baca Ketentuannya',
      excerpt: 'Empat istilah menggambarkan empat jam yang berbeda. Jam mana yang berjalan bergantung pada lokasi kontainer, pemiliknya, dan ketentuan tertulis pengangkut. Tidak ada angka free days yang berlaku di mana-mana.',
      seoTitle: 'Free Time, Demurrage, Detention, dan Storage: Baca Ketentuannya | VORA',
      seoDescription: 'Perbedaan free time, demurrage, detention, dan storage, mengapa bergantung pada pengangkut dan lokasi, serta hal yang diminta tertulis sebelum booking.',
      coverAlt: 'Garis waktu perjalanan kontainer dengan jam terpisah untuk terminal dan peralatan',
      sections: [
        { h: 'Empat istilah, empat jam', p: [
          'Pengangkut menggambarkan biaya karena menahan kontainer melewati periode yang disepakati dengan beberapa istilah, dan istilah itu tidak bisa dipertukarkan. Ketentuan yang dipublikasikan oleh satu pengangkut mendefinisikan detention sebagai biaya menahan kontainernya di dalam terminal, pelabuhan, atau depo melewati free time yang disepakati, dan demurrage sebagai biaya untuk keterlambatan yang sama bila kontainer berada di luar fasilitas tersebut. Ketentuan itu juga menjelaskan bentuk gabungan, dan free time sebagai jendela waktu yang disepakati antara pengangkut dan merchant sebelum biaya berlaku.',
          'Definisi itu milik satu pengangkut, ditulis untuk bisnisnya sendiri, dan istilah yang sama bisa disusun berbeda di tempat lain. Pelajarannya bukan pada definisi tertentu, melainkan bahwa istilah-istilah itu menggambarkan jam yang berbeda, dimulai dan dihentikan oleh peristiwa yang berbeda, dan satu tagihan bisa memuat lebih dari satu.',
        ] },
        { h: 'Yang perlu dipastikan, berurutan', steps: [
          '**Apa yang memulai tiap jam?** Pembongkaran dari kapal, gate-out dari terminal, kedatangan di depo: pemicunya berbeda untuk tiap biaya dan tiap lokasi.',
          '**Apa yang menghentikannya?** Pengembalian kontainer kosong ke depo yang ditunjuk lazim menjadi peristiwa penghenti untuk biaya peralatan, tetapi pastikan depo mana dan dokumen mana yang mencatatnya.',
          '**Berapa free days yang berlaku, dan apakah hari kalender atau hari kerja?** Angkanya disepakati dalam booking atau ditetapkan ketentuan pengangkut untuk lokasi tersebut. Tidak ada angka baku yang berlaku di mana-mana.',
          '**Siapa merchant-nya?** Pihak yang tercantum di dokumen angkutan dan pihak yang membayar bisa berbeda, dan ketentuan mengikuti kontrak pengangkutan.',
          '**Apa yang dikenakan setelah free time berakhir?** Minta tarif yang berlaku untuk lokasi dan tipe peralatan secara tertulis, lengkap dengan mata uangnya.',
        ] },
        { h: 'Mengapa lokasi dan kontrak penting', p: [
          'Pengangkut yang sama menerbitkan pengaturan berbeda untuk negara berbeda, dan menyatakan bahwa biaya dapat ditagihkan terpisah atau digabung tergantung lokasi. Hukum yang berlaku dan yurisdiksi mengikuti kontrak pengangkutan. Bagi pengirim atau penerima, artinya ketentuan yang melekat pada booking Anda yang berlaku, bukan pemahaman umum dari pengiriman sebelumnya di rute lain.',
          'Storage adalah hal yang berkaitan tetapi terpisah. Terminal atau gudang dapat mengenakan biaya storage untuk barang yang ditinggalkan di lokasinya, berdasarkan tarifnya sendiri, terlepas dari apakah biaya peralatan juga berjalan. Jangan berasumsi satu jam menggantikan jam yang lain.',
        ] },
        { h: 'Garis waktu hipotetis', example: {
          label: 'Garis waktu hipotetis, dibuat hanya untuk ilustrasi. Tidak ada lama free time yang tersirat.',
          p: [
            'Hari 0: kapal membongkar kontainer di pelabuhan. Hari 3: dokumen importir lengkap dan pemberitahuan diajukan. Hari 6: pengeluaran dari kepabeanan disetujui. Hari 7: kontainer diambil dari terminal dan dikirim ke gudang consignee. Hari 9: kontainer dibongkar muatannya. Hari 11: kontainer kosong dikembalikan ke depo yang ditunjuk.',
            'Dalam urutan rekaan ini, beberapa jam bisa berjalan pada waktu berbeda: storage terminal sejak pembongkaran, biaya kontainer selama berada di luar terminal, dan biaya peralatan sampai kontainer kosong kembali. Apakah salah satunya menghasilkan tagihan sepenuhnya bergantung pada free time yang tertulis untuk booking tersebut.',
          ],
        } },
        { h: 'Keterlambatan yang menggeser jam', list: [
          'Dokumen belum siap ketika barang dibongkar.',
          'Pemberitahuan yang masuk jalur pemeriksaan, yang menambah hari antara pengajuan dan pengeluaran.',
          'Gudang consignee yang tidak bisa menerima pada hari kontainer tiba.',
          'Kontainer kosong yang tidak bisa dikembalikan karena depo penuh atau tutup.',
        ], after: ['Setiap poin ini alasan untuk memulai pemeriksaan konsistensi dokumen lebih awal dan mengonfirmasi tanggal pengantaran dengan penerima sebelum kapal tiba.'] },
        { h: 'Yang diminta sebelum booking', list: [
          'Free time untuk setiap biaya, dalam hari, dan apakah hari kalender atau hari kerja.',
          'Peristiwa yang memulai dan menghentikan tiap biaya.',
          'Tarif setelah free time, menurut tipe peralatan dan lokasi, beserta mata uangnya.',
          'Depo pengembalian kontainer kosong, dan cara pengembalian dibuktikan.',
          'Siapa yang ditagih, dan apa yang termasuk dan tidak termasuk dalam penawaran.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Artikel ini menjelaskan konsep dan tidak menyebut free time atau tarif terkini milik pengangkut mana pun. Laman pengangkut yang dikutip hanyalah contoh ketentuan satu pengangkut dan tidak berlaku universal. Periksa ketentuan yang berlaku untuk booking dan tanggal pengiriman Anda; laman yang berlaku sekarang tidak membuktikan apa yang berlaku pada tanggal sebelumnya. Ketentuan forwarder sendiri mengatur layanannya secara terpisah.',
        ] },
      ],
    },
  },
  {
    group: 'ftl-or-ltl', year: 2024, quarter: 3,
    topic: { en: 'Domestic transport', id: 'Transportasi domestik' },
    sources: ['S3', 'S7'],
    en: {
      slug: 'ftl-or-ltl-decide-beyond-the-freight-rate',
      title: 'FTL or LTL? Decide Beyond the Freight Rate',
      excerpt: 'A dedicated truck and a consolidated load differ in handling, timing and risk as much as in price. Five questions about the load, the sites and the receiver decide the better arrangement more reliably than a rate comparison.',
      seoTitle: 'FTL or LTL? Decide Beyond the Freight Rate | VORA',
      seoDescription: 'A five-question decision sheet for choosing between full-truckload and less-than-truckload transport in Indonesia, with a labeled example.',
      coverAlt: 'A route study with a dedicated truck on one line and a consolidated load with extra stops on another',
      sections: [
        { h: 'Two different ways to occupy a vehicle', p: [
          'A full-truckload movement (FTL) dedicates a vehicle to one shipper’s cargo for one journey. A less-than-truckload movement (LTL) places a smaller consignment in a vehicle shared with other cargo, usually through a consolidation point. The two are sometimes described as a cheaper and an expensive version of the same service. They are better described as two different services with different trade-offs.',
          'The freight rate is one visible difference. The others show up in handling, scheduling and risk, and they matter more as the cargo becomes more delicate or the delivery window narrower.',
        ] },
        { h: 'What changes between them', table: {
          head: ['Aspect', 'Dedicated truck (FTL)', 'Consolidated load (LTL)'],
          rows: [
            ['Handling', 'Loaded once at pickup, unloaded once at delivery', 'Often handled at a consolidation point and again before delivery'],
            ['Pickup and delivery windows', 'Set around your cargo and your site', 'Fit around other consignments on the same route'],
            ['Route', 'Direct between your sites', 'Shared, with other stops'],
            ['Cost basis', 'The vehicle, however full', 'The space or weight your cargo takes'],
            ['Exposure of the cargo', 'Fewer interfaces', 'More interfaces, each a place for a count or condition difference'],
            ['Flexibility', 'Can wait for you to finish loading', 'Must meet the consolidation schedule'],
          ],
        } },
        { h: 'Five questions for a decision sheet', steps: [
          '**How much cargo is there, in space and in weight?** If it fills most of a vehicle’s capacity, a dedicated vehicle may cost little more than a consolidated one. If it fills a fraction, the space you are not using is the cost.',
          '**How well does the cargo tolerate extra handling?** Fragile, palletized, high-value or counted-to-the-piece cargo benefits from fewer interfaces. Robust, uniformly packed cargo handles consolidation well.',
          '**How tight is the pickup window and the delivery window?** A narrow window favours a dedicated vehicle. A flexible window gives a consolidated service room to work.',
          '**What can the sites accept?** Dock or ground level, vehicle size limits and receiving hours determine which vehicles can reach you at all.',
          '**What does the receiver do with it?** If a production line or a retail opening depends on the delivery, the cost of a late arrival belongs in the comparison.',
        ] },
        { h: 'A hypothetical decision', example: {
          label: 'Hypothetical example, invented for illustration. No transit time or price is implied.',
          p: [
            'A distributor needs to move 6 pallets of packaged goods between two cities. The goods are sealed and uniformly packed, the receiver accepts deliveries across a full working day, and the sender can load at short notice. These answers suggest that a consolidated arrangement is workable, and the choice should be tested against the quotation.',
            'The same distributor then needs to move 6 pallets of counted, high-value items to a receiver who accepts delivery only between 09:00 and 11:00 on a stated day. The sealed-and-uniform reasoning no longer holds. The narrow window and the cost of a miscount point toward a dedicated vehicle, even though the rate per pallet will be higher.',
          ],
        }, after: ['Both situations use the same cities and the same number of pallets. The load and the receiver are what differ.'] },
        { h: 'What to include when you ask for both', list: [
          'Number of pallets or cartons and their dimensions, and gross weight.',
          'Pickup and delivery addresses with access conditions at each.',
          'The pickup window and the delivery window, and whether they are firm.',
          'Who loads and unloads, and whether counting at delivery is required.',
          'Whether a signed proof of delivery is needed and who signs.',
        ] },
        { h: 'What a quotation cannot promise', p: [
          'A consolidated service gives a schedule for its consolidation points, not a guarantee for your cargo. A dedicated vehicle shortens the exposure to other loads, but road, weather and site conditions are not under anyone’s control. Be wary of any arrangement that offers fixed transit times without stating the conditions. This guide does not assume anything about fleet ownership or guaranteed times.',
        ] },
        { h: 'Limits of this guide', p: [
          'The comparison is general. Cargo-specific rules, road restrictions and local arrangements vary, and packing and securing of the load remain the responsibility of the parties named in your contract. For guidance on how cargo should be packed and secured inside a vehicle or container, see the CTU Code; for the labels that identify pallets through a consolidation point, see the GS1 Logistic Label Guideline.',
        ] },
      ],
    },
    id: {
      slug: 'ftl-atau-ltl-jangan-bandingkan-rate-saja',
      title: 'FTL atau LTL? Jangan Bandingkan Rate Saja',
      excerpt: 'Truk dedicated dan muatan konsolidasi berbeda dalam penanganan, waktu, dan risiko sebanyak perbedaan harganya. Lima pertanyaan tentang muatan, lokasi, dan penerima menentukan pilihan yang lebih tepat daripada perbandingan rate.',
      seoTitle: 'FTL atau LTL? Jangan Bandingkan Rate Saja | VORA',
      seoDescription: 'Lembar keputusan lima pertanyaan untuk memilih antara full truckload dan less than truckload di Indonesia, dengan contoh berlabel.',
      coverAlt: 'Studi rute dengan truk dedicated di satu jalur dan muatan konsolidasi dengan pemberhentian tambahan di jalur lain',
      sections: [
        { h: 'Dua cara berbeda memakai kendaraan', p: [
          'Pengiriman full truckload (FTL) mendedikasikan satu kendaraan untuk muatan satu pengirim dalam satu perjalanan. Pengiriman less than truckload (LTL) menempatkan muatan yang lebih kecil dalam kendaraan yang dipakai bersama muatan lain, biasanya melalui titik konsolidasi. Keduanya kadang digambarkan sebagai versi murah dan versi mahal dari layanan yang sama. Lebih tepat dikatakan keduanya adalah dua layanan berbeda dengan pertukaran yang berbeda.',
          'Rate adalah satu perbedaan yang terlihat. Perbedaan lainnya muncul pada penanganan, penjadwalan, dan risiko, dan semakin penting ketika barang lebih rentan atau jendela pengantaran lebih sempit.',
        ] },
        { h: 'Apa yang berubah di antara keduanya', table: {
          head: ['Aspek', 'Truk dedicated (FTL)', 'Muatan konsolidasi (LTL)'],
          rows: [
            ['Penanganan', 'Dimuat sekali saat jemput, dibongkar sekali saat antar', 'Sering ditangani di titik konsolidasi dan sekali lagi sebelum pengantaran'],
            ['Jendela jemput dan antar', 'Disusun di sekitar barang dan lokasi Anda', 'Menyesuaikan dengan kiriman lain di rute yang sama'],
            ['Rute', 'Langsung antar lokasi Anda', 'Dibagi, dengan pemberhentian lain'],
            ['Dasar biaya', 'Kendaraannya, seberapa pun isinya', 'Ruang atau berat yang dipakai barang Anda'],
            ['Keterpaparan barang', 'Lebih sedikit titik perpindahan', 'Lebih banyak titik perpindahan, masing-masing bisa menimbulkan selisih jumlah atau kondisi'],
            ['Fleksibilitas', 'Bisa menunggu Anda selesai memuat', 'Harus mengikuti jadwal konsolidasi'],
          ],
        } },
        { h: 'Lima pertanyaan untuk lembar keputusan', steps: [
          '**Berapa banyak barangnya, dalam ruang dan berat?** Bila mengisi sebagian besar kapasitas kendaraan, kendaraan dedicated mungkin hanya sedikit lebih mahal daripada konsolidasi. Bila hanya mengisi sebagian kecil, ruang yang tidak terpakai itulah biayanya.',
          '**Seberapa tahan barang terhadap penanganan tambahan?** Barang rapuh, dipaletkan, bernilai tinggi, atau dihitung per unit diuntungkan oleh titik perpindahan yang lebih sedikit. Barang kokoh dengan kemasan seragam cocok untuk konsolidasi.',
          '**Seberapa ketat jendela jemput dan jendela antar?** Jendela sempit mengarah ke kendaraan dedicated. Jendela yang longgar memberi ruang gerak bagi layanan konsolidasi.',
          '**Apa yang bisa diterima lokasi?** Dock atau permukaan tanah, batas ukuran kendaraan, dan jam penerimaan menentukan kendaraan mana yang bisa mencapai lokasi Anda.',
          '**Untuk apa penerima memakai barang itu?** Bila lini produksi atau pembukaan toko bergantung pada pengantaran, biaya keterlambatan perlu masuk dalam perbandingan.',
        ] },
        { h: 'Keputusan hipotetis', example: {
          label: 'Contoh hipotetis, dibuat untuk ilustrasi. Tidak ada waktu tempuh atau harga yang tersirat.',
          p: [
            'Seorang distributor perlu memindahkan 6 pallet barang kemasan antar dua kota. Barangnya tersegel dan seragam, penerima menerima kiriman sepanjang hari kerja, dan pengirim dapat memuat dengan pemberitahuan singkat. Jawaban ini menunjukkan bahwa pengaturan konsolidasi layak, dan pilihan itu perlu diuji terhadap penawaran.',
            'Distributor yang sama kemudian memindahkan 6 pallet barang bernilai tinggi yang dihitung per unit ke penerima yang hanya menerima pukul 09.00 sampai 11.00 pada hari tertentu. Alasan "tersegel dan seragam" tidak lagi berlaku. Jendela yang sempit dan biaya salah hitung mengarah ke kendaraan dedicated, meskipun rate per pallet lebih tinggi.',
          ],
        }, after: ['Kedua situasi memakai kota dan jumlah pallet yang sama. Yang berbeda adalah muatan dan penerimanya.'] },
        { h: 'Yang perlu dicantumkan bila Anda meminta keduanya', list: [
          'Jumlah pallet atau karton, dimensinya, dan berat kotor.',
          'Alamat jemput dan antar dengan kondisi akses di masing-masing.',
          'Jendela jemput dan jendela antar, dan apakah sifatnya tetap.',
          'Siapa yang memuat dan membongkar, dan apakah penghitungan saat antar diperlukan.',
          'Apakah bukti serah terima bertanda tangan diperlukan dan siapa yang menandatangani.',
        ] },
        { h: 'Yang tidak bisa dijanjikan oleh penawaran', p: [
          'Layanan konsolidasi memberi jadwal untuk titik konsolidasinya, bukan jaminan bagi barang Anda. Kendaraan dedicated mempersingkat keterpaparan terhadap muatan lain, tetapi jalan, cuaca, dan kondisi lokasi tidak berada dalam kendali siapa pun. Waspadai pengaturan yang menawarkan waktu tempuh tetap tanpa menyebut syaratnya. Panduan ini tidak mengasumsikan apa pun tentang kepemilikan armada atau waktu yang dijamin.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Perbandingan ini bersifat umum. Aturan khusus barang, pembatasan jalan, dan pengaturan setempat berbeda-beda, dan pengemasan serta pengikatan muatan tetap menjadi tanggung jawab pihak yang disebut dalam kontrak Anda. Untuk panduan tentang cara barang dikemas dan diikat di dalam kendaraan atau kontainer, lihat CTU Code; untuk label yang mengidentifikasi pallet melewati titik konsolidasi, lihat GS1 Logistic Label Guideline.',
        ] },
      ],
    },
  },
  {
    group: 'warehouse-readiness', year: 2024, quarter: 4,
    topic: { en: 'Warehousing', id: 'Warehousing' },
    sources: ['S7', 'S11'],
    en: {
      slug: 'warehouse-readiness-define-the-flow-before-the-space',
      title: 'Warehouse Readiness: Define the Flow Before the Space',
      excerpt: 'Square meters are the last thing to decide about storage. The storage unit, the profile of SKUs, the rhythm of receipts and orders and the records that must stay correct set the requirement. A facility brief template follows.',
      seoTitle: 'Warehouse Readiness: Define the Flow Before the Space | VORA',
      seoDescription: 'How to describe goods flow before asking for warehouse space: storage unit, SKU and lot profile, receiving, picking, dispatch and records, with a template.',
      coverAlt: 'An illustrative warehouse cross-section with receiving, storage and dispatch flows',
      sections: [
        { h: 'Space follows flow', p: [
          'The usual first question about a warehouse is how many square meters are needed. It is a reasonable question and the wrong place to start. Two operations with identical floor area can need entirely different facilities: one receives a few full pallets a week and ships them whole, the other receives mixed cartons daily and ships hundreds of small orders. Space is the outcome of how goods move through the building.',
          'A facility brief therefore starts with the flow and ends with the space.',
        ] },
        { h: 'The six things to describe', steps: [
          '**The storage unit.** Pallets, cartons, totes or loose items, and the size and weight of a typical unit.',
          '**The SKU and lot profile.** How many different items there are, how many units of each, and whether they are tracked by lot, batch or expiry date.',
          '**Receiving.** How many deliveries arrive per week, in what form (container, truck, parcel), and what must be checked on arrival.',
          '**Putaway and storage.** Whether the same SKU is stored in one place or several, stacking limits, and any condition such as temperature or segregation.',
          '**Order picking and dispatch.** Orders and order lines per day, whether picks are full pallets, cartons or pieces, and the carriers or vehicles that collect.',
          '**Records.** What stock records must be accurate, how often they are reconciled, and which system they need to connect to.',
        ] },
        { h: 'A hypothetical volume profile', p: ['The numbers below are **invented** to show what a usable description looks like. They do not describe a real customer or any VORA capacity.'], table: {
          head: ['Item', 'Hypothetical value'],
          rows: [
            ['Storage unit', 'Standard pallet, about 1 m × 1.2 m, up to 600 kg'],
            ['Active SKUs', '120, of which 20 account for most of the movement'],
            ['Tracking', 'Batch number and expiry date for 40 SKUs'],
            ['Receipts', 'About 6 truck deliveries per week, some mixed pallets'],
            ['Orders', 'About 80 order lines per day, mostly cartons'],
            ['Dispatch', 'Two collections per day, with a fixed cut-off'],
            ['Records', 'Stock balance reconciled weekly, reported monthly'],
          ],
        }, after: ['From this profile one can ask better questions: how many pallet positions at peak, whether carton picking needs a separate area, and how mixed pallets are broken down on receipt.'] },
        { h: 'The flow, as an illustration', p: [
          'A simple way to test the profile is to follow one pallet through the building. It arrives at a dock, is checked against the delivery document, is put away in a location recorded in the stock system, is picked in part or whole when an order arrives, is packed and staged, and leaves on a vehicle with a dispatch record. Each step uses space, equipment and a person, and each step produces a record. Where the profile says the steps happen many times a day, congestion and accuracy become the main questions; where they happen few times, storage density dominates.',
        ] },
        { h: 'Why records belong in the brief', p: [
          'The warehouse’s physical work is visible, but its value to the owner is a correct stock position. The GS1 Traceability Standard frames traceability as recording the key events that happen to a traceable item, such as receiving, packing, shipping and transporting, together with the data that describes each event. You do not need to adopt a standard to take the point: decide which events you need recorded and with which details, such as lot, quantity, time and location, before the first pallet arrives.',
          'Likewise, the GS1 logistic label gives a pallet or a carton an identifier that can be scanned at each event. If your suppliers or customers use one, say so.',
        ] },
        { h: 'A facility brief template', list: [
          'Goods: description, storage unit, typical unit size and weight.',
          'Conditions: temperature, humidity, stacking, segregation, security.',
          'Inbound: deliveries per week, vehicle types, document types, checks on arrival.',
          'Storage: number of SKUs, lots, expiry control, expected peak positions.',
          'Outbound: orders per day, order lines, pick type, carriers, cut-off times.',
          'Records: stock accuracy target, reconciliation frequency, reports, system connections.',
          'Changes: seasonal peaks and the growth you can foresee.',
        ] },
        { h: 'Limits of this guide', p: [
          'The article describes how to prepare a requirement. It makes no statement about any VORA warehouse, capacity, location or certification, and the figures are invented. Safety rules, permits and building constraints are specific to a facility and are not covered here. Treat every requirement as a question to the facility operator, and expect the answer to be confirmed in writing.',
        ] },
      ],
    },
    id: {
      slug: 'kesiapan-warehouse-tentukan-arus-barang-sebelum-luas-ruang',
      title: 'Kesiapan Warehouse: Tentukan Arus Barang Sebelum Luas Ruang',
      excerpt: 'Luas meter persegi adalah hal terakhir yang diputuskan dalam penyimpanan. Satuan simpan, profil SKU, ritme penerimaan dan pesanan, serta catatan yang harus tetap akurat yang menentukan kebutuhan. Templat brief fasilitas ada di bawah.',
      seoTitle: 'Kesiapan Warehouse: Tentukan Arus Barang Sebelum Luas Ruang | VORA',
      seoDescription: 'Cara menggambarkan arus barang sebelum meminta ruang gudang: satuan simpan, profil SKU dan lot, penerimaan, picking, pengiriman, dan catatan, dengan templat.',
      coverAlt: 'Penampang gudang ilustratif dengan arus penerimaan, penyimpanan, dan pengiriman',
      sections: [
        { h: 'Ruang mengikuti arus', p: [
          'Pertanyaan pertama tentang gudang biasanya berapa meter persegi yang dibutuhkan. Pertanyaan itu wajar, tetapi bukan tempat yang tepat untuk memulai. Dua operasi dengan luas lantai sama bisa membutuhkan fasilitas yang sangat berbeda: yang satu menerima beberapa pallet penuh seminggu dan mengirimnya utuh, yang lain menerima karton campuran setiap hari dan mengirim ratusan pesanan kecil. Ruang adalah hasil dari cara barang bergerak di dalam bangunan.',
          'Karena itu brief fasilitas dimulai dari arus dan diakhiri dengan ruang.',
        ] },
        { h: 'Enam hal yang perlu digambarkan', steps: [
          '**Satuan simpan.** Pallet, karton, tote, atau barang curah, serta ukuran dan berat satuan yang umum.',
          '**Profil SKU dan lot.** Berapa banyak jenis barang, berapa unit tiap jenis, dan apakah dilacak per lot, batch, atau tanggal kedaluwarsa.',
          '**Penerimaan.** Berapa pengiriman masuk per minggu, dalam bentuk apa (kontainer, truk, paket), dan apa yang harus diperiksa saat tiba.',
          '**Putaway dan penyimpanan.** Apakah SKU yang sama disimpan di satu tempat atau beberapa, batas tumpukan, dan kondisi seperti suhu atau pemisahan.',
          '**Picking pesanan dan pengiriman.** Jumlah pesanan dan order line per hari, apakah picking berupa pallet penuh, karton, atau pcs, serta pengangkut atau kendaraan yang menjemput.',
          '**Catatan.** Catatan stok mana yang harus akurat, seberapa sering direkonsiliasi, dan sistem apa yang perlu terhubung.',
        ] },
        { h: 'Profil volume hipotetis', p: ['Angka di bawah ini **rekaan** untuk menunjukkan seperti apa deskripsi yang bisa dipakai. Angka ini tidak menggambarkan pelanggan nyata atau kapasitas VORA.'], table: {
          head: ['Butir', 'Nilai hipotetis'],
          rows: [
            ['Satuan simpan', 'Pallet standar, sekitar 1 m × 1,2 m, sampai 600 kg'],
            ['SKU aktif', '120, dengan 20 SKU menyumbang sebagian besar pergerakan'],
            ['Pelacakan', 'Nomor batch dan tanggal kedaluwarsa untuk 40 SKU'],
            ['Penerimaan', 'Sekitar 6 pengiriman truk per minggu, sebagian pallet campuran'],
            ['Pesanan', 'Sekitar 80 order line per hari, kebanyakan karton'],
            ['Pengiriman', 'Dua kali penjemputan per hari, dengan cut-off tetap'],
            ['Catatan', 'Saldo stok direkonsiliasi mingguan, dilaporkan bulanan'],
          ],
        }, after: ['Dari profil ini kita bisa mengajukan pertanyaan yang lebih baik: berapa posisi pallet saat puncak, apakah picking karton perlu area terpisah, dan bagaimana pallet campuran dipecah saat penerimaan.'] },
        { h: 'Arus barang sebagai ilustrasi', p: [
          'Cara sederhana menguji profil adalah mengikuti satu pallet melewati bangunan. Pallet tiba di dock, dicocokkan dengan dokumen pengiriman, disimpan di lokasi yang tercatat dalam sistem stok, di-pick sebagian atau seluruhnya ketika pesanan masuk, dikemas dan ditempatkan di area staging, lalu berangkat dengan kendaraan beserta catatan pengiriman. Setiap langkah memakai ruang, peralatan, dan tenaga orang, dan setiap langkah menghasilkan catatan. Bila profil menunjukkan langkah itu terjadi berkali-kali sehari, kepadatan dan akurasi menjadi pertanyaan utama; bila jarang, kepadatan penyimpanan yang dominan.',
        ] },
        { h: 'Mengapa catatan masuk dalam brief', p: [
          'Pekerjaan fisik gudang terlihat, tetapi nilainya bagi pemilik barang adalah posisi stok yang benar. GS1 Traceability Standard memandang ketertelusuran sebagai pencatatan peristiwa penting pada suatu barang yang dapat ditelusuri, seperti penerimaan, pengemasan, pengiriman, dan pengangkutan, beserta data yang menjelaskan tiap peristiwa. Anda tidak perlu mengadopsi standar itu untuk menangkap intinya: tentukan peristiwa mana yang perlu dicatat dan dengan rincian apa, misalnya lot, jumlah, waktu, dan lokasi, sebelum pallet pertama tiba.',
          'Demikian pula, label logistik GS1 memberi pallet atau karton pengenal yang dapat dipindai di setiap peristiwa. Bila pemasok atau pelanggan Anda memakainya, sampaikan.',
        ] },
        { h: 'Templat brief fasilitas', list: [
          'Barang: deskripsi, satuan simpan, ukuran dan berat satuan yang umum.',
          'Kondisi: suhu, kelembapan, penumpukan, pemisahan, keamanan.',
          'Inbound: pengiriman per minggu, jenis kendaraan, jenis dokumen, pemeriksaan saat tiba.',
          'Penyimpanan: jumlah SKU, lot, kontrol kedaluwarsa, perkiraan posisi saat puncak.',
          'Outbound: pesanan per hari, order line, jenis picking, pengangkut, jam cut-off.',
          'Catatan: target akurasi stok, frekuensi rekonsiliasi, laporan, koneksi sistem.',
          'Perubahan: puncak musiman dan pertumbuhan yang dapat diperkirakan.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Artikel ini menjelaskan cara menyusun kebutuhan. Artikel ini tidak membuat pernyataan apa pun tentang gudang, kapasitas, lokasi, atau sertifikasi VORA, dan angkanya rekaan. Aturan keselamatan, izin, dan batasan bangunan bersifat khusus untuk setiap fasilitas dan tidak dibahas di sini. Perlakukan setiap kebutuhan sebagai pertanyaan kepada operator fasilitas, dan harapkan jawabannya dikonfirmasi tertulis.',
        ] },
      ],
    },
  },
]
