import type { ArchiveDraft } from './types'

export const y2023: ArchiveDraft[] = [
  {
    group: 'shipment-brief', year: 2023, quarter: 1,
    topic: { en: 'Quotations', id: 'Penawaran' },
    sources: ['S1', 'S3', 'S4'],
    en: {
      slug: 'build-a-shipment-brief-before-you-request-a-freight-quote',
      title: 'Before You Request a Freight Quote: Build a Shipment Brief',
      excerpt: 'A rate request fails most often on missing facts, not on price. Nine items turn a vague message into a brief that a forwarder can quote, and a few unknowns will always stop a firm figure.',
      seoTitle: 'Build a Shipment Brief Before You Request a Freight Quote | VORA',
      seoDescription: 'The nine facts a forwarder needs to quote freight, an incomplete versus complete example request, and a checklist you can reuse.',
      coverAlt: 'An annotated shipment brief with the nine fields marked in the margin',
      sections: [
        { h: 'Why the brief comes before the rate', p: [
          'Most quotation requests start with a route and a question: how much? The question is reasonable, but a price is a statement about a specific cargo, moved a specific way, on a specific date. When those specifics are missing, the person preparing the quotation has two choices. They can ask, which costs a day, or they can assume, which produces a figure that changes later. A brief is the habit of answering the questions before they are asked.',
          'A brief does not need to be long. It needs to be unambiguous. One page, written once and kept, can be reused for every supplier or forwarder you ask, which also makes the answers comparable.',
        ] },
        { h: 'The nine items', p: ['These are the items a forwarder reaches for first. Each one changes either the method of transport, the cost basis or the paperwork.'], table: {
          head: ['Item', 'Why it matters', 'What to write'],
          rows: [
            ['Cargo description', 'Decides handling, documents and whether special acceptance is needed', 'Plain words: "office chairs, flat-packed", not only a product code'],
            ['Packing', 'Decides how the cargo can be stacked, lifted and loaded', 'Cartons, pallets, crates or loose; number of each'],
            ['Gross weight', 'Basis for charges and for equipment limits', 'Total in kg, and per package if they differ'],
            ['Dimensions', 'Volume can set the charge for light cargo', 'Length × width × height in cm for each package size'],
            ['Ready date', 'Sets which departures are realistic', 'The date the goods can be collected, not the date you hope to ship'],
            ['Route', 'Defines the lane and the handover points', 'Origin and destination at city or port level, with addresses for door service'],
            ['Trade term', 'Shows who arranges and pays each part', 'The Incoterm agreed with the other party, with the named place'],
            ['Access', 'A site with no loading dock or a height limit changes the vehicle', 'Dock or ground level, vehicle limits, receiving hours'],
            ['Scope', 'Defines what the quotation must include', 'Pickup, main leg, customs, delivery: which are in, which are not'],
          ],
        } },
        { h: 'An example, incomplete and complete', p: ['The two requests below are **hypothetical**. They are written to show the difference and do not describe a real customer or a real quotation.'], example: {
          label: 'Hypothetical request A (incomplete)',
          p: ['"Hello, please quote a shipment of furniture from Surabaya to Singapore. Urgent. Thanks."'],
        }, after: [
          'Request A leaves the forwarder with eight open questions: how much furniture, how it is packed, how heavy and large, when it is ready, by air or sea, who pays at destination, whether pickup is needed and whether the buyer clears customs. None can be guessed safely.',
        ] },
        { h: 'The same request, complete', example: {
          label: 'Hypothetical request B (complete)',
          p: ['"Route: Surabaya (factory, ground-level loading) to Singapore (warehouse with dock). Cargo: 24 flat-packed office chairs in 6 cartons of 4. Each carton 80 × 60 × 40 cm, 22 kg. Total 132 kg. Ready for collection on a stated date. Sea freight preferred; air acceptable if the difference is shown. Trade term agreed with the buyer: delivered to the buyer’s warehouse, import clearance by the buyer. Please quote pickup, main leg and delivery to the dock, and state what is not included."'],
        }, after: [
          'Request B can be quoted, and just as usefully, it can be questioned. The forwarder can answer "this carton size is awkward for this mode" because the numbers are there.',
        ] },
        { h: 'Which unknowns prevent a firm quote', p: [
          'Some gaps can be bridged with a stated assumption. Others cannot. A forwarder can quote with an assumed ready date if the quotation says so. A forwarder cannot responsibly give a firm figure when any of the following is unknown:',
        ], list: [
          'The packed dimensions and weight, because they set the cost basis for both air and sea, and the equipment.',
          'The mode and the scope, because a door-to-door price and a port-to-port price answer different questions.',
          'Whether the cargo needs special acceptance, such as batteries, liquids or restricted goods.',
          'The trade term, because it decides which costs belong in the quotation and which sit with the other party.',
        ], after: [
          'If you do not yet know one of these, write "not known yet" rather than leaving it out. A stated unknown tells the forwarder what to treat as an estimate.',
        ] },
        { h: 'A checklist you can reuse', steps: [
          'Describe the goods in plain words.',
          'State how many packages and how they are packed.',
          'Give the gross weight and the size of each package, with units.',
          'Give the ready date and what limits access at pickup and delivery.',
          'Name the route and the agreed trade term with its named place.',
          'Say which steps you want quoted and which stay with another party.',
          'Mark anything you do not know yet.',
          'Attach the supplier’s packing list or a photograph when you have one.',
        ] },
        { h: 'Limits of this guide', p: [
          'A brief improves a quotation; it does not fix the price. Carrier and airline rates, surcharges and exchange rates move, and a quotation is valid for the period it states. Packing suitability is a property of the cargo itself, and a forwarder can flag a concern but cannot certify your packaging. The chargeable-weight basis for air freight is set by the carrier’s own conditions, so confirm it in the quotation.',
        ] },
      ],
    },
    id: {
      slug: 'siapkan-brief-pengiriman-sebelum-minta-rate',
      title: 'Sebelum Minta Rate: Siapkan Brief Pengiriman yang Lengkap',
      excerpt: 'Permintaan rate sering tertahan karena data kurang, bukan karena harga. Sembilan butir ini mengubah pesan yang samar menjadi brief yang bisa dihitung, dan beberapa hal yang belum diketahui memang akan menghalangi angka pasti.',
      seoTitle: 'Brief Pengiriman Sebelum Minta Rate Freight | VORA',
      seoDescription: 'Sembilan data yang dibutuhkan forwarder untuk menghitung freight, contoh permintaan yang kurang dan yang lengkap, serta daftar periksa yang bisa dipakai ulang.',
      coverAlt: 'Brief pengiriman dengan sembilan kolom yang diberi catatan di tepi',
      sections: [
        { h: 'Mengapa brief mendahului rate', p: [
          'Kebanyakan permintaan penawaran dimulai dari rute dan satu pertanyaan: berapa? Pertanyaan itu wajar, tetapi harga adalah pernyataan tentang barang tertentu, yang dikirim dengan cara tertentu, pada tanggal tertentu. Bila hal-hal itu belum jelas, orang yang menyusun penawaran punya dua pilihan: bertanya, yang memakan waktu sehari, atau berasumsi, yang menghasilkan angka yang kelak berubah. Brief adalah kebiasaan menjawab pertanyaan sebelum ditanyakan.',
          'Brief tidak perlu panjang, tetapi harus tegas. Satu halaman yang ditulis sekali dan disimpan dapat dipakai untuk setiap pemasok atau forwarder yang Anda hubungi, sehingga jawabannya juga bisa dibandingkan.',
        ] },
        { h: 'Sembilan butir yang perlu ada', p: ['Inilah butir yang pertama kali dicari forwarder. Masing-masing memengaruhi moda angkutan, dasar biaya, atau dokumen.'], table: {
          head: ['Butir', 'Mengapa penting', 'Yang perlu ditulis'],
          rows: [
            ['Deskripsi barang', 'Menentukan penanganan, dokumen, dan perlu tidaknya persetujuan khusus', 'Bahasa sederhana: "kursi kantor, dikirim dalam keadaan terlepas", tidak berhenti pada kode produk'],
            ['Kemasan', 'Menentukan cara menumpuk, mengangkat, dan memuat', 'Karton, pallet, peti, atau curah; jumlah masing-masing'],
            ['Berat kotor', 'Dasar biaya dan batas peralatan', 'Total dalam kg, dan per kemasan bila berbeda'],
            ['Dimensi', 'Volume dapat menentukan biaya untuk barang ringan', 'Panjang × lebar × tinggi dalam cm untuk setiap ukuran kemasan'],
            ['Tanggal siap', 'Menentukan keberangkatan yang realistis', 'Tanggal barang bisa diambil, bukan tanggal yang Anda harapkan'],
            ['Rute', 'Menetapkan jalur dan titik serah terima', 'Asal dan tujuan sampai tingkat kota atau pelabuhan; alamat lengkap untuk layanan door'],
            ['Term perdagangan', 'Menunjukkan siapa yang mengatur dan membayar tiap bagian', 'Incoterm yang disepakati dengan pihak lawan, beserta tempat yang disebut'],
            ['Akses', 'Lokasi tanpa dock atau dengan batas tinggi mengubah pilihan kendaraan', 'Dock atau permukaan tanah, batas kendaraan, jam penerimaan'],
            ['Cakupan', 'Menentukan apa yang harus ada dalam penawaran', 'Penjemputan, pengiriman utama, kepabeanan, pengantaran: mana yang termasuk, mana yang tidak'],
          ],
        } },
        { h: 'Contoh: permintaan yang kurang dan yang lengkap', p: ['Dua permintaan berikut **hipotetis**. Keduanya ditulis untuk menunjukkan perbedaannya dan tidak menggambarkan pelanggan atau penawaran yang sebenarnya.'], example: {
          label: 'Permintaan hipotetis A (kurang lengkap)',
          p: ['"Halo, mohon penawaran kiriman furnitur dari Surabaya ke Singapura. Mendesak. Terima kasih."'],
        }, after: [
          'Permintaan A meninggalkan delapan pertanyaan terbuka: jumlah furnitur, kemasan, berat dan ukuran, tanggal siap, udara atau laut, siapa yang membayar di tujuan, perlu tidaknya penjemputan, dan siapa yang mengurus kepabeanan pembeli. Tak satu pun aman ditebak.',
        ] },
        { h: 'Permintaan yang sama, dalam bentuk lengkap', example: {
          label: 'Permintaan hipotetis B (lengkap)',
          p: ['"Rute: Surabaya (pabrik, muat di permukaan tanah) ke Singapura (gudang dengan dock). Barang: 24 kursi kantor terlepas dalam 6 karton berisi 4. Tiap karton 80 × 60 × 40 cm, 22 kg. Total 132 kg. Siap diambil pada tanggal yang disebutkan. Utamakan sea freight; air freight boleh bila selisihnya ditunjukkan. Term yang disepakati dengan pembeli: diantar ke gudang pembeli, import clearance oleh pembeli. Mohon hitung penjemputan, pengiriman utama, dan pengantaran sampai dock, serta sebutkan yang tidak termasuk."'],
        }, after: [
          'Permintaan B bisa dihitung, dan sama bergunanya, bisa dikritisi. Forwarder dapat menjawab "ukuran karton ini kurang pas untuk moda ini" karena angkanya tersedia.',
        ] },
        { h: 'Hal yang belum diketahui dan menghalangi angka pasti', p: [
          'Sebagian kekosongan dapat dijembatani dengan asumsi yang ditulis. Sebagian lain tidak. Forwarder bisa menghitung dengan asumsi tanggal siap bila penawaran menyebutkannya. Forwarder tidak bisa memberi angka pasti secara bertanggung jawab bila salah satu hal berikut belum diketahui:',
        ], list: [
          'Dimensi dan berat setelah dikemas, karena menentukan dasar biaya udara maupun laut, serta peralatan yang dipakai.',
          'Moda dan cakupan, karena harga door-to-door dan port-to-port menjawab pertanyaan yang berbeda.',
          'Apakah barang memerlukan persetujuan khusus, misalnya baterai, cairan, atau barang yang dibatasi.',
          'Term perdagangan, karena menentukan biaya mana yang masuk penawaran dan mana yang ada di pihak lain.',
        ], after: [
          'Bila ada yang belum Anda ketahui, tulis "belum diketahui" daripada menghilangkannya. Hal yang dinyatakan belum pasti memberi tahu forwarder bagian mana yang diperlakukan sebagai estimasi.',
        ] },
        { h: 'Daftar periksa yang bisa dipakai ulang', steps: [
          'Jelaskan barang dengan bahasa sederhana.',
          'Sebutkan jumlah kemasan dan cara pengemasannya.',
          'Cantumkan berat kotor dan ukuran tiap kemasan, lengkap dengan satuan.',
          'Cantumkan tanggal siap dan hal yang membatasi akses di lokasi jemput dan antar.',
          'Sebutkan rute dan term perdagangan beserta tempatnya.',
          'Katakan langkah mana yang ingin dihitung dan mana yang tetap di pihak lain.',
          'Tandai hal yang belum Anda ketahui.',
          'Lampirkan packing list pemasok atau foto bila ada.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Brief memperbaiki penawaran, tetapi tidak menetapkan harga. Tarif pelayaran dan maskapai, surcharge, dan kurs bergerak, dan penawaran berlaku sesuai periode yang tertulis. Kesesuaian kemasan adalah sifat barang itu sendiri; forwarder dapat memberi catatan, tetapi tidak dapat mensertifikasi kemasan Anda. Dasar chargeable weight untuk air freight ditetapkan oleh ketentuan maskapai, jadi pastikan dalam penawaran.',
        ] },
      ],
    },
  },
  {
    group: 'incoterms-freight-scope', year: 2023, quarter: 2,
    topic: { en: 'Trade terms', id: 'Term perdagangan' },
    sources: ['S1', 'S8'],
    en: {
      slug: 'incoterms-and-freight-scope-put-responsibilities-in-writing',
      title: 'Incoterms and Freight Scope: Put Responsibilities in Writing',
      excerpt: 'A trade term settles part of the allocation between buyer and seller. It does not write the freight quotation for you. Here is how to turn a term into a list of questions that the forwarder can answer in writing.',
      seoTitle: 'Incoterms and Freight Scope: Put Responsibilities in Writing | VORA',
      seoDescription: 'What an Incoterm settles, what it leaves open, and the questions buyer, seller and forwarder should answer before a shipment is booked.',
      coverAlt: 'A responsibility matrix with handover points marked along a route',
      sections: [
        { h: 'What a trade term does and does not do', p: [
          'Incoterms® 2020 is a set of eleven three-letter terms published by the International Chamber of Commerce. They reflect business-to-business practice in sales contracts and allocate costs, risks and obligations between buyer and seller. That is the whole job of the term: it sits in the sales contract between two parties.',
          'A freight forwarder is usually not a party to that contract. The forwarder works from a separate agreement with whoever engages it, and that agreement has its own scope: which steps are performed, by whom, and for what price. A trade term informs the scope, but it does not replace it. "We agreed FOB" tells the forwarder where the seller’s obligations are meant to end. It does not say whether the forwarder is booking the main leg, handling export clearance or arranging delivery at the other end.',
          'The practical consequence is simple. Treat the trade term as input to the quotation request, and then ask for the scope in writing.',
        ] },
        { h: 'Reading the handover as a line, not a label', p: [
          'It helps to picture the movement as a line with handover points: the seller’s premises, the export port or airport, the main carriage, the import port or airport, and the buyer’s premises. Each term places a different marker on that line to show where responsibility for specific things changes hands. The exact allocation for each of the eleven terms is in the rules themselves, which are published by the ICC and are worth reading in the original rather than relying on a summary.',
          'What you can do without reproducing the rule text is to ask, for each segment of the line, four things: who arranges it, who pays for it, who carries the risk of loss or damage during it, and who holds the documents needed for it. If two parties give different answers for the same segment, the gap is where a dispute eventually starts.',
        ] },
        { h: 'A responsibility matrix you can fill in', p: ['Copy this table into your shipment brief. Fill each row with the party’s name, not with a yes or no. A name makes a gap visible.'], table: {
          head: ['Segment', 'Arranges', 'Pays', 'Document needed', 'Confirmed in writing by'],
          rows: [
            ['Pickup at seller’s premises', '', '', 'Collection order / cargo readiness', ''],
            ['Export clearance', '', '', 'Export declaration and supporting documents', ''],
            ['Main carriage', '', '', 'Booking and transport document', ''],
            ['Import clearance', '', '', 'Import declaration and supporting documents', ''],
            ['Delivery at destination', '', '', 'Delivery order / proof of delivery', ''],
          ],
        } },
        { h: 'A worked example with an invented purchase', example: {
          label: 'Hypothetical case: buyer in Jakarta, seller abroad',
          p: [
            'A Jakarta buyer agrees to purchase machine parts from a supplier overseas. The sales contract names a term that places the main carriage with the buyer. The buyer asks a forwarder to quote the sea freight and the import side.',
            'The forwarder replies with a question rather than a price: does the buyer want the quotation to start when the goods are handed to the carrier at the named place, or from the supplier’s door? The buyer realizes the term fixes only the seller’s side and had never asked who collects at the supplier. A short email to the supplier closes the point, and the quotation is written for the segments the buyer is actually responsible for.',
          ],
        }, after: ['The example is invented to show the mechanism. It is not a customer story and does not describe any real transaction.'] },
        { h: 'Questions to ask each party', p: ['These are written as questions because the answers belong in the booking, not in your memory.'], list: [
          'To the seller: where do your obligations end, and who books the carrier after that point? What documents will you issue, and when?',
          'To the buyer: which segments do you want quoted, and which do you want a different party to handle? Who is the importer or exporter of record for the declaration?',
          'To the forwarder: which segments are in this quotation and which are explicitly out? Which charges are billed at origin and which at destination, and in which currency?',
          'To all three: who is notified of arrival, who gives the delivery instruction, and who signs for the cargo?',
        ] },
        { h: 'Where scope gaps usually appear', list: [
          'Terminal and handling charges at origin or destination that neither side assumed were theirs.',
          'Export clearance, which the term may place with one party while the forwarder’s quotation assumes the other.',
          'Insurance, which some terms require one party to arrange and others leave open.',
          'The delivery leg after the port, which a quotation for the main carriage may not include.',
        ], after: ['None of these is an error in the term. Each is a place where a written scope would have prevented a surprise.'] },
        { h: 'Limits of this guide', p: [
          'This article does not interpret any specific term and is not legal advice. The rules are published by the ICC and the sales contract is what binds buyer and seller; read both for the shipment in question. A forwarder’s own conditions and any document it issues, for example those of FIATA where members use them, set the terms of the forwarding service separately.',
        ] },
      ],
    },
    id: {
      slug: 'incoterms-dan-cakupan-freight-perjelas-tanggung-jawabnya',
      title: 'Incoterms dan Cakupan Freight: Perjelas Tanggung Jawabnya',
      excerpt: 'Term perdagangan mengatur sebagian pembagian tanggung jawab antara pembeli dan penjual. Term itu tidak menuliskan penawaran freight untuk Anda. Berikut cara mengubahnya menjadi daftar pertanyaan yang bisa dijawab forwarder secara tertulis.',
      seoTitle: 'Incoterms dan Cakupan Freight: Perjelas Tanggung Jawabnya | VORA',
      seoDescription: 'Apa yang diatur Incoterm, apa yang tidak, dan pertanyaan yang perlu dijawab pembeli, penjual, dan forwarder sebelum pengiriman dibooking.',
      coverAlt: 'Matriks tanggung jawab dengan titik serah terima di sepanjang rute',
      sections: [
        { h: 'Apa yang diatur dan tidak diatur oleh term perdagangan', p: [
          'Incoterms® 2020 adalah sebelas term tiga huruf yang diterbitkan Kamar Dagang Internasional (ICC). Term ini mencerminkan praktik bisnis dalam kontrak jual beli dan membagi biaya, risiko, dan kewajiban antara pembeli dan penjual. Hanya itu fungsinya: term berada dalam kontrak jual beli antara dua pihak.',
          'Freight forwarder umumnya bukan pihak dalam kontrak tersebut. Forwarder bekerja berdasarkan perjanjian terpisah dengan pihak yang menugaskannya, dan perjanjian itu punya cakupan sendiri: langkah apa yang dikerjakan, oleh siapa, dengan harga berapa. Term perdagangan menjadi masukan bagi cakupan itu, tetapi tidak menggantikannya. "Kami sepakat FOB" memberi tahu forwarder di mana kewajiban penjual dimaksudkan berakhir. Kalimat itu tidak menjelaskan apakah forwarder memesan pengiriman utama, mengurus export clearance, atau mengatur pengantaran di ujung lain.',
          'Konsekuensinya sederhana: perlakukan term perdagangan sebagai masukan untuk permintaan penawaran, lalu minta cakupannya secara tertulis.',
        ] },
        { h: 'Membaca serah terima sebagai garis, bukan label', p: [
          'Bayangkan pergerakan barang sebagai garis dengan titik serah terima: lokasi penjual, pelabuhan atau bandara ekspor, pengangkutan utama, pelabuhan atau bandara impor, dan lokasi pembeli. Setiap term menaruh penanda di titik yang berbeda untuk menunjukkan kapan tanggung jawab atas hal tertentu berpindah. Pembagian persisnya untuk kesebelas term ada dalam aturan itu sendiri, yang diterbitkan ICC dan sebaiknya dibaca dari sumber aslinya, bukan dari ringkasan.',
          'Tanpa mengutip teks aturan, Anda dapat bertanya empat hal untuk setiap ruas: siapa yang mengatur, siapa yang membayar, siapa yang menanggung risiko kehilangan atau kerusakan, dan siapa yang memegang dokumen yang dibutuhkan. Bila dua pihak memberi jawaban berbeda untuk ruas yang sama, di situlah sengketa biasanya bermula.',
        ] },
        { h: 'Matriks tanggung jawab yang dapat Anda isi', p: ['Salin tabel ini ke brief pengiriman. Isi tiap baris dengan nama pihaknya, bukan "ya" atau "tidak". Nama membuat kekosongan terlihat.'], table: {
          head: ['Ruas', 'Mengatur', 'Membayar', 'Dokumen yang dibutuhkan', 'Dikonfirmasi tertulis oleh'],
          rows: [
            ['Penjemputan di lokasi penjual', '', '', 'Perintah pengambilan / kesiapan barang', ''],
            ['Export clearance', '', '', 'Pemberitahuan ekspor dan dokumen pendukung', ''],
            ['Pengangkutan utama', '', '', 'Booking dan dokumen angkutan', ''],
            ['Import clearance', '', '', 'Pemberitahuan impor dan dokumen pendukung', ''],
            ['Pengantaran di tujuan', '', '', 'Delivery order / bukti serah terima', ''],
          ],
        } },
        { h: 'Contoh kerja dengan pembelian rekaan', example: {
          label: 'Kasus hipotetis: pembeli di Jakarta, penjual di luar negeri',
          p: [
            'Seorang pembeli di Jakarta sepakat membeli suku cadang mesin dari pemasok di luar negeri. Kontrak jual beli memuat term yang menempatkan pengangkutan utama pada pembeli. Pembeli meminta forwarder menghitung sea freight dan sisi impornya.',
            'Forwarder membalas dengan pertanyaan, bukan harga: apakah penawaran dimulai saat barang diserahkan kepada pengangkut di tempat yang disebut, atau dari pintu pemasok? Pembeli baru sadar bahwa term hanya mengatur sisi penjual, dan ia belum pernah menanyakan siapa yang mengambil barang di tempat pemasok. Satu email singkat kepada pemasok menutup persoalan itu, dan penawaran ditulis untuk ruas yang memang menjadi tanggung jawab pembeli.',
          ],
        }, after: ['Contoh ini rekaan untuk menunjukkan mekanismenya. Ini bukan kisah pelanggan dan tidak menggambarkan transaksi nyata.'] },
        { h: 'Pertanyaan untuk tiap pihak', p: ['Pertanyaan ditulis dalam bentuk tanya karena jawabannya harus masuk ke booking, bukan tinggal di ingatan.'], list: [
          'Kepada penjual: di mana kewajiban Anda berakhir, dan siapa yang memesan pengangkut setelah titik itu? Dokumen apa yang Anda terbitkan, dan kapan?',
          'Kepada pembeli: ruas mana yang ingin dihitung, dan mana yang akan ditangani pihak lain? Siapa importir atau eksportir yang tercatat dalam pemberitahuan?',
          'Kepada forwarder: ruas mana yang ada dalam penawaran ini dan mana yang secara tegas tidak? Biaya mana yang ditagih di asal dan mana di tujuan, dalam mata uang apa?',
          'Kepada ketiganya: siapa yang menerima pemberitahuan kedatangan, siapa yang memberi instruksi pengantaran, dan siapa yang menandatangani penerimaan barang?',
        ] },
        { h: 'Tempat celah cakupan biasanya muncul', list: [
          'Biaya terminal dan handling di asal atau tujuan yang tidak dianggap sebagai tanggungan oleh kedua belah pihak.',
          'Export clearance, yang oleh term bisa ditempatkan pada satu pihak sementara penawaran forwarder mengasumsikan pihak lain.',
          'Asuransi, yang pada sebagian term wajib diatur salah satu pihak dan pada term lain dibiarkan terbuka.',
          'Ruas pengantaran setelah pelabuhan, yang mungkin tidak termasuk dalam penawaran pengangkutan utama.',
        ], after: ['Tidak satu pun merupakan kesalahan term. Semuanya adalah tempat di mana cakupan tertulis akan mencegah kejutan.'] },
        { h: 'Batasan panduan ini', p: [
          'Artikel ini tidak menafsirkan term tertentu dan bukan nasihat hukum. Aturannya diterbitkan ICC dan kontrak jual belilah yang mengikat pembeli dan penjual; bacalah keduanya untuk pengiriman yang bersangkutan. Ketentuan forwarder sendiri dan dokumen yang diterbitkannya, misalnya dokumen FIATA bila anggotanya menggunakannya, mengatur layanan forwarding secara terpisah.',
        ] },
      ],
    },
  },
  {
    group: 'air-or-sea-worksheet', year: 2023, quarter: 3,
    topic: { en: 'Mode choice', id: 'Pilihan moda' },
    sources: ['S3', 'S4'],
    en: {
      slug: 'air-or-ocean-freight-compare-the-whole-shipment',
      title: 'Air or Ocean Freight? Compare the Whole Shipment',
      excerpt: 'Comparing a per-kilo air rate with a per-container sea rate answers the wrong question. A worksheet that follows urgency, cargo shape, handling and destination scope gives a decision you can defend.',
      seoTitle: 'Air or Ocean Freight? Compare the Whole Shipment | VORA',
      seoDescription: 'A practical worksheet for choosing between air and ocean freight: urgency, chargeable basis, handling, readiness and destination scope, with a labeled example.',
      coverAlt: 'A two-column worksheet comparing air and ocean freight steps from door to door',
      sections: [
        { h: 'The mistake in comparing two rates', p: [
          'Air freight is usually quoted per kilogram and sea freight per container or per cubic meter. Putting those numbers side by side feels like a comparison, but it leaves out almost everything that differs between the two. The cargo travels through different handling, waits in different places, is exposed to different delays, and arrives at a different state of readiness. A decision made on the headline rate alone tends to be revisited once the other costs appear.',
          'A better method is to compare the shipment from the moment it is ready until the moment it is usable, and to treat the main-leg rate as one line in that comparison.',
        ] },
        { h: 'Five questions that decide most cases', steps: [
          '**When is the cargo needed, and what happens if it is late?** A hard deadline, a production line waiting for parts and a seasonal sale are different kinds of urgency. A late shipment that costs a day of inventory is not the same as one that stops a line.',
          '**What is the cargo’s shape?** A small, dense, valuable parcel suits air. A large, heavy or bulky consignment usually makes air uneconomical, and some cargo does not fit the aircraft’s openings at all.',
          '**What is the chargeable basis?** Air freight is charged on the greater of actual weight and volumetric weight. Light, bulky cargo can be charged on volume. Sea freight uses cubic meters or weight tons for consolidated cargo, and containers for full loads.',
          '**How ready is the cargo, and how ready is the receiver?** Sea timelines include cut-offs, container availability and port handling. If the cargo is not packed, documented and released on time, the faster mode loses its advantage.',
          '**What does the destination scope include?** The price and the time are not the same if one quotation ends at the airport and the other at the receiver’s dock.',
        ] },
        { h: 'The chargeable basis in practice', p: [
          'For air cargo, the carrier’s conditions set how volume is converted to a weight. The IATA European Air Cargo Programme handbook, for example, states that chargeable weight is the actual gross weight or the volumetric weight, whichever is greater, and that cargo exceeding a stated volume per kilogram is charged volumetrically. Carriers and programmes differ, so read the basis that applies to your booking rather than assuming a standard divisor.',
          'This is why package dimensions matter in the first request. Two shipments with the same weight can have very different air charges if one is packed in a compact carton and the other in an oversized crate.',
        ] },
        { h: 'A decision worksheet', p: ['Fill the right-hand columns with your own figures and the quotation’s figures, not with assumptions.'], table: {
          head: ['Factor', 'Air', 'Ocean'],
          rows: [
            ['Time from ready to usable', 'Departure options, handling at both airports, clearance, delivery', 'Cut-off, loading, voyage, discharge, clearance, delivery'],
            ['Cost basis', 'Greater of actual and volumetric weight', 'Container, or cubic meters / weight for consolidated cargo'],
            ['Handling points', 'Fewer, shorter, but cargo is handled in tight windows', 'More, with cargo staying in a container for longer'],
            ['Packing demand', 'Must suit palletization and aircraft limits', 'Must suit stuffing, securing and a longer journey'],
            ['Inventory carried', 'Lower, because of shorter lead time', 'Higher, because goods are in transit longer'],
            ['Scope at destination', 'State where the quotation ends', 'State where the quotation ends'],
          ],
        } },
        { h: 'A labeled example with invented numbers', example: {
          label: 'Hypothetical example, numbers invented for illustration only',
          p: [
            'A buyer needs 1,200 kg of light-weight components with a total volume of 14 cubic meters. Suppose a carrier’s condition converts 1 cubic meter to 167 kg. The volumetric weight is then 14 × 167 = 2,338 kg, which exceeds the actual weight. Air charges would follow the 2,338 kg, almost twice the actual weight.',
            'The same cargo moved as consolidated sea freight is charged per cubic meter and would be based on the 14 cubic meters. The sea quotation will look much lower per kilogram, but the cargo is in transit for longer and carries more inventory cost. If the components are needed in two weeks, the sea option may not fit. If they are needed in two months, it probably does.',
          ],
        }, after: ['No live rate is claimed anywhere in this example. The 167 kg per cubic meter is a figure chosen to show the arithmetic, and the actual divisor is set by the carrier’s conditions.'] },
        { h: 'When to split the shipment', p: [
          'The best answer is sometimes both. Urgent items by air and the bulk by sea is a common arrangement when part of the cargo gates the rest. Splitting adds paperwork, so it is worth doing only when the urgent portion is a small fraction of the weight or volume.',
        ] },
        { h: 'Limits of this guide', p: [
          'The guide describes how to compare, not which mode is right for your cargo. Carrier conditions, airline acceptance, season and routing change the picture. Cargo that is restricted for air, such as certain batteries or liquids, may be limited to sea or require special acceptance. Ask for the basis and the scope in writing, and let the quotation, not this article, supply the numbers.',
        ] },
      ],
    },
    id: {
      slug: 'air-freight-atau-sea-freight-bandingkan-kebutuhan-pengirimannya',
      title: 'Air Freight atau Sea Freight? Bandingkan Kebutuhan Pengirimannya',
      excerpt: 'Membandingkan tarif air freight per kilo dengan tarif sea freight per kontainer menjawab pertanyaan yang keliru. Lembar kerja yang mengikuti urgensi, bentuk barang, penanganan, dan cakupan di tujuan menghasilkan keputusan yang bisa dipertanggungjawabkan.',
      seoTitle: 'Air Freight atau Sea Freight? Bandingkan Kebutuhan Pengiriman | VORA',
      seoDescription: 'Lembar kerja praktis memilih antara air freight dan sea freight: urgensi, dasar biaya, penanganan, kesiapan, dan cakupan di tujuan, dengan contoh berlabel.',
      coverAlt: 'Lembar kerja dua kolom yang membandingkan tahapan air freight dan sea freight dari pintu ke pintu',
      sections: [
        { h: 'Kekeliruan membandingkan dua tarif', p: [
          'Air freight biasanya dihitung per kilogram, sedangkan sea freight per kontainer atau per meter kubik. Menaruh kedua angka berdampingan terasa seperti perbandingan, padahal hampir semua perbedaan di antara keduanya terlewat. Barang melewati penanganan yang berbeda, menunggu di tempat yang berbeda, menghadapi risiko keterlambatan yang berbeda, dan tiba dalam kondisi kesiapan yang berbeda. Keputusan yang hanya bertumpu pada tarif utama biasanya ditinjau ulang ketika biaya lain muncul.',
          'Cara yang lebih baik adalah membandingkan pengiriman sejak barang siap sampai barang siap dipakai, dan memperlakukan tarif pengiriman utama sebagai satu baris dalam perbandingan itu.',
        ] },
        { h: 'Lima pertanyaan yang menentukan sebagian besar kasus', steps: [
          '**Kapan barang dibutuhkan, dan apa akibatnya bila terlambat?** Tenggat yang kaku, lini produksi yang menunggu suku cadang, dan penjualan musiman adalah urgensi yang berbeda. Keterlambatan yang menghabiskan stok sehari tidak sama dengan keterlambatan yang menghentikan lini.',
          '**Bagaimana bentuk barangnya?** Paket kecil, padat, dan bernilai tinggi cocok untuk udara. Muatan besar, berat, atau memakan tempat biasanya membuat udara tidak ekonomis, dan sebagian barang tidak muat melalui pintu pesawat.',
          '**Apa dasar biayanya?** Air freight dihitung berdasarkan yang lebih besar antara berat aktual dan berat volumetrik. Barang ringan yang memakan tempat dapat dikenai biaya berdasarkan volume. Sea freight memakai meter kubik atau ton berat untuk kargo konsolidasi, dan kontainer untuk muatan penuh.',
          '**Seberapa siap barang dan penerimanya?** Jadwal laut mencakup cut-off, ketersediaan kontainer, dan penanganan pelabuhan. Bila barang belum dikemas, belum lengkap dokumennya, atau belum dilepas tepat waktu, keunggulan moda yang lebih cepat hilang.',
          '**Apa saja cakupan di tujuan?** Harga dan waktu tidak sebanding bila satu penawaran berhenti di bandara dan yang lain berhenti di dock penerima.',
        ] },
        { h: 'Dasar biaya dalam praktik', p: [
          'Untuk kargo udara, ketentuan pengangkut menetapkan cara volume diubah menjadi berat. Handbook European Air Cargo Programme dari IATA, misalnya, menyatakan bahwa chargeable weight adalah berat kotor aktual atau berat volumetrik, mana yang lebih besar, dan bahwa kargo yang melebihi volume tertentu per kilogram dikenai biaya berdasarkan volume. Pengangkut dan program berbeda-beda, jadi bacalah dasar yang berlaku untuk booking Anda dan jangan mengandalkan pembagi yang dianggap baku.',
          'Karena itulah dimensi kemasan perlu ada dalam permintaan pertama. Dua kiriman dengan berat sama dapat memiliki biaya udara yang sangat berbeda bila yang satu dikemas dalam karton ringkas dan yang lain dalam peti berukuran besar.',
        ] },
        { h: 'Lembar kerja keputusan', p: ['Isi kolom kanan dengan angka Anda dan angka dari penawaran, bukan dengan asumsi.'], table: {
          head: ['Faktor', 'Udara', 'Laut'],
          rows: [
            ['Waktu dari siap sampai bisa dipakai', 'Pilihan keberangkatan, penanganan di kedua bandara, clearance, pengantaran', 'Cut-off, pemuatan, pelayaran, pembongkaran, clearance, pengantaran'],
            ['Dasar biaya', 'Yang lebih besar antara berat aktual dan berat volumetrik', 'Kontainer, atau meter kubik / berat untuk kargo konsolidasi'],
            ['Titik penanganan', 'Lebih sedikit dan lebih singkat, tetapi dalam jendela waktu yang ketat', 'Lebih banyak, dengan barang berada di kontainer lebih lama'],
            ['Tuntutan kemasan', 'Harus cocok untuk paletisasi dan batas pesawat', 'Harus cocok untuk stuffing, pengikatan, dan perjalanan yang lebih panjang'],
            ['Persediaan yang ditanggung', 'Lebih rendah karena lead time lebih singkat', 'Lebih tinggi karena barang di perjalanan lebih lama'],
            ['Cakupan di tujuan', 'Tulis di mana penawaran berakhir', 'Tulis di mana penawaran berakhir'],
          ],
        } },
        { h: 'Contoh berlabel dengan angka rekaan', example: {
          label: 'Contoh hipotetis, angka dibuat hanya untuk ilustrasi',
          p: [
            'Seorang pembeli membutuhkan 1.200 kg komponen ringan dengan total volume 14 meter kubik. Misalkan ketentuan suatu pengangkut mengonversi 1 meter kubik menjadi 167 kg. Berat volumetriknya 14 × 167 = 2.338 kg, lebih besar daripada berat aktual. Biaya udara akan mengikuti 2.338 kg, hampir dua kali berat aktual.',
            'Kargo yang sama dikirim sebagai sea freight konsolidasi dihitung per meter kubik, dengan dasar 14 meter kubik. Penawaran laut akan tampak jauh lebih rendah per kilogram, tetapi barang berada di perjalanan lebih lama dan menambah beban persediaan. Bila komponen dibutuhkan dalam dua minggu, pilihan laut mungkin tidak cocok. Bila dibutuhkan dalam dua bulan, kemungkinan besar cocok.',
          ],
        }, after: ['Tidak ada tarif nyata yang diklaim dalam contoh ini. Angka 167 kg per meter kubik dipilih untuk memperlihatkan hitungan; pembagi yang sebenarnya ditetapkan ketentuan pengangkut.'] },
        { h: 'Kapan pengiriman dipecah', p: [
          'Jawaban terbaik kadang adalah keduanya. Barang mendesak lewat udara dan sisanya lewat laut adalah pengaturan yang lazim ketika sebagian muatan menentukan kelanjutan sisanya. Pemecahan menambah dokumen, jadi layak dilakukan hanya bila bagian mendesak itu porsi kecil dari berat atau volume.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Panduan ini menjelaskan cara membandingkan, bukan moda mana yang tepat untuk barang Anda. Ketentuan pengangkut, penerimaan maskapai, musim, dan rute mengubah gambarannya. Barang yang dibatasi untuk udara, seperti baterai atau cairan tertentu, mungkin hanya bisa lewat laut atau memerlukan penerimaan khusus. Minta dasar dan cakupan secara tertulis, dan biarkan penawaran, bukan artikel ini, yang menyediakan angkanya.',
        ] },
      ],
    },
  },
  {
    group: 'packing-and-handover', year: 2023, quarter: 4,
    topic: { en: 'Handling', id: 'Penanganan' },
    sources: ['S3', 'S7', 'S9'],
    en: {
      slug: 'packing-and-handover-reduce-damage-at-the-interfaces',
      title: 'Packing and Handover: Reduce Damage at the Interfaces',
      excerpt: 'Cargo is most exposed where it changes hands: loading, transfer, stuffing, unloading. Good packing information and a dated condition record at each handover make damage easier to prevent and easier to resolve.',
      seoTitle: 'Packing and Handover: Reduce Damage at the Interfaces | VORA',
      seoDescription: 'What to record about packing, handling marks and condition at each handover, with a dispatch and receipt checklist and the limits of generic packing advice.',
      coverAlt: 'A cross-section of a packed carton with handling marks and a condition record beside it',
      sections: [
        { h: 'Where damage actually happens', p: [
          'Damage during a journey is often attributed to the long middle of it, the days at sea or in a truck. In practice, a large share of avoidable damage happens at the interfaces: when cargo is lifted onto a vehicle, moved between vehicles, placed in a container, stacked in a warehouse or taken off at the end. Each interface adds a handler, a piece of equipment and a decision about how to hold the load.',
          'That makes the interface the right place to invest attention. Two things reduce risk there: information that tells the handler how the cargo should be treated, and a record that shows how it looked when it changed hands.',
        ] },
        { h: 'What packing information should travel with the cargo', p: ['Information is only useful if the person handling the cargo can see it. Put it on the package and on the documents.'], list: [
          'The number of packages and a package identifier, so every piece can be counted and matched.',
          'Gross weight and dimensions of each package, marked on the outside.',
          'Handling marks that match the cargo: this way up, keep dry, fragile. Marks should be applied only when they are true and visible on several faces.',
          'Stacking limits, where the cargo cannot take weight on top.',
          'A scannable identifier, where the supply chain uses one. The GS1 Logistic Label Guideline describes a serial shipping container code that identifies a logistic unit such as a pallet, so that it can be tracked from one handover to the next.',
        ] },
        { h: 'Packaging is cargo-specific', p: [
          'No article can tell you whether your packaging is suitable. A carton that suits folded clothing may crush a glass item, and a crate that protects a machine part on a smooth road may not survive being stuffed into a container and secured for a long voyage. The IMO, ILO and UNECE Code of Practice for Packing of Cargo Transport Units addresses the packing and securing of cargo in containers and other transport units, and it is the right reference for how cargo should be arranged inside one. It is non-binding guidance, and it does not replace a packaging test for your product.',
          'Where the cargo is fragile, heavy or unusual, the practical step is to ask the party who will stuff or load it what they need, and to send photographs of the packed cargo before it ships.',
        ] },
        { h: 'The condition record', p: ['A condition record is a short, factual statement made at each handover. It does not assign blame. It fixes what was true at a given time.'], table: {
          head: ['Record at dispatch', 'Record at receipt'],
          rows: [
            ['Date, time and place', 'Date, time and place'],
            ['Count of packages, matched to the packing list', 'Count of packages, matched to the transport document'],
            ['Visible condition of each package: intact, dented, wet, opened', 'Visible condition of each package against the dispatch record'],
            ['Seal numbers, where seals are used', 'Seal numbers checked against the record'],
            ['Photographs of the packages and the loaded vehicle or container', 'Photographs of the same, and of any exception'],
            ['Name of the person handing over', 'Name of the person receiving, and a note of any remark they made'],
          ],
        } },
        { h: 'A hypothetical dispatch note', example: {
          label: 'Hypothetical example, invented for illustration',
          p: ['"12 cartons, numbered 1/12 to 12/12, 18 kg each. Cartons 4 and 9 have a dented corner, photographed. All cartons dry. Pallet wrapped with two layers of film, one strap. Handed to the driver at 14:20, seal not applicable. Receiver’s dock closes at 16:00."'],
        }, after: ['A note of this kind costs two minutes. If carton 4 arrives damaged, the argument starts from a record, not from memory.'] },
        { h: 'When something is wrong at receipt', steps: [
          'Note the exception on the receipt document before signing, in specific words: "carton 4 crushed, contents wet", not "damaged".',
          'Photograph the cargo as received, including the outside packaging and any labels.',
          'Keep the packaging until the matter is resolved.',
          'Tell the forwarder and the party you contracted with in writing, the same day if you can, with the photographs and the record.',
          'Ask what time limits apply to a claim under your contract and the carrier’s conditions. Time limits can be short.',
        ] },
        { h: 'Limits of this guide', p: [
          'Handover records support a claim; they do not guarantee one. Liability depends on the contract, the transport document and the applicable conditions. The advice here is general and cannot judge whether a given packing is adequate for a given cargo. For heavy or unusual cargo, involve someone qualified in packing and securing, and use the CTU Code and the CSS Code as references for how cargo is stowed and secured, not as a substitute for their judgment.',
        ] },
      ],
    },
    id: {
      slug: 'packing-dan-serah-terima-kurangi-risiko-kerusakan',
      title: 'Packing dan Serah Terima: Kurangi Risiko Kerusakan di Titik Perpindahan',
      excerpt: 'Barang paling rentan saat berpindah tangan: dimuat, dipindahkan, di-stuffing, dibongkar. Informasi kemasan yang baik dan catatan kondisi bertanggal di setiap serah terima membuat kerusakan lebih mudah dicegah dan lebih mudah diselesaikan.',
      seoTitle: 'Packing dan Serah Terima: Kurangi Risiko Kerusakan | VORA',
      seoDescription: 'Apa yang dicatat tentang kemasan, tanda penanganan, dan kondisi barang di setiap serah terima, dengan daftar periksa pengiriman dan penerimaan serta batasan saran packing yang umum.',
      coverAlt: 'Penampang karton yang dikemas dengan tanda penanganan dan catatan kondisi di sampingnya',
      sections: [
        { h: 'Di mana kerusakan sebenarnya terjadi', p: [
          'Kerusakan selama perjalanan sering dikaitkan dengan bagian tengahnya yang panjang, berhari-hari di laut atau di truk. Dalam praktik, sebagian besar kerusakan yang sebenarnya bisa dicegah terjadi di titik perpindahan: ketika barang diangkat ke kendaraan, dipindahkan antarkendaraan, dimasukkan ke kontainer, ditumpuk di gudang, atau diturunkan di ujung perjalanan. Setiap titik menambah satu petugas, satu peralatan, dan satu keputusan tentang cara memegang muatan.',
          'Karena itu titik perpindahan adalah tempat yang tepat untuk menaruh perhatian. Dua hal menurunkan risikonya: informasi yang memberi tahu petugas cara memperlakukan barang, dan catatan yang menunjukkan kondisi barang saat berpindah tangan.',
        ] },
        { h: 'Informasi kemasan yang harus ikut bersama barang', p: ['Informasi hanya berguna bila petugas yang menangani barang bisa melihatnya. Taruh di kemasan dan di dokumen.'], list: [
          'Jumlah kemasan dan nomor identitas tiap kemasan, agar setiap koli bisa dihitung dan dicocokkan.',
          'Berat kotor dan dimensi tiap kemasan, ditulis di bagian luar.',
          'Tanda penanganan yang sesuai dengan barang: posisi atas, jaga tetap kering, rapuh. Pasang tanda hanya bila benar dan terlihat di lebih dari satu sisi.',
          'Batas penumpukan, bila barang tidak tahan ditindih.',
          'Pengenal yang dapat dipindai, bila rantai pasok memakainya. GS1 Logistic Label Guideline menjelaskan kode serial pengiriman yang mengidentifikasi unit logistik seperti pallet, sehingga bisa dilacak dari satu serah terima ke serah terima berikutnya.',
        ] },
        { h: 'Kecocokan kemasan bergantung pada barangnya', p: [
          'Tidak ada artikel yang dapat memastikan kemasan Anda cocok. Karton yang pas untuk pakaian terlipat bisa menghancurkan barang kaca, dan peti yang melindungi suku cadang mesin di jalan mulus belum tentu bertahan ketika dimasukkan ke kontainer dan diikat untuk pelayaran panjang. Code of Practice for Packing of Cargo Transport Units dari IMO, ILO, dan UNECE membahas pengemasan dan pengikatan kargo di dalam kontainer dan unit angkut lain, dan menjadi rujukan yang tepat untuk cara menata barang di dalamnya. Dokumen itu panduan yang tidak mengikat dan tidak menggantikan uji kemasan untuk produk Anda.',
          'Bila barang rapuh, berat, atau tidak lazim, langkah praktisnya adalah menanyakan kepada pihak yang akan melakukan stuffing atau pemuatan apa yang mereka butuhkan, dan mengirimkan foto barang yang sudah dikemas sebelum dikirim.',
        ] },
        { h: 'Catatan kondisi', p: ['Catatan kondisi adalah pernyataan singkat dan faktual yang dibuat di setiap serah terima. Catatan itu tidak menyalahkan siapa pun; ia menetapkan apa yang benar pada waktu tertentu.'], table: {
          head: ['Dicatat saat pengiriman', 'Dicatat saat penerimaan'],
          rows: [
            ['Tanggal, jam, dan tempat', 'Tanggal, jam, dan tempat'],
            ['Jumlah kemasan, dicocokkan dengan packing list', 'Jumlah kemasan, dicocokkan dengan dokumen angkutan'],
            ['Kondisi tampak tiap kemasan: utuh, penyok, basah, terbuka', 'Kondisi tampak tiap kemasan dibandingkan catatan pengiriman'],
            ['Nomor segel, bila memakai segel', 'Nomor segel diperiksa terhadap catatan'],
            ['Foto kemasan dan kendaraan atau kontainer yang sudah dimuat', 'Foto yang sama, dan foto setiap pengecualian'],
            ['Nama orang yang menyerahkan', 'Nama orang yang menerima, dan catatan komentarnya bila ada'],
          ],
        } },
        { h: 'Contoh catatan pengiriman hipotetis', example: {
          label: 'Contoh hipotetis, dibuat untuk ilustrasi',
          p: ['"12 karton, bernomor 1/12 sampai 12/12, masing-masing 18 kg. Karton 4 dan 9 penyok di sudut, sudah difoto. Semua karton kering. Pallet dibungkus dua lapis film, satu strap. Diserahkan kepada pengemudi pukul 14.20, segel tidak berlaku. Dock penerima tutup pukul 16.00."'],
        }, after: ['Catatan seperti ini memakan dua menit. Bila karton 4 tiba dalam keadaan rusak, perdebatan dimulai dari catatan, bukan dari ingatan.'] },
        { h: 'Bila ada yang tidak beres saat penerimaan', steps: [
          'Catat pengecualian pada dokumen penerimaan sebelum menandatangani, dengan kata-kata yang spesifik: "karton 4 remuk, isi basah", bukan "rusak".',
          'Foto barang sebagaimana diterima, termasuk kemasan luar dan label.',
          'Simpan kemasannya sampai persoalan selesai.',
          'Beri tahu forwarder dan pihak yang Anda kontrak secara tertulis, sedapat mungkin pada hari yang sama, lengkap dengan foto dan catatannya.',
          'Tanyakan batas waktu klaim menurut kontrak Anda dan ketentuan pengangkut. Batas waktu bisa singkat.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Catatan serah terima mendukung klaim, tetapi tidak menjaminnya. Tanggung jawab bergantung pada kontrak, dokumen angkutan, dan ketentuan yang berlaku. Saran di sini bersifat umum dan tidak bisa menilai apakah kemasan tertentu memadai untuk barang tertentu. Untuk barang berat atau tidak lazim, libatkan orang yang kompeten dalam pengemasan dan pengikatan, dan gunakan CTU Code serta CSS Code sebagai rujukan cara barang ditata dan diikat, bukan sebagai pengganti penilaian mereka.',
        ] },
      ],
    },
  },
]
