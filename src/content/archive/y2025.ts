import type { ArchiveDraft } from './types'

export const y2025: ArchiveDraft[] = [
  {
    group: 'hs-classification-questions', year: 2025, quarter: 1,
    topic: { en: 'Customs', id: 'Kepabeanan' },
    sources: ['S5', 'S6'],
    en: {
      slug: 'hs-classification-ask-better-questions-about-the-product',
      title: 'HS Classification: Ask Better Questions About the Product',
      excerpt: 'A tariff code is the answer to a description. When the description is thin, the code is a guess. Gathering the right product facts is the part of classification that an importer controls.',
      seoTitle: 'HS Classification: Ask Better Questions About the Product | VORA',
      seoDescription: 'The product information a classification review needs, the difference between a supplier’s suggested code and a verified determination, and a dossier you can prepare.',
      coverAlt: 'A product information dossier with material, function and composition fields beside a sample',
      sections: [
        { h: 'A code answers a description', p: [
          'The Harmonized System is an international nomenclature of goods maintained by the World Customs Organization and used by customs administrations to describe goods in a common structure. In practice, an importer meets it as a numeric code on a declaration. The code looks like a fact about the product. It is closer to a conclusion about a description. If the description is incomplete, the conclusion is unreliable, however confident the number looks.',
          'This is why classification questions begin with the product and not with the code. The more precisely you can say what the product is made of, what it does and how it is presented, the better the review.',
        ] },
        { h: 'What a reviewer will ask', table: {
          head: ['Question', 'Why it matters', 'Where the answer usually is'],
          rows: [
            ['What is it made of?', 'Material often separates one heading from another', 'Specification sheet, bill of materials, supplier'],
            ['What does it do?', 'Function can decide between headings for similar-looking goods', 'Datasheet, manual, brochure'],
            ['How is it composed?', 'Mixtures, sets and assembled goods are read differently from simple goods', 'Composition statement, drawings'],
            ['In what form is it presented?', 'Complete, incomplete, disassembled, retail packing or bulk', 'Packing list, photographs'],
            ['What is it used for?', 'Intended use can matter where the nomenclature refers to it', 'Importer’s own use statement'],
            ['What supporting evidence exists?', 'Test reports and certificates can settle a factual question', 'Laboratory, manufacturer'],
          ],
        } },
        { h: 'A supplier’s code is a suggestion', p: [
          'Suppliers frequently write a code on the invoice. It may be correct. It may also reflect the supplier’s own country’s practice, an older edition of the nomenclature or a convenient approximation. The importer who makes the declaration carries the responsibility for what it says, so the useful stance is to treat the supplier’s code as a hypothesis and to mark it on your documents as suggested or as confirmed, depending on which it is.',
          'Do not look for a way to arrive at a lower duty. Look for the description that is true and complete, and let the classification follow from it.',
        ] },
        { h: 'A product dossier, step by step', steps: [
          'Write a one-sentence description in plain words that a non-specialist would understand.',
          'Add a technical description: material, dimensions, composition by percentage where relevant, and how it works.',
          'Attach the supplier’s datasheet or specification, a clear photograph and, if the product is a set, a list of its parts.',
          'State the intended use and the state in which it will be imported.',
          'Record the code the supplier gave, where it came from, and mark it as suggested.',
          'Note any previous ruling, question or inspection involving the same or a similar product.',
          'Keep the dossier with the import file so that the same answer is used for the next shipment.',
        ] },
        { h: 'A document-consistency example', example: {
          label: 'Hypothetical example, invented for illustration. No classification is suggested.',
          p: [
            'An importer describes an item on the invoice as "LED strip light, 5 m". The supplier’s datasheet describes it as a "decorative lighting set with power adapter and remote". The packing list lists the adapter and remote separately. Three descriptions now exist for what may be one article or three.',
            'Before asking for any code, the importer asks the supplier whether the strip, adapter and remote are packed and sold together as a set, and for a single wording to use on every document. Only then is the question put to an adviser or the authority.',
          ],
        }, after: ['The purpose of the example is to show the preparation. The article does not say how the goods in it would be classified, and neither should a reader assume it.'] },
        { h: 'Where to take the question', list: [
          'To your customs broker, who handles declarations and can raise a question with the authority on your behalf.',
          'To the authority’s published guidance and its channels for classification enquiries, as described on the customs administration’s pages.',
          'To the manufacturer, for technical facts you cannot find yourself.',
        ] },
        { h: 'Limits of this guide', p: [
          'This is preparation guidance and not a classification ruling. Classification depends on the edition of the nomenclature in force, national tariff structure and the authority’s reading of the facts, none of which this article assigns. The WCO page cited could not be reached on the access date and must be rechecked before publication; the DJBC guidance on import describes the declaration process that uses the code. Binding determinations come from the competent authority, not from an article.',
        ] },
      ],
    },
    id: {
      slug: 'klasifikasi-hs-mulai-dari-informasi-produk-yang-tepat',
      title: 'Klasifikasi HS: Mulai dari Informasi Produk yang Tepat',
      excerpt: 'Kode tarif adalah jawaban atas sebuah deskripsi. Bila deskripsinya tipis, kodenya hanya tebakan. Mengumpulkan fakta produk yang tepat adalah bagian klasifikasi yang bisa dikendalikan importir.',
      seoTitle: 'Klasifikasi HS: Mulai dari Informasi Produk yang Tepat | VORA',
      seoDescription: 'Informasi produk yang dibutuhkan untuk tinjauan klasifikasi, perbedaan antara kode usulan pemasok dan penetapan yang terverifikasi, serta dosir yang dapat Anda siapkan.',
      coverAlt: 'Dosir informasi produk dengan kolom bahan, fungsi, dan komposisi di samping sebuah sampel',
      sections: [
        { h: 'Kode menjawab deskripsi', p: [
          'Harmonized System adalah nomenklatur barang internasional yang dikelola World Customs Organization dan dipakai administrasi kepabeanan untuk menguraikan barang dalam struktur bersama. Dalam praktik, importir menjumpainya sebagai kode angka pada pemberitahuan. Kode itu tampak seperti fakta tentang produk. Sebenarnya ia lebih mirip kesimpulan atas sebuah deskripsi. Bila deskripsinya tidak lengkap, kesimpulannya tidak dapat diandalkan, seyakin apa pun angkanya terlihat.',
          'Karena itu pertanyaan klasifikasi dimulai dari produk, bukan dari kode. Semakin tepat Anda dapat menyebut bahan, fungsi, dan bentuk penyajian produk, semakin baik tinjauannya.',
        ] },
        { h: 'Yang akan ditanyakan peninjau', table: {
          head: ['Pertanyaan', 'Mengapa penting', 'Biasanya jawabannya ada di'],
          rows: [
            ['Terbuat dari apa?', 'Bahan sering memisahkan satu pos dari pos lain', 'Lembar spesifikasi, bill of materials, pemasok'],
            ['Apa fungsinya?', 'Fungsi dapat menentukan pilihan di antara pos untuk barang yang tampak mirip', 'Datasheet, manual, brosur'],
            ['Bagaimana komposisinya?', 'Campuran, set, dan barang rakitan dibaca berbeda dari barang sederhana', 'Pernyataan komposisi, gambar teknis'],
            ['Dalam bentuk apa diajukan?', 'Lengkap, tidak lengkap, terurai, kemasan eceran, atau curah', 'Packing list, foto'],
            ['Dipakai untuk apa?', 'Penggunaan dapat berpengaruh bila nomenklatur menyinggungnya', 'Pernyataan penggunaan dari importir'],
            ['Bukti pendukung apa yang ada?', 'Laporan uji dan sertifikat dapat menyelesaikan pertanyaan faktual', 'Laboratorium, produsen'],
          ],
        } },
        { h: 'Kode dari pemasok adalah usulan', p: [
          'Pemasok sering menuliskan kode pada invoice. Kode itu mungkin benar. Bisa juga mencerminkan praktik di negara pemasok sendiri, edisi nomenklatur yang lebih lama, atau pendekatan yang mudah. Importir yang membuat pemberitahuan memikul tanggung jawab atas isinya, sehingga sikap yang berguna adalah menganggap kode pemasok sebagai hipotesis dan menandainya pada dokumen Anda sebagai usulan atau sebagai terkonfirmasi, sesuai keadaannya.',
          'Jangan mencari cara untuk mencapai bea yang lebih rendah. Carilah deskripsi yang benar dan lengkap, lalu biarkan klasifikasi mengikutinya.',
        ] },
        { h: 'Menyusun dosir produk, langkah demi langkah', steps: [
          'Tulis deskripsi satu kalimat dalam bahasa sederhana yang dimengerti orang awam.',
          'Tambahkan deskripsi teknis: bahan, dimensi, komposisi dalam persen bila relevan, dan cara kerjanya.',
          'Lampirkan datasheet atau spesifikasi pemasok, foto yang jelas, dan bila produk berupa set, daftar bagiannya.',
          'Nyatakan penggunaan yang dimaksud dan keadaan barang saat diimpor.',
          'Catat kode yang diberikan pemasok, dari mana asalnya, dan tandai sebagai usulan.',
          'Catat putusan, pertanyaan, atau pemeriksaan sebelumnya yang melibatkan produk yang sama atau serupa.',
          'Simpan dosir bersama berkas impor agar jawaban yang sama dipakai untuk pengiriman berikutnya.',
        ] },
        { h: 'Contoh konsistensi dokumen', example: {
          label: 'Contoh hipotetis, dibuat untuk ilustrasi. Tidak ada klasifikasi yang disarankan.',
          p: [
            'Seorang importir menguraikan barang pada invoice sebagai "LED strip light, 5 m". Datasheet pemasok menyebutnya "decorative lighting set with power adapter and remote". Packing list mencantumkan adaptor dan remote secara terpisah. Kini ada tiga deskripsi untuk barang yang mungkin satu artikel atau tiga.',
            'Sebelum meminta kode apa pun, importir bertanya kepada pemasok apakah strip, adaptor, dan remote dikemas dan dijual bersama sebagai set, dan meminta satu rumusan kata untuk dipakai di semua dokumen. Baru setelah itu pertanyaan diajukan kepada penasihat atau otoritas.',
          ],
        }, after: ['Contoh ini hanya menunjukkan persiapannya. Artikel ini tidak menyebut bagaimana barang di dalamnya akan diklasifikasikan, dan pembaca tidak boleh menganggapnya demikian.'] },
        { h: 'Ke mana pertanyaan dibawa', list: [
          'Ke broker kepabeanan Anda, yang menangani pemberitahuan dan dapat mengajukan pertanyaan kepada otoritas atas nama Anda.',
          'Ke panduan yang diterbitkan otoritas dan kanal pertanyaan klasifikasinya, sebagaimana dijelaskan di laman administrasi kepabeanan.',
          'Ke produsen, untuk fakta teknis yang tidak dapat Anda temukan sendiri.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Ini adalah panduan persiapan, bukan putusan klasifikasi. Klasifikasi bergantung pada edisi nomenklatur yang berlaku, struktur tarif nasional, dan pembacaan otoritas atas fakta, yang tidak ditetapkan oleh artikel ini. Laman WCO yang dikutip tidak dapat diakses pada tanggal akses dan harus diperiksa ulang sebelum terbit; panduan DJBC tentang impor menjelaskan proses pemberitahuan yang memakai kode tersebut. Penetapan yang mengikat datang dari otoritas yang berwenang, bukan dari artikel.',
        ] },
      ],
    },
  },
  {
    group: 'si-vgm-bl-links', year: 2025, quarter: 2,
    topic: { en: 'Ocean documents', id: 'Dokumen laut' },
    sources: ['S2', 'S8'],
    en: {
      slug: 'shipping-instructions-vgm-and-the-bill-of-lading-check-the-links',
      title: 'Shipping Instructions, VGM and the Bill of Lading: Check the Links',
      excerpt: 'Three documents describe the same container in different roles. The mismatches that cause amendments and delays are usually small differences between them. A cross-check before cut-off costs less than a correction after.',
      seoTitle: 'Shipping Instructions, VGM and the Bill of Lading: Check the Links | VORA',
      seoDescription: 'How shipping instructions, verified gross mass and the bill of lading relate, who confirms each item, and a cross-check with a fictional annotated mismatch.',
      coverAlt: 'Three documents connected by lines that mark names, package counts and weights',
      sections: [
        { h: 'Three documents, three jobs', p: [
          'For an ocean container shipment, three documents are commonly prepared from overlapping data. Shipping instructions tell the carrier or forwarder what to put on the transport document. The verified gross mass states the weight of the packed container. The bill of lading, issued by or for the carrier, records the contract of carriage and, depending on its type, the receipt of the goods. They are related, but they do not have the same legal role, and an error in one does not automatically correct itself in another.',
        ] },
        { h: 'VGM: a shipper’s responsibility', p: [
          'The International Maritime Organization’s guidelines on the verified gross mass of a container, issued under SOLAS requirements, say that the shipper named on the bill of lading or equivalent document is responsible for obtaining the verified gross mass of a packed container and for providing it in a shipping document before the container is loaded. The guidelines describe two methods: weighing the packed and sealed container, or weighing all the cargo and contents and adding the container’s tare mass. The carrier and the terminal rely on this figure for the stowage plan.',
          'Two practical points follow. The verified mass is not the weight on the invoice, which may be a net or estimated figure. And the person who signs the declaration is making a statement of responsibility; it is best not to leave it to the last hour.',
        ] },
        { h: 'Who confirms what', table: {
          head: ['Item', 'Typically confirmed by', 'Where it appears'],
          rows: [
            ['Shipper, consignee and notify party names and addresses', 'The shipper, with the buyer’s details', 'Shipping instructions; printed on the bill of lading'],
            ['Description of goods', 'The shipper', 'Shipping instructions, bill of lading, and consistent with the commercial invoice'],
            ['Number and kind of packages', 'The shipper, from the packing list', 'Shipping instructions, bill of lading'],
            ['Verified gross mass of the container', 'The shipper, by one of the two methods', 'VGM declaration submitted per the carrier’s process'],
            ['Container and seal numbers', 'Recorded at stuffing; checked against the booking', 'Shipping instructions, bill of lading'],
            ['Freight terms (prepaid or collect)', 'Agreed with the buyer and the forwarder', 'Shipping instructions, bill of lading'],
          ],
        } },
        { h: 'A fictional annotated mismatch', example: {
          label: 'Fictional example, invented to show the cross-check',
          p: [
            'Shipping instructions: "20 pallets, 400 cartons, ceramic tiles, gross weight 18,200 kg". VGM submitted: 19,640 kg for the packed container. Packing list: 400 cartons, 18,200 kg gross for the cargo, plus pallets. Bill of lading draft: "400 cartons" and no pallet count.',
            'Three differences are visible. The VGM includes the container tare and the pallets, which the instruction figure does not, and that is consistent. The draft bill omits the pallet count that the instructions state, and that is not consistent. A short message to the forwarder before cut-off asks for the pallet count to be added. If the same draft had named a different consignee from the one in the instructions, the correction would be more serious, because the name controls who may take delivery.',
          ],
        } },
        { h: 'A cross-check before the cut-off', steps: [
          'Read the three documents side by side and mark every item that appears in more than one.',
          'Check names, spelling and addresses character by character on each document.',
          'Check counts: packages on the packing list, instructions and draft bill of lading should agree, with pallets stated the same way.',
          'Check weights: say which figure is cargo weight, which is packed-container mass, and do not mix them.',
          'Check the container and seal numbers against the booking confirmation.',
          'Check freight terms and the type of bill requested against the sale terms and the buyer’s instruction.',
          'Confirm the carrier’s cut-offs for instructions and VGM, and who submits each.',
        ] },
        { h: 'Why timing is part of the check', p: [
          'Carriers set cut-off times for submitting instructions and VGM. A late or amended submission can mean a missed vessel or an amendment fee under the carrier’s terms. The amount of time you need depends on how many people must confirm, so ask for the cut-off times when you book, not on the day.',
        ] },
        { h: 'Limits of this guide', p: [
          'Not every document has the same legal role. The effect of a bill of lading depends on its type and the applicable law, and the guidelines on verified mass describe the SOLAS-based approach but local rules and carrier processes add detail. FIATA publishes standard forwarding documents that its members may use, and their terms differ from a carrier’s bill of lading. The example is fictional and describes no real shipment.',
        ] },
      ],
    },
    id: {
      slug: 'shipping-instructions-vgm-dan-bill-of-lading-periksa-keterkaitannya',
      title: 'Shipping Instructions, VGM, dan Bill of Lading: Periksa Keterkaitannya',
      excerpt: 'Tiga dokumen menggambarkan kontainer yang sama dalam peran berbeda. Ketidakcocokan yang memicu amendment dan keterlambatan biasanya perbedaan kecil di antara ketiganya. Pemeriksaan silang sebelum cut-off lebih murah daripada koreksi sesudahnya.',
      seoTitle: 'Shipping Instructions, VGM, dan Bill of Lading: Periksa Keterkaitannya | VORA',
      seoDescription: 'Hubungan antara shipping instructions, verified gross mass, dan bill of lading, siapa yang mengonfirmasi tiap butir, serta pemeriksaan silang dengan contoh fiktif.',
      coverAlt: 'Tiga dokumen yang dihubungkan garis yang menandai nama, jumlah kemasan, dan berat',
      sections: [
        { h: 'Tiga dokumen, tiga tugas', p: [
          'Untuk pengiriman kontainer lewat laut, tiga dokumen lazim disusun dari data yang saling tumpang tindih. Shipping instructions memberi tahu pengangkut atau forwarder apa yang dituliskan pada dokumen angkutan. Verified gross mass menyatakan berat kontainer yang sudah berisi. Bill of lading, yang diterbitkan oleh atau untuk pengangkut, mencatat kontrak pengangkutan dan, bergantung pada jenisnya, tanda terima barang. Ketiganya berkaitan, tetapi tidak memiliki peran hukum yang sama, dan kesalahan pada satu dokumen tidak dengan sendirinya terkoreksi di dokumen lain.',
        ] },
        { h: 'VGM: tanggung jawab pengirim', p: [
          'Pedoman International Maritime Organization tentang verified gross mass kontainer, yang diterbitkan berdasarkan persyaratan SOLAS, menyatakan bahwa pengirim yang tercantum pada bill of lading atau dokumen setara bertanggung jawab memperoleh verified gross mass kontainer yang sudah berisi dan menyampaikannya dalam dokumen pengiriman sebelum kontainer dimuat. Pedoman itu menjelaskan dua metode: menimbang kontainer yang sudah dikemas dan disegel, atau menimbang seluruh muatan dan isinya lalu menambahkan tare kontainer. Pengangkut dan terminal mengandalkan angka ini untuk rencana penataan muatan.',
          'Ada dua hal praktis. Massa terverifikasi bukan berat pada invoice, yang bisa berupa berat bersih atau perkiraan. Dan orang yang menandatangani pernyataan itu sedang menyatakan tanggung jawab; sebaiknya tidak ditinggalkan hingga jam terakhir.',
        ] },
        { h: 'Siapa mengonfirmasi apa', table: {
          head: ['Butir', 'Umumnya dikonfirmasi oleh', 'Muncul di'],
          rows: [
            ['Nama dan alamat shipper, consignee, notify party', 'Shipper, dengan data pembeli', 'Shipping instructions; tercetak di bill of lading'],
            ['Uraian barang', 'Shipper', 'Shipping instructions, bill of lading, dan konsisten dengan commercial invoice'],
            ['Jumlah dan jenis kemasan', 'Shipper, dari packing list', 'Shipping instructions, bill of lading'],
            ['Verified gross mass kontainer', 'Shipper, dengan salah satu dari dua metode', 'Pernyataan VGM yang disampaikan sesuai proses pengangkut'],
            ['Nomor kontainer dan segel', 'Dicatat saat stuffing; dicocokkan dengan booking', 'Shipping instructions, bill of lading'],
            ['Ketentuan freight (prepaid atau collect)', 'Disepakati dengan pembeli dan forwarder', 'Shipping instructions, bill of lading'],
          ],
        } },
        { h: 'Ketidakcocokan fiktif yang diberi anotasi', example: {
          label: 'Contoh fiktif, dibuat untuk menunjukkan pemeriksaan silang',
          p: [
            'Shipping instructions: "20 pallet, 400 karton, ubin keramik, berat kotor 18.200 kg". VGM yang disampaikan: 19.640 kg untuk kontainer berisi. Packing list: 400 karton, 18.200 kg berat kotor muatan, belum termasuk pallet. Draf bill of lading: "400 cartons" tanpa jumlah pallet.',
            'Tiga perbedaan terlihat. VGM sudah memuat tare kontainer dan pallet yang tidak ada dalam angka instruksi, dan itu konsisten. Draf bill tidak menyebut jumlah pallet yang dinyatakan di instruksi, dan itu tidak konsisten. Pesan singkat kepada forwarder sebelum cut-off meminta jumlah pallet ditambahkan. Bila draf yang sama menyebut consignee berbeda dari yang ada di instruksi, koreksinya lebih serius, karena nama itu menentukan siapa yang berhak mengambil barang.',
          ],
        } },
        { h: 'Pemeriksaan silang sebelum cut-off', steps: [
          'Baca ketiga dokumen berdampingan dan tandai setiap butir yang muncul di lebih dari satu dokumen.',
          'Periksa nama, ejaan, dan alamat karakter demi karakter pada tiap dokumen.',
          'Periksa jumlah: kemasan pada packing list, instruksi, dan draf bill of lading harus sama, dengan pallet dinyatakan dengan cara yang sama.',
          'Periksa berat: sebutkan mana berat muatan, mana massa kontainer berisi, dan jangan dicampur.',
          'Periksa nomor kontainer dan segel terhadap konfirmasi booking.',
          'Periksa ketentuan freight dan jenis bill yang diminta terhadap ketentuan jual beli dan instruksi pembeli.',
          'Konfirmasi cut-off pengangkut untuk instruksi dan VGM, dan siapa yang menyampaikan masing-masing.',
        ] },
        { h: 'Mengapa waktu bagian dari pemeriksaan', p: [
          'Pengangkut menetapkan batas waktu penyampaian instruksi dan VGM. Penyampaian yang terlambat atau diubah bisa berarti tertinggal kapal atau dikenai biaya amendment menurut ketentuan pengangkut. Waktu yang Anda perlukan bergantung pada berapa banyak orang yang harus mengonfirmasi, jadi tanyakan jam cut-off saat booking, bukan pada hari keberangkatan.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Tidak semua dokumen memiliki peran hukum yang sama. Akibat hukum bill of lading bergantung pada jenisnya dan hukum yang berlaku, dan pedoman massa terverifikasi menjelaskan pendekatan berbasis SOLAS, sementara aturan setempat dan proses pengangkut menambah rinciannya. FIATA menerbitkan dokumen forwarding standar yang dapat dipakai anggotanya, dan ketentuannya berbeda dari bill of lading pengangkut. Contohnya fiktif dan tidak menggambarkan pengiriman nyata.',
        ] },
      ],
    },
  },
  {
    group: 'project-cargo-brief', year: 2025, quarter: 3,
    topic: { en: 'Project cargo', id: 'Project cargo' },
    sources: ['S3', 'S9'],
    en: {
      slug: 'project-cargo-build-the-technical-brief-before-choosing-the-move',
      title: 'Project Cargo: Build the Technical Brief Before Choosing the Move',
      excerpt: 'The method of moving a heavy or oversized item follows from its drawings, its mass, the route and the site. A technical brief collected first lets the engineering conversation start from facts, and keeps assumptions visible.',
      seoTitle: 'Project Cargo: Build the Technical Brief Before Choosing the Move | VORA',
      seoDescription: 'The drawings, dimensions, mass, lifting points and route constraints to collect before planning a heavy or oversized move, with a technical-input checklist.',
      coverAlt: 'A heavy-cargo drawing with dimensions, centre of gravity and lifting points annotated',
      sections: [
        { h: 'Method follows information', p: [
          'It is natural to begin a heavy-cargo inquiry with a question about the method: a trailer, a vessel, a crane, a barge. The answer to that question comes from information that usually exists but has not been collected: what the item is, what it weighs, how it can be held and where it has to go. The method is chosen once those facts are known, and the facts are the buyer’s to gather first.',
          'This article lists the information and explains why each item matters. It does not propose a lift plan or a lashing calculation, which are engineering outputs prepared and reviewed by qualified people for a specific move.',
        ] },
        { h: 'The technical brief', table: {
          head: ['Input', 'Why it matters', 'Source'],
          rows: [
            ['General arrangement drawing', 'Shows the shape, orientation in transport and projecting parts', 'Manufacturer'],
            ['Length, width, height in the transport position', 'Sets route clearances and the choice of equipment', 'Drawing, confirmed by measurement'],
            ['Mass of each piece, with tolerance', 'Sets lifting and carrying capacity; an estimate is stated as one', 'Manufacturer, weighing'],
            ['Centre of gravity', 'Governs how the item is lifted and how it behaves on a vehicle', 'Manufacturer drawing'],
            ['Lifting points and permitted lifting arrangement', 'Defines how the item may be handled safely', 'Manufacturer instructions'],
            ['Securing points and permitted loads', 'Defines where lashing may be attached', 'Manufacturer instructions'],
            ['Fragile or sensitive parts', 'Defines what must be protected or removed', 'Manufacturer'],
            ['Packing or protection requirements', 'Defines covers, supports and environmental limits', 'Manufacturer'],
          ],
        } },
        { h: 'Route and site', p: ['The item has to arrive at its position, not only at a port. The route and the site contribute constraints that can limit the method more than the item does.'], list: [
          'Origin site: access, ground conditions, space for equipment, and who is responsible for the first lift.',
          'Route: height and width limits, bridges, turning radii, and any restriction on timing or on convoy.',
          'Port or terminal: the handling equipment it can offer and its lifting capacity.',
          'Destination site: access, ground bearing capacity, space to unload and position, and who is responsible for the final lift.',
          'Interfaces: any permit, escort or utility coordination the route may require.',
        ] },
        { h: 'Interfaces and schedule', p: [
          'A heavy move depends on several parties acting in order: the manufacturer releasing the item, the carrier or vessel, the terminal, the road carrier and the site team. Each interface has a time window. Write down the target date and say which parts of it are fixed and which can move. Cargo that has to be on site before a construction step is a different case from cargo that can be stored.',
        ] },
        { h: 'A technical-input checklist', steps: [
          'Drawings: general arrangement, with the transport position marked.',
          'Dimensions and mass for every piece, with tolerances stated.',
          'Centre of gravity, lifting points and securing points from the manufacturer.',
          'Protection requirements and restrictions on handling.',
          'Origin and destination site information, including access and ground conditions.',
          'Route restrictions already known.',
          'The schedule, with fixed and flexible dates marked.',
          'Who is responsible for the lift at each end.',
        ] },
        { h: 'What a quotation at this stage can and cannot say', p: [
          'With the brief in hand, a forwarder can describe options, list what still has to be confirmed and indicate which parts need a survey or an engineering review. It cannot responsibly give a fixed method or price before the route and the site are checked. A claim to have carried similar cargo is not evidence about your cargo, and this article makes no statement about any project that VORA has completed.',
        ] },
        { h: 'Limits of this guide', p: [
          'Cargo securing and stowage follow recognised codes, such as the CTU Code for packing cargo transport units and the IMO CSS Code for stowage and securing on ships, applied by qualified people for the specific cargo. These references describe the framework; they do not replace a calculation. Nothing here is a lift plan, a lashing calculation or an approval to move cargo.',
        ] },
      ],
    },
    id: {
      slug: 'project-cargo-siapkan-brief-teknis-sebelum-memilih-metode-pengiriman',
      title: 'Project Cargo: Siapkan Brief Teknis Sebelum Memilih Metode Pengiriman',
      excerpt: 'Metode memindahkan barang berat atau berukuran besar mengikuti gambar teknis, massa, rute, dan lokasinya. Brief teknis yang dikumpulkan lebih dulu membuat diskusi rekayasa dimulai dari fakta dan menjaga asumsi tetap terlihat.',
      seoTitle: 'Project Cargo: Siapkan Brief Teknis Sebelum Memilih Metode | VORA',
      seoDescription: 'Gambar, dimensi, massa, titik angkat, dan kendala rute yang dikumpulkan sebelum merencanakan pemindahan barang berat atau berukuran besar, dengan daftar periksa input teknis.',
      coverAlt: 'Gambar kargo berat dengan dimensi, titik berat, dan titik angkat yang diberi anotasi',
      sections: [
        { h: 'Metode mengikuti informasi', p: [
          'Wajar bila inquiry kargo berat dimulai dengan pertanyaan tentang metode: trailer, kapal, crane, tongkang. Jawabannya datang dari informasi yang biasanya sudah ada tetapi belum dikumpulkan: barang apa itu, berapa beratnya, bagaimana barang itu dapat dipegang, dan ke mana ia harus pergi. Metode dipilih setelah fakta-fakta itu diketahui, dan fakta itu pertama-tama menjadi tugas pembeli untuk dikumpulkan.',
          'Artikel ini mendaftar informasinya dan menjelaskan mengapa tiap butir penting. Artikel ini tidak mengusulkan rencana pengangkatan atau perhitungan lashing, yang merupakan keluaran rekayasa yang disusun dan ditinjau oleh orang yang kompeten untuk pemindahan tertentu.',
        ] },
        { h: 'Brief teknis', table: {
          head: ['Input', 'Mengapa penting', 'Sumber'],
          rows: [
            ['Gambar general arrangement', 'Menunjukkan bentuk, orientasi saat diangkut, dan bagian yang menonjol', 'Produsen'],
            ['Panjang, lebar, tinggi pada posisi angkut', 'Menentukan ruang bebas rute dan pilihan peralatan', 'Gambar, dikonfirmasi dengan pengukuran'],
            ['Massa tiap bagian, beserta toleransi', 'Menentukan kapasitas angkat dan angkut; perkiraan dinyatakan sebagai perkiraan', 'Produsen, penimbangan'],
            ['Titik berat', 'Menentukan cara barang diangkat dan perilakunya di kendaraan', 'Gambar produsen'],
            ['Titik angkat dan pengaturan pengangkatan yang diizinkan', 'Menentukan cara penanganan yang aman', 'Instruksi produsen'],
            ['Titik pengikatan dan beban yang diizinkan', 'Menentukan di mana lashing boleh dipasang', 'Instruksi produsen'],
            ['Bagian rapuh atau sensitif', 'Menentukan apa yang harus dilindungi atau dilepas', 'Produsen'],
            ['Persyaratan kemasan atau perlindungan', 'Menentukan penutup, penyangga, dan batas lingkungan', 'Produsen'],
          ],
        } },
        { h: 'Rute dan lokasi', p: ['Barang harus tiba di posisinya, bukan hanya di pelabuhan. Rute dan lokasi menambah kendala yang bisa membatasi metode lebih besar daripada barangnya sendiri.'], list: [
          'Lokasi asal: akses, kondisi tanah, ruang untuk peralatan, dan siapa yang bertanggung jawab atas pengangkatan pertama.',
          'Rute: batas tinggi dan lebar, jembatan, radius putar, dan pembatasan waktu atau konvoi.',
          'Pelabuhan atau terminal: peralatan penanganan yang dapat ditawarkan dan kapasitas angkatnya.',
          'Lokasi tujuan: akses, daya dukung tanah, ruang untuk membongkar dan memosisikan, serta siapa yang bertanggung jawab atas pengangkatan akhir.',
          'Antarmuka: izin, pengawalan, atau koordinasi utilitas yang mungkin diperlukan rute.',
        ] },
        { h: 'Antarmuka dan jadwal', p: [
          'Pemindahan berat bergantung pada beberapa pihak yang bertindak berurutan: produsen yang melepas barang, pengangkut atau kapal, terminal, pengangkut jalan, dan tim lokasi. Setiap antarmuka punya jendela waktu. Tuliskan tanggal sasaran dan sebutkan bagian mana yang tetap dan mana yang dapat bergeser. Kargo yang harus berada di lokasi sebelum tahap konstruksi tertentu adalah kasus berbeda dari kargo yang dapat disimpan.',
        ] },
        { h: 'Daftar periksa input teknis', steps: [
          'Gambar: general arrangement, dengan posisi angkut ditandai.',
          'Dimensi dan massa tiap bagian, dengan toleransi yang dinyatakan.',
          'Titik berat, titik angkat, dan titik pengikatan dari produsen.',
          'Persyaratan perlindungan dan pembatasan penanganan.',
          'Informasi lokasi asal dan tujuan, termasuk akses dan kondisi tanah.',
          'Kendala rute yang sudah diketahui.',
          'Jadwal, dengan tanggal tetap dan fleksibel ditandai.',
          'Siapa yang bertanggung jawab atas pengangkatan di masing-masing ujung.',
        ] },
        { h: 'Yang bisa dan tidak bisa dikatakan penawaran pada tahap ini', p: [
          'Dengan brief di tangan, forwarder dapat menguraikan pilihan, mendaftar hal yang masih harus dikonfirmasi, dan menunjukkan bagian yang memerlukan survei atau tinjauan rekayasa. Forwarder tidak dapat secara bertanggung jawab memberi metode atau harga tetap sebelum rute dan lokasi diperiksa. Klaim pernah membawa kargo serupa bukan bukti tentang kargo Anda, dan artikel ini tidak membuat pernyataan tentang proyek apa pun yang telah diselesaikan VORA.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Pengikatan dan penataan kargo mengikuti kode yang diakui, seperti CTU Code untuk pengemasan unit angkut kargo dan CSS Code IMO untuk penataan dan pengikatan di kapal, yang diterapkan oleh orang kompeten untuk kargo tertentu. Rujukan ini menjelaskan kerangkanya; ia tidak menggantikan perhitungan. Tidak ada di sini yang merupakan rencana pengangkatan, perhitungan lashing, atau persetujuan untuk memindahkan kargo.',
        ] },
      ],
    },
  },
  {
    group: 'proof-of-delivery', year: 2025, quarter: 4,
    topic: { en: 'Delivery records', id: 'Catatan pengiriman' },
    sources: ['S7', 'S11'],
    en: {
      slug: 'proof-of-delivery-record-the-handover-and-the-exceptions',
      title: 'Proof of Delivery: Record the Handover and the Exceptions',
      excerpt: 'A proof of delivery is a record of a handover: who received what, when and in what condition. Its value lies in the exceptions it captures and the care taken with the personal data it holds.',
      seoTitle: 'Proof of Delivery: Record the Handover and the Exceptions | VORA',
      seoDescription: 'What a proof of delivery should record, how to note quantity and condition exceptions, how to treat location and personal data, and what a POD is not.',
      coverAlt: 'A sanitized fictional proof of delivery with the receiver, time, condition and exception fields annotated',
      sections: [
        { h: 'What a proof of delivery is', p: [
          'A proof of delivery (POD) is a record that cargo was handed over at a place and time, to a named person, in a stated condition. It supports the carrier’s statement that delivery happened and the receiver’s statement of what was received. It is a handover record. It is not proof that an invoice has been paid, and it does not settle on its own whether a claim is valid.',
          'The simplest PODs record only a signature. A useful POD also records what the signature refers to.',
        ] },
        { h: 'What to record', table: {
          head: ['Field', 'Why it matters'],
          rows: [
            ['Receiver’s name and role', 'Shows who accepted, and whether they were entitled to'],
            ['Date and time of handover', 'Fixes the moment responsibility changed hands'],
            ['Place of handover', 'Matches the delivery instruction'],
            ['Reference of the delivery', 'Links the POD to the order, delivery note or transport document'],
            ['Quantity received against quantity expected', 'Makes a shortage or surplus visible at once'],
            ['Condition of the packages', 'Records visible damage, wetness, opened or resealed packages'],
            ['Exceptions, in words', 'States the specific difference, not a general remark'],
            ['Photographs', 'Show packages, labels and any exception as they were'],
            ['Signature or other acknowledgement', 'Shows the receiver’s acceptance of the record'],
          ],
        } },
        { h: 'Handling exceptions', p: [
          'The value of a POD is greatest when something is not as expected. A clean signature next to a damaged carton hurts everyone. A specific note helps everyone, including the carrier.',
        ], list: [
          'Record the exact count: "received 11 of 12 cartons; carton 7 not delivered".',
          'Record the condition in observable terms: "carton 4 crushed at the corner, contents not inspected".',
          'Photograph the exception before moving the packages.',
          'If the receiver refuses part of the delivery, record what was refused and the reason given.',
          'If the receiver signs "subject to inspection", record that, so the later inspection has a starting point.',
        ] },
        { h: 'A sanitized fictional example', example: {
          label: 'Fictional example, invented to show the fields. No real person or delivery is described.',
          p: ['"Delivery reference DN-0001. Delivered to the receiving clerk at the stated dock at 10:42. Expected 8 pallets; received 8. Pallet 5 stretch film torn, two cartons visibly wet, photographed. Receiver signed with the note \'wet cartons, contents to be checked\'."'],
        }, after: ['The fields in the example are the ones from the table; a reader can see at a glance what was received, in what state and what remains open.'] },
        { h: 'Location, photographs and personal data', p: [
          'A POD can carry a signature, photographs and sometimes a location reading. Each is personal or potentially identifying data about the receiver or the site. Collect what you need to document the handover and no more, tell the receiver what is being recorded, and keep it only as long as the purpose requires. If location is recorded, say why and let the receiver see it. Photographs should focus on the cargo and its packaging, not on people.',
        ] },
        { h: 'A QR code is a pointer, not a legal conclusion', p: [
          'Many delivery documents carry a QR code so that the record can be found and checked. It identifies a record. It does not by itself make a signature legally valid or the record conclusive. Whether an electronic acknowledgement has legal effect depends on applicable law and on the parties’ agreement. The GS1 Logistic Label Guideline and the GS1 Traceability Standard describe identifiers and events for tracking logistic units; they do not decide questions of legal validity.',
        ] },
        { h: 'Limits of this guide', p: [
          'This is general guidance on content and handling. It is not legal advice and does not address the legal status of any signature or the specific privacy obligations that apply to your operation, which need a separate current review. The example is sanitized and fictional.',
        ] },
      ],
    },
    id: {
      slug: 'proof-of-delivery-catat-serah-terima-dan-pengecualiannya',
      title: 'Proof of Delivery: Catat Serah Terima dan Pengecualiannya',
      excerpt: 'Proof of delivery adalah catatan serah terima: siapa menerima apa, kapan, dan dalam kondisi bagaimana. Nilainya ada pada pengecualian yang dicatat dan kehati-hatian terhadap data pribadi di dalamnya.',
      seoTitle: 'Proof of Delivery: Catat Serah Terima dan Pengecualiannya | VORA',
      seoDescription: 'Apa yang perlu dicatat dalam proof of delivery, cara mencatat pengecualian jumlah dan kondisi, cara memperlakukan lokasi dan data pribadi, serta apa yang bukan POD.',
      coverAlt: 'Proof of delivery fiktif yang disanitasi dengan kolom penerima, waktu, kondisi, dan pengecualian diberi anotasi',
      sections: [
        { h: 'Apa itu proof of delivery', p: [
          'Proof of delivery (POD) adalah catatan bahwa barang diserahkan di suatu tempat dan waktu, kepada orang bernama, dalam kondisi tertentu. POD mendukung pernyataan pengangkut bahwa pengantaran terjadi dan pernyataan penerima tentang apa yang diterima. POD adalah catatan serah terima. POD bukan bukti bahwa invoice sudah dibayar, dan tidak dengan sendirinya menentukan sah tidaknya suatu klaim.',
          'POD paling sederhana hanya mencatat tanda tangan. POD yang berguna juga mencatat apa yang dirujuk tanda tangan itu.',
        ] },
        { h: 'Yang dicatat', table: {
          head: ['Kolom', 'Mengapa penting'],
          rows: [
            ['Nama dan jabatan penerima', 'Menunjukkan siapa yang menerima, dan apakah berhak'],
            ['Tanggal dan jam serah terima', 'Menetapkan saat tanggung jawab berpindah'],
            ['Tempat serah terima', 'Sesuai dengan instruksi pengantaran'],
            ['Referensi pengantaran', 'Menghubungkan POD dengan order, surat jalan, atau dokumen angkutan'],
            ['Jumlah diterima dibanding yang diharapkan', 'Membuat kekurangan atau kelebihan langsung terlihat'],
            ['Kondisi kemasan', 'Mencatat kerusakan yang terlihat, basah, atau kemasan yang dibuka atau disegel ulang'],
            ['Pengecualian, dalam kata-kata', 'Menyebut selisih yang spesifik, bukan komentar umum'],
            ['Foto', 'Menunjukkan kemasan, label, dan pengecualian sebagaimana adanya'],
            ['Tanda tangan atau persetujuan lain', 'Menunjukkan penerima menyetujui catatan'],
          ],
        } },
        { h: 'Menangani pengecualian', p: [
          'Nilai POD paling besar ketika ada yang tidak sesuai harapan. Tanda tangan bersih di samping karton rusak merugikan semua pihak. Catatan yang spesifik membantu semua pihak, termasuk pengangkut.',
        ], list: [
          'Catat jumlah persisnya: "diterima 11 dari 12 karton; karton 7 tidak terkirim".',
          'Catat kondisi dengan istilah yang dapat diamati: "karton 4 remuk di sudut, isi belum diperiksa".',
          'Foto pengecualian sebelum kemasan dipindahkan.',
          'Bila penerima menolak sebagian pengantaran, catat apa yang ditolak dan alasan yang diberikan.',
          'Bila penerima menandatangani "dengan syarat pemeriksaan", catat hal itu agar pemeriksaan kemudian punya titik awal.',
        ] },
        { h: 'Contoh fiktif yang disanitasi', example: {
          label: 'Contoh fiktif, dibuat untuk menunjukkan kolom-kolomnya. Tidak ada orang atau pengantaran nyata yang digambarkan.',
          p: ['"Referensi pengantaran DN-0001. Diserahkan kepada petugas penerimaan di dock yang disebut pukul 10.42. Diharapkan 8 pallet; diterima 8. Stretch film pallet 5 robek, dua karton terlihat basah, sudah difoto. Penerima menandatangani dengan catatan \'karton basah, isi akan diperiksa\'."'],
        }, after: ['Kolom dalam contoh sama dengan yang ada di tabel; pembaca dapat melihat sekilas apa yang diterima, dalam keadaan apa, dan apa yang masih terbuka.'] },
        { h: 'Lokasi, foto, dan data pribadi', p: [
          'POD dapat memuat tanda tangan, foto, dan kadang pembacaan lokasi. Masing-masing adalah data pribadi atau data yang berpotensi mengidentifikasi penerima atau lokasi. Kumpulkan yang diperlukan untuk mendokumentasikan serah terima dan tidak lebih, beri tahu penerima apa yang dicatat, dan simpan hanya selama tujuan menghendaki. Bila lokasi dicatat, jelaskan alasannya dan biarkan penerima melihatnya. Foto sebaiknya berfokus pada barang dan kemasannya, bukan pada orang.',
        ] },
        { h: 'Kode QR adalah penunjuk, bukan kesimpulan hukum', p: [
          'Banyak dokumen pengantaran memuat kode QR agar catatannya dapat ditemukan dan diperiksa. Kode itu mengidentifikasi sebuah catatan. Kode itu tidak dengan sendirinya membuat tanda tangan sah secara hukum atau catatan menjadi final. Apakah pengakuan elektronik berakibat hukum bergantung pada hukum yang berlaku dan kesepakatan para pihak. GS1 Logistic Label Guideline dan GS1 Traceability Standard menjelaskan pengenal dan peristiwa untuk melacak unit logistik; keduanya tidak memutuskan soal keabsahan hukum.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Ini adalah panduan umum tentang isi dan penanganan. Ini bukan nasihat hukum dan tidak membahas status hukum suatu tanda tangan atau kewajiban privasi khusus yang berlaku pada operasi Anda, yang memerlukan tinjauan terkini tersendiri. Contohnya disanitasi dan fiktif.',
        ] },
      ],
    },
  },
]
