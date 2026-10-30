import type { ArchiveDraft } from './types'

export const y2026: ArchiveDraft[] = [
  {
    group: 'logistics-kpis', year: 2026, quarter: 1,
    topic: { en: 'Performance', id: 'Kinerja' },
    sources: ['S11', 'S7'],
    en: {
      slug: 'logistics-kpis-that-explain-an-operational-decision',
      title: 'Logistics KPIs That Explain an Operational Decision',
      excerpt: 'A percentage without a denominator is a decoration. Five logistics measures become useful once the event, the timestamp and the population behind each one are written down, and the data traps are known.',
      seoTitle: 'Logistics KPIs That Explain an Operational Decision | VORA',
      seoDescription: 'Definitions with explicit denominators and timestamps for on-time delivery, order accuracy, damage incidence, dwell time and POD completeness, with a hypothetical scorecard.',
      coverAlt: 'An editorial scorecard with five metric definitions, each showing its numerator and denominator',
      sections: [
        { h: 'A measure is a definition first', p: [
          'Most logistics reports show percentages: on time, in full, damage-free. Percentages are persuasive and easy to misread. Two organizations can report "95% on time" and mean entirely different things, because one counts against the promised date and the other against the first date the customer asked for, or because one counts deliveries and the other counts order lines. A KPI that cannot be reproduced from a written definition cannot support a decision.',
          'For each measure below, the definition names the event being counted, the timestamp used and the population in the denominator. The definitions are authored for this article as examples. They are not an industry standard and not VORA performance.',
        ] },
        { h: 'Five measures, defined', table: {
          head: ['Measure', 'Numerator', 'Denominator', 'Timestamps and notes'],
          rows: [
            ['On-time delivery', 'Deliveries handed over at or before the agreed delivery time', 'All deliveries due in the period', 'Handover time from the POD; agreed time from the booking. State which time zone and whether a window counts as on time at its end.'],
            ['Order accuracy', 'Orders delivered with the right items and quantities', 'All orders delivered in the period', 'Count orders, not lines, or state otherwise. Exceptions are taken from the receipt record.'],
            ['Damage incidence', 'Deliveries with at least one package recorded as damaged', 'All deliveries in the period', 'Damage must be noted at receipt to count; later claims are tracked separately.'],
            ['Dwell time', 'Elapsed hours between arrival and departure of a unit at a facility, summed', 'The number of units that left in the period', 'State start and stop events, such as gate-in and gate-out, and exclude units still on site.'],
            ['POD completeness', 'Deliveries with a POD recorded within the stated time after handover', 'All deliveries in the period', 'State the time allowed and what counts as complete: signature, quantity, condition.'],
          ],
        } },
        { h: 'Why the denominator is the argument', p: [
          'If a late delivery is removed from the denominator because the customer asked for a change, the on-time rate rises without any improvement in operations. If damage is counted only when a claim is filed, the incidence falls while the damage continues. A reader seeing only the percentage cannot know. Writing the denominator next to the number turns the KPI from a claim into a calculation anyone can check.',
        ] },
        { h: 'A hypothetical scorecard', example: {
          label: 'Hypothetical scorecard, invented for illustration. These are not VORA results.',
          p: [
            'In an invented month: 200 deliveries were due. 188 were handed over by the agreed time. On-time delivery is 188 ÷ 200 = 94%. Of the 200, 3 had a damaged package noted at receipt, so damage incidence is 3 ÷ 200 = 1.5%. 194 of the 200 had a POD recorded within 24 hours, so POD completeness is 97%.',
            'The same month reported against a different definition could look different. If the 12 late deliveries included 5 where the customer changed the date, a report that removes them gives 188 ÷ 195 = 96.4%. Both numbers can be honest. They answer different questions, and the scorecard should say which one it is.',
          ],
        } },
        { h: 'Data-quality traps', list: [
          'Timestamps entered by hand, later, from memory, rather than captured at the event.',
          'Time zones and daylight changes mixed across systems.',
          'Orders split or merged between booking and delivery, so numerator and denominator count different things.',
          'Exceptions recorded in a free-text note that no report reads.',
          'A POD recorded days after the handover, which makes both completeness and timeliness uncertain.',
        ] },
        { h: 'From measure to decision', p: [
          'A KPI earns its place by changing what someone does. Before adopting one, write the decision it informs: which carrier to review, which site to coach, which customer instruction to clarify. If no decision follows from a measure, it is reporting for its own sake. The GS1 Traceability Standard describes recording events and the data about them, which is the raw material any of these measures depends on.',
        ] },
        { h: 'Limits of this guide', p: [
          'The definitions are examples to be adapted to your contracts and systems. No target values are suggested because appropriate targets depend on cargo, route and customer. The numbers are invented and the scorecard describes no real operation.',
        ] },
      ],
    },
    id: {
      slug: 'kpi-logistik-yang-membantu-pengambilan-keputusan',
      title: 'KPI Logistik yang Membantu Pengambilan Keputusan',
      excerpt: 'Persentase tanpa penyebut hanyalah hiasan. Lima ukuran logistik menjadi berguna setelah peristiwa, cap waktu, dan populasi di balik masing-masing dituliskan, dan jebakan datanya dikenali.',
      seoTitle: 'KPI Logistik yang Membantu Pengambilan Keputusan | VORA',
      seoDescription: 'Definisi dengan penyebut dan cap waktu yang eksplisit untuk on-time delivery, akurasi pesanan, insiden kerusakan, dwell time, dan kelengkapan POD, dengan scorecard hipotetis.',
      coverAlt: 'Scorecard editorial dengan lima definisi ukuran, masing-masing menunjukkan pembilang dan penyebutnya',
      sections: [
        { h: 'Ukuran adalah definisi lebih dulu', p: [
          'Kebanyakan laporan logistik menampilkan persentase: tepat waktu, lengkap, bebas kerusakan. Persentase meyakinkan dan mudah disalahbaca. Dua organisasi dapat melaporkan "95% tepat waktu" dengan makna yang sama sekali berbeda, karena yang satu menghitung terhadap tanggal yang dijanjikan dan yang lain terhadap tanggal pertama yang diminta pelanggan, atau karena yang satu menghitung pengantaran dan yang lain menghitung order line. KPI yang tidak dapat direproduksi dari definisi tertulis tidak dapat mendukung keputusan.',
          'Untuk setiap ukuran di bawah, definisinya menyebut peristiwa yang dihitung, cap waktu yang dipakai, dan populasi pada penyebut. Definisi ini disusun untuk artikel ini sebagai contoh. Ini bukan standar industri dan bukan kinerja VORA.',
        ] },
        { h: 'Lima ukuran, didefinisikan', table: {
          head: ['Ukuran', 'Pembilang', 'Penyebut', 'Cap waktu dan catatan'],
          rows: [
            ['On-time delivery', 'Pengantaran yang diserahkan pada atau sebelum waktu yang disepakati', 'Semua pengantaran yang jatuh tempo pada periode', 'Waktu serah terima dari POD; waktu yang disepakati dari booking. Sebutkan zona waktu dan apakah jendela waktu dihitung tepat waktu sampai akhirnya.'],
            ['Akurasi pesanan', 'Pesanan yang diantar dengan barang dan jumlah yang benar', 'Semua pesanan yang diantar pada periode', 'Hitung pesanan, bukan baris, atau nyatakan sebaliknya. Pengecualian diambil dari catatan penerimaan.'],
            ['Insiden kerusakan', 'Pengantaran dengan sedikitnya satu kemasan tercatat rusak', 'Semua pengantaran pada periode', 'Kerusakan harus dicatat saat penerimaan agar dihitung; klaim kemudian dilacak terpisah.'],
            ['Dwell time', 'Jumlah jam antara kedatangan dan keberangkatan unit di fasilitas, dijumlahkan', 'Jumlah unit yang keluar pada periode', 'Sebutkan peristiwa awal dan akhir, misalnya gate-in dan gate-out, dan keluarkan unit yang masih di lokasi.'],
            ['Kelengkapan POD', 'Pengantaran dengan POD tercatat dalam waktu yang ditetapkan setelah serah terima', 'Semua pengantaran pada periode', 'Sebutkan waktu yang diizinkan dan apa yang dianggap lengkap: tanda tangan, jumlah, kondisi.'],
          ],
        } },
        { h: 'Mengapa penyebut adalah argumennya', p: [
          'Bila pengantaran terlambat dikeluarkan dari penyebut karena pelanggan meminta perubahan, angka tepat waktu naik tanpa perbaikan operasional. Bila kerusakan baru dihitung ketika klaim diajukan, insidennya turun sementara kerusakan terus terjadi. Pembaca yang hanya melihat persentase tidak dapat mengetahuinya. Menuliskan penyebut di samping angka mengubah KPI dari klaim menjadi perhitungan yang dapat diperiksa siapa pun.',
        ] },
        { h: 'Scorecard hipotetis', example: {
          label: 'Scorecard hipotetis, dibuat untuk ilustrasi. Ini bukan hasil VORA.',
          p: [
            'Dalam sebulan rekaan: 200 pengantaran jatuh tempo. 188 diserahkan pada waktu yang disepakati. On-time delivery adalah 188 ÷ 200 = 94%. Dari 200 itu, 3 memiliki kemasan rusak yang dicatat saat penerimaan, sehingga insiden kerusakan 3 ÷ 200 = 1,5%. 194 dari 200 memiliki POD tercatat dalam 24 jam, jadi kelengkapan POD 97%.',
            'Bulan yang sama bisa tampak berbeda dengan definisi lain. Bila di antara 12 pengantaran terlambat ada 5 yang tanggalnya diubah pelanggan, laporan yang mengeluarkannya menghasilkan 188 ÷ 195 = 96,4%. Kedua angka bisa jujur. Keduanya menjawab pertanyaan berbeda, dan scorecard harus menyebut yang mana.',
          ],
        } },
        { h: 'Jebakan kualitas data', list: [
          'Cap waktu dimasukkan manual, belakangan, dari ingatan, bukan ditangkap saat peristiwa.',
          'Zona waktu dan perubahan jam bercampur di berbagai sistem.',
          'Pesanan dipecah atau digabung antara booking dan pengantaran, sehingga pembilang dan penyebut menghitung hal berbeda.',
          'Pengecualian dicatat dalam catatan teks bebas yang tidak dibaca laporan mana pun.',
          'POD dicatat berhari-hari setelah serah terima, sehingga kelengkapan maupun ketepatan waktunya diragukan.',
        ] },
        { h: 'Dari ukuran menjadi keputusan', p: [
          'KPI layak ada bila mengubah apa yang dikerjakan seseorang. Sebelum mengadopsi satu ukuran, tuliskan keputusan yang diinformasikannya: pengangkut mana yang ditinjau, lokasi mana yang dibina, instruksi pelanggan mana yang diperjelas. Bila tidak ada keputusan yang mengikuti, ukuran itu hanya pelaporan demi pelaporan. GS1 Traceability Standard menjelaskan pencatatan peristiwa dan datanya, yang menjadi bahan baku bagi semua ukuran ini.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Definisi ini contoh yang perlu disesuaikan dengan kontrak dan sistem Anda. Tidak ada nilai target yang disarankan karena target yang tepat bergantung pada barang, rute, dan pelanggan. Angkanya rekaan dan scorecard tidak menggambarkan operasi nyata.',
        ] },
      ],
    },
  },
  {
    group: 'disruption-planning', year: 2026, quarter: 2,
    topic: { en: 'Risk planning', id: 'Perencanaan risiko' },
    sources: ['S1', 'S3'],
    en: {
      slug: 'disruption-planning-decide-the-alternatives-before-they-are-needed',
      title: 'Disruption Planning: Decide the Alternatives Before They Are Needed',
      excerpt: 'When a shipment is disrupted, the scarce resource is decision time. Writing the trigger points, the alternatives and the authority to approve extra cost beforehand shortens the delay between noticing and acting.',
      seoTitle: 'Disruption Planning: Decide the Alternatives Before They Are Needed | VORA',
      seoDescription: 'A decision framework for shipment disruptions: trigger points, route alternatives, inventory effects, escalation and cost authority, with a fictional scenario and checklist.',
      coverAlt: 'A branching route study with a trigger point and two alternatives beside an escalation table',
      sections: [
        { h: 'The delay between noticing and deciding', p: [
          'A disruption rarely arrives as a surprise to the cargo. It arrives as a surprise to the people who have to decide. The notice comes, a message circulates, several people ask who can approve what, and the choice that was available at the start of the day is gone by the end of it. Most of that delay is not information. It is the absence of a prior agreement about who decides, on what evidence, within what limits.',
          'Planning for disruption does not need forecasts. It needs a short written decision frame, prepared while nothing is wrong.',
        ] },
        { h: 'Four parts of the frame', steps: [
          '**Trigger points.** The observable conditions that start the decision: a missed cut-off, a vessel or flight cancelled, a hold at a terminal, a site closed to receiving. Define them as events, not as feelings that something is going wrong.',
          '**Alternatives.** The realistic options for each trigger: another departure, another mode, another route or port, holding the cargo, splitting the shipment. For each, note what it needs from other parties and what it changes.',
          '**Inventory effects.** What the receiver holds, how long it lasts and what happens when it runs out. This sets how much a day of delay is worth.',
          '**Authority.** Who may approve extra cost, up to what amount, and who must be told. A decision that waits for the one person who can sign costs time.',
        ] },
        { h: 'An escalation table', p: ['A table like this one fits on a page and can be filled in once per route or customer.'], table: {
          head: ['Trigger', 'First action', 'Decide by', 'Who decides', 'Cost limit without further approval'],
          rows: [
            ['Cut-off missed', 'Ask for the next available departure; check whether documents are the cause', 'Same day', 'Operations lead', 'To be set by the cargo owner'],
            ['Departure cancelled or rolled', 'Obtain the new schedule and the carrier’s written notice', 'Within a stated number of hours', 'Operations lead, informing the cargo owner', 'To be set by the cargo owner'],
            ['Cargo held at a terminal', 'Find out who placed the hold and what clears it', 'Same day', 'Cargo owner with the broker', 'Not applicable until cause known'],
            ['Receiving site cannot accept', 'Agree a new delivery slot or temporary storage', 'Before the vehicle departs', 'Cargo owner or receiver', 'To be set by the cargo owner'],
          ],
        } },
        { h: 'A fictional scenario', example: {
          label: 'Fictional scenario, invented for illustration. It describes no real event and makes no forecast.',
          p: [
            'A distributor expects a container to arrive on a Monday. The receiver’s stock covers ten days of sales. On the previous Thursday the carrier advises that the vessel will be late by several days. Under the written frame the operations lead has to decide by the end of Friday between three options: wait, move part of the cargo by air, or ask the receiver to adjust a promotion.',
            'The frame shows that the delay is within the ten days of cover, that air freight for the full volume would cost far more than the margin on the late days, and that the cost limit allows a partial air shipment of the fastest-moving items. The decision is made in an hour because the options and the limits were already agreed.',
          ],
        } },
        { h: 'What stays outside the plan', p: [
          'A plan cannot promise that alternatives will be available. Space on another departure, airline acceptance and terminal capacity may all be limited when many shippers look for the same alternative. The trade terms also matter: depending on the agreed term, the party who decides about the extra cost may not be the party who holds the cargo. Incoterms® 2020 allocate costs, risks and obligations between buyer and seller, and the sales contract should be read for who carries a delay.',
        ] },
        { h: 'An exception-decision checklist', list: [
          'Trigger points written as events, with who watches for each.',
          'For each trigger, at least two alternatives and their dependencies.',
          'Receiver’s inventory cover, updated at an agreed interval.',
          'Names and contact routes for decisions, with a substitute for each.',
          'Cost authority stated in writing, per route or customer.',
          'A short log of each decision: what was known, what was chosen and why.',
        ] },
        { h: 'Limits of this guide', p: [
          'The article offers a way to structure decisions and does not predict events or recommend a route. Cargo that needs special handling may have fewer alternatives. When cargo is moved between modes or containers, its packing and securing must suit the new arrangement; the CTU Code is a reference for packing cargo transport units. Nothing in the scenario refers to a real event.',
        ] },
      ],
    },
    id: {
      slug: 'rencana-gangguan-pengiriman-siapkan-opsi-sebelum-dibutuhkan',
      title: 'Rencana Gangguan Pengiriman: Siapkan Opsi Sebelum Dibutuhkan',
      excerpt: 'Saat pengiriman terganggu, sumber daya yang langka adalah waktu mengambil keputusan. Menuliskan titik pemicu, alternatif, dan wewenang menyetujui biaya tambahan sebelumnya memperpendek jeda antara menyadari dan bertindak.',
      seoTitle: 'Rencana Gangguan Pengiriman: Siapkan Opsi Sebelum Dibutuhkan | VORA',
      seoDescription: 'Kerangka keputusan untuk gangguan pengiriman: titik pemicu, alternatif rute, dampak persediaan, eskalasi, dan wewenang biaya, dengan skenario fiktif dan daftar periksa.',
      coverAlt: 'Studi rute bercabang dengan titik pemicu dan dua alternatif di samping tabel eskalasi',
      sections: [
        { h: 'Jeda antara menyadari dan memutuskan', p: [
          'Gangguan jarang mengejutkan barangnya. Gangguan mengejutkan orang yang harus memutuskan. Kabar datang, pesan beredar, beberapa orang bertanya siapa yang boleh menyetujui apa, dan pilihan yang tersedia di awal hari sudah hilang di akhir hari. Sebagian besar jeda itu bukan soal informasi. Itu karena tidak adanya kesepakatan sebelumnya tentang siapa yang memutuskan, berdasarkan bukti apa, dan dalam batas apa.',
          'Perencanaan gangguan tidak memerlukan ramalan. Yang diperlukan adalah kerangka keputusan tertulis yang singkat, disusun saat belum ada yang salah.',
        ] },
        { h: 'Empat bagian kerangka', steps: [
          '**Titik pemicu.** Kondisi yang dapat diamati yang memulai keputusan: cut-off terlewat, kapal atau penerbangan dibatalkan, barang ditahan di terminal, lokasi tidak menerima barang. Definisikan sebagai peristiwa, bukan firasat bahwa ada yang tidak beres.',
          '**Alternatif.** Opsi realistis untuk tiap pemicu: keberangkatan lain, moda lain, rute atau pelabuhan lain, menahan barang, memecah kiriman. Untuk masing-masing, catat apa yang dibutuhkan dari pihak lain dan apa yang berubah.',
          '**Dampak persediaan.** Apa yang dimiliki penerima, berapa lama cukup, dan apa yang terjadi bila habis. Ini menentukan berapa nilai sehari keterlambatan.',
          '**Wewenang.** Siapa yang boleh menyetujui biaya tambahan, sampai jumlah berapa, dan siapa yang harus diberi tahu. Keputusan yang menunggu satu-satunya orang yang bisa menandatangani memakan waktu.',
        ] },
        { h: 'Tabel eskalasi', p: ['Tabel seperti ini muat dalam satu halaman dan bisa diisi sekali untuk tiap rute atau pelanggan.'], table: {
          head: ['Pemicu', 'Tindakan pertama', 'Putuskan paling lambat', 'Pengambil keputusan', 'Batas biaya tanpa persetujuan lanjutan'],
          rows: [
            ['Cut-off terlewat', 'Minta keberangkatan berikutnya; periksa apakah dokumen penyebabnya', 'Hari yang sama', 'Pimpinan operasional', 'Ditetapkan pemilik barang'],
            ['Keberangkatan dibatalkan atau digeser', 'Peroleh jadwal baru dan pemberitahuan tertulis pengangkut', 'Dalam jumlah jam yang ditetapkan', 'Pimpinan operasional, dengan memberi tahu pemilik barang', 'Ditetapkan pemilik barang'],
            ['Barang ditahan di terminal', 'Cari tahu siapa yang menahan dan apa yang membebaskannya', 'Hari yang sama', 'Pemilik barang bersama broker', 'Tidak berlaku sampai penyebab diketahui'],
            ['Lokasi penerima tidak dapat menerima', 'Sepakati slot pengantaran baru atau penyimpanan sementara', 'Sebelum kendaraan berangkat', 'Pemilik barang atau penerima', 'Ditetapkan pemilik barang'],
          ],
        } },
        { h: 'Skenario fiktif', example: {
          label: 'Skenario fiktif, dibuat untuk ilustrasi. Tidak menggambarkan peristiwa nyata dan tidak memuat ramalan.',
          p: [
            'Seorang distributor mengharapkan kontainer tiba hari Senin. Stok penerima cukup untuk sepuluh hari penjualan. Pada Kamis sebelumnya pengangkut memberi tahu bahwa kapal akan terlambat beberapa hari. Menurut kerangka tertulis, pimpinan operasional harus memutuskan sampai akhir hari Jumat di antara tiga opsi: menunggu, mengirim sebagian lewat udara, atau meminta penerima menyesuaikan promosi.',
            'Kerangka menunjukkan bahwa keterlambatan masih di dalam cakupan sepuluh hari, bahwa air freight untuk seluruh volume akan jauh lebih mahal daripada margin pada hari-hari terlambat, dan bahwa batas biaya mengizinkan pengiriman udara sebagian untuk barang yang paling cepat laku. Keputusan diambil dalam satu jam karena opsi dan batasnya sudah disepakati.',
          ],
        } },
        { h: 'Yang berada di luar rencana', p: [
          'Rencana tidak dapat menjanjikan bahwa alternatif akan tersedia. Ruang pada keberangkatan lain, penerimaan maskapai, dan kapasitas terminal bisa terbatas ketika banyak pengirim mencari alternatif yang sama. Term perdagangan juga berpengaruh: bergantung pada term yang disepakati, pihak yang memutuskan biaya tambahan mungkin bukan pihak yang memegang barang. Incoterms® 2020 membagi biaya, risiko, dan kewajiban antara pembeli dan penjual, dan kontrak jual beli perlu dibaca untuk mengetahui siapa yang menanggung keterlambatan.',
        ] },
        { h: 'Daftar periksa keputusan pengecualian', list: [
          'Titik pemicu ditulis sebagai peristiwa, dengan siapa yang mengawasi masing-masing.',
          'Untuk tiap pemicu, sedikitnya dua alternatif beserta ketergantungannya.',
          'Cakupan persediaan penerima, diperbarui pada interval yang disepakati.',
          'Nama dan jalur kontak untuk keputusan, dengan pengganti untuk masing-masing.',
          'Wewenang biaya dinyatakan tertulis, per rute atau pelanggan.',
          'Log singkat tiap keputusan: apa yang diketahui, apa yang dipilih, dan mengapa.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Artikel ini menawarkan cara menyusun keputusan dan tidak memprediksi peristiwa atau merekomendasikan rute. Barang yang memerlukan penanganan khusus mungkin punya lebih sedikit alternatif. Ketika barang dipindahkan antarmoda atau antarkontainer, kemasan dan pengikatannya harus sesuai dengan pengaturan baru; CTU Code adalah rujukan untuk pengemasan unit angkut kargo. Tidak ada dalam skenario yang merujuk pada peristiwa nyata.',
        ] },
      ],
    },
  },
  {
    group: 'special-cargo-acceptance', year: 2026, quarter: 3,
    topic: { en: 'Special cargo', id: 'Kargo khusus' },
    sources: ['S12', 'S3'],
    en: {
      slug: 'special-cargo-acceptance-ask-before-booking',
      title: 'Special Cargo Acceptance: Ask Before Booking',
      excerpt: 'Batteries, liquids and chemical products can be accepted, restricted or refused depending on the product, the packaging and the operator. A preliminary inquiry is not an acceptance, and it is not a dangerous-goods approval.',
      seoTitle: 'Special Cargo Acceptance: Ask Before Booking | VORA',
      seoDescription: 'What to prepare before asking about batteries, liquids and similar cargo, the difference between an inquiry and an acceptance, and why shipping dangerous goods needs trained people.',
      coverAlt: 'A cargo information dossier with composition, packaging and safety data sheet highlighted',
      sections: [
        { h: 'Special does not mean forbidden', p: [
          'Products that contain batteries, liquids, aerosols, magnets or chemicals are shipped every day. Some are unrestricted, some are accepted under conditions and some are refused by a particular operator. Whether a given product is one or the other depends on what it is made of, how it is packaged and who is carrying it. The way to find out is to ask early, with information, and to treat the answer as specific to that product and that carrier.',
        ] },
        { h: 'Inquiry, acceptance, approval', p: ['Three different things are often described with the same word.'], table: {
          head: ['Stage', 'What it is', 'What it is not'],
          rows: [
            ['Preliminary inquiry', 'A question about whether the product can be carried and what is needed', 'A booking, a promise or an assessment of the product'],
            ['Operator acceptance', 'The carrier’s or airline’s decision to carry the goods as presented, usually at the time of tender', 'Valid for a different product, packaging or date'],
            ['Dangerous goods approval or declaration', 'Classification, packing, marking, labelling and documentation done by people trained for it, under the applicable regulations', 'Something a forwarder, or this article, can grant or replace'],
          ],
        } },
        { h: 'What the information needs to say', list: [
          'The product name and what it is used for.',
          'Composition: for a battery the chemistry and size or energy rating; for a liquid its constituents and concentration.',
          'The safety data sheet, current and from the manufacturer.',
          'Packaging: the inner and outer packaging, quantity per package and total quantity.',
          'Whether the battery is shipped separately, packed with equipment or contained in equipment.',
          'The mode and route you want, because acceptance differs between air, sea and road.',
          'Any test report, certificate or classification the manufacturer already holds.',
        ] },
        { h: 'Why air is stricter in some cases', p: [
          'The IATA Dangerous Goods Regulations set out how dangerous goods are classified, packed, marked, labelled and documented for transport by air, and assign duties to shippers and operators. Airlines may also apply their own additional restrictions. A product that is routine by sea can need a different arrangement, or be declined, by air. If your choice of mode matters, say so in the inquiry.',
        ] },
        { h: 'A fictional inquiry', example: {
          label: 'Fictional example, invented for illustration. It states no rule for any real product.',
          p: [
            'An importer wants to ship 500 portable speakers. The inquiry says only "speakers with battery, from Surabaya, by air". The forwarder asks for the battery type and rating, whether the batteries are built in, the safety data sheet, the packaging and the quantity per carton.',
            'The importer returns with a data sheet and a photograph of the packaging, and states that the batteries are built into the speakers. With that, the forwarder can ask the airline what it accepts and under which conditions. The answer, whatever it is, will refer to that product, packaging and route, and will not apply to a different speaker.',
          ],
        } },
        { h: 'Who may prepare dangerous goods for transport', p: [
          'Preparing dangerous goods for shipment requires training appropriate to the function, and the shipper carries specific responsibilities. This article does not tell you how to classify, pack, mark or document dangerous goods, and nothing in it makes a reader qualified to do so. If your product is or may be a dangerous good, involve someone trained and ask the operator what it requires before you commit to a date.',
        ] },
        { h: 'A preparation checklist', steps: [
          'Collect the current safety data sheet and composition details.',
          'Photograph the product and its packaging as it will ship.',
          'Identify the mode and route and say whether alternatives are acceptable.',
          'Send the inquiry with these attachments and ask what else is needed.',
          'Hold the booking until the operator’s answer is in writing.',
          'Re-ask whenever the product, the packaging or the route changes.',
        ] },
        { h: 'Limits of this guide', p: [
          'The regulations and operators’ conditions are updated regularly and differ by mode, so check the edition and effective date that apply to your shipment date. The IATA page cited shows the 68th edition on the access date; this may not be the edition that applies to a later shipment. The example is fictional and an inquiry is not an approval.',
        ] },
      ],
    },
    id: {
      slug: 'penerimaan-kargo-khusus-pastikan-sebelum-booking',
      title: 'Penerimaan Kargo Khusus: Pastikan Sebelum Booking',
      excerpt: 'Baterai, cairan, dan produk kimia bisa diterima, dibatasi, atau ditolak tergantung produk, kemasan, dan operatornya. Pertanyaan awal bukan penerimaan, dan bukan persetujuan barang berbahaya.',
      seoTitle: 'Penerimaan Kargo Khusus: Pastikan Sebelum Booking | VORA',
      seoDescription: 'Yang perlu disiapkan sebelum menanyakan baterai, cairan, dan kargo serupa, perbedaan pertanyaan dengan penerimaan, serta mengapa pengiriman barang berbahaya membutuhkan tenaga terlatih.',
      coverAlt: 'Dosir informasi kargo dengan komposisi, kemasan, dan safety data sheet disorot',
      sections: [
        { h: 'Khusus tidak berarti dilarang', p: [
          'Produk yang mengandung baterai, cairan, aerosol, magnet, atau bahan kimia dikirim setiap hari. Sebagian tidak dibatasi, sebagian diterima dengan syarat, dan sebagian ditolak oleh operator tertentu. Termasuk yang mana suatu produk bergantung pada bahannya, kemasannya, dan siapa pengangkutnya. Cara mengetahuinya adalah bertanya sejak awal, dengan informasi, dan memperlakukan jawabannya sebagai khusus untuk produk dan pengangkut itu.',
        ] },
        { h: 'Pertanyaan, penerimaan, persetujuan', p: ['Tiga hal berbeda sering disebut dengan kata yang sama.'], table: {
          head: ['Tahap', 'Apa itu', 'Apa yang bukan'],
          rows: [
            ['Pertanyaan awal', 'Pertanyaan apakah produk dapat diangkut dan apa yang diperlukan', 'Booking, janji, atau penilaian atas produk'],
            ['Penerimaan operator', 'Keputusan pengangkut atau maskapai untuk membawa barang sebagaimana diajukan, biasanya saat penyerahan', 'Berlaku untuk produk, kemasan, atau tanggal yang berbeda'],
            ['Persetujuan atau deklarasi barang berbahaya', 'Klasifikasi, pengemasan, penandaan, pelabelan, dan dokumentasi oleh orang yang terlatih, sesuai regulasi yang berlaku', 'Sesuatu yang dapat diberikan atau digantikan oleh forwarder atau artikel ini'],
          ],
        } },
        { h: 'Apa yang harus dikatakan informasinya', list: [
          'Nama produk dan kegunaannya.',
          'Komposisi: untuk baterai, kimia dan ukuran atau rating energinya; untuk cairan, kandungan dan konsentrasinya.',
          'Safety data sheet yang terkini dan dari produsen.',
          'Kemasan: kemasan dalam dan luar, jumlah per kemasan, dan jumlah total.',
          'Apakah baterai dikirim terpisah, dikemas bersama peralatan, atau terpasang di dalam peralatan.',
          'Moda dan rute yang diinginkan, karena penerimaan berbeda antara udara, laut, dan darat.',
          'Laporan uji, sertifikat, atau klasifikasi yang sudah dimiliki produsen.',
        ] },
        { h: 'Mengapa udara lebih ketat pada sebagian kasus', p: [
          'IATA Dangerous Goods Regulations mengatur cara barang berbahaya diklasifikasikan, dikemas, ditandai, dilabeli, dan didokumentasikan untuk angkutan udara, dan membagi kewajiban antara pengirim dan operator. Maskapai juga dapat menerapkan pembatasan tambahannya sendiri. Produk yang rutin lewat laut dapat memerlukan pengaturan lain, atau ditolak, lewat udara. Bila pilihan moda penting bagi Anda, sebutkan dalam pertanyaan.',
        ] },
        { h: 'Pertanyaan fiktif', example: {
          label: 'Contoh fiktif, dibuat untuk ilustrasi. Tidak menyatakan aturan untuk produk nyata mana pun.',
          p: [
            'Seorang importir ingin mengirim 500 speaker portabel. Pertanyaannya hanya "speaker dengan baterai, dari Surabaya, lewat udara". Forwarder meminta jenis dan rating baterai, apakah baterai terpasang di dalam, safety data sheet, kemasan, dan jumlah per karton.',
            'Importir kembali dengan data sheet dan foto kemasan, dan menyatakan bahwa baterai terpasang di dalam speaker. Dengan itu forwarder dapat menanyakan kepada maskapai apa yang diterima dan dengan syarat apa. Jawabannya, apa pun itu, merujuk pada produk, kemasan, dan rute tersebut, dan tidak berlaku untuk speaker yang berbeda.',
          ],
        } },
        { h: 'Siapa yang boleh menyiapkan barang berbahaya untuk angkutan', p: [
          'Menyiapkan barang berbahaya untuk pengiriman memerlukan pelatihan yang sesuai dengan fungsinya, dan pengirim memikul tanggung jawab tertentu. Artikel ini tidak memberi tahu cara mengklasifikasikan, mengemas, menandai, atau mendokumentasikan barang berbahaya, dan tidak ada di dalamnya yang membuat pembaca berkualifikasi untuk itu. Bila produk Anda adalah atau mungkin barang berbahaya, libatkan orang yang terlatih dan tanyakan kepada operator apa yang dipersyaratkan sebelum Anda mengikatkan diri pada suatu tanggal.',
        ] },
        { h: 'Daftar periksa persiapan', steps: [
          'Kumpulkan safety data sheet terkini dan rincian komposisi.',
          'Foto produk dan kemasannya sebagaimana akan dikirim.',
          'Tentukan moda dan rute, dan sebutkan apakah alternatif dapat diterima.',
          'Kirim pertanyaan dengan lampiran ini dan tanyakan apa lagi yang diperlukan.',
          'Tahan booking sampai jawaban operator diterima tertulis.',
          'Tanyakan ulang setiap kali produk, kemasan, atau rute berubah.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Regulasi dan ketentuan operator diperbarui secara berkala dan berbeda menurut moda, jadi periksa edisi dan tanggal berlaku untuk tanggal pengiriman Anda. Laman IATA yang dikutip menampilkan edisi ke-68 pada tanggal akses; edisi itu mungkin bukan yang berlaku untuk pengiriman yang lebih kemudian. Contohnya fiktif dan pertanyaan bukanlah persetujuan.',
        ] },
      ],
    },
  },
  {
    group: 'shipment-close-out', year: 2026, quarter: 4,
    topic: { en: 'Documents and billing', id: 'Dokumen dan penagihan' },
    sources: ['S8', 'S11'],
    en: {
      slug: 'shipment-close-out-connect-the-quotation-delivery-and-payment-records',
      title: 'Shipment Close-Out: Connect the Quotation, Delivery and Payment Records',
      excerpt: 'A shipment is finished when its records agree: what was quoted, what was delivered and what was paid. Reconciling them in order, and keeping the exceptions visible, prevents the disputes that surface months later.',
      seoTitle: 'Shipment Close-Out: Connect the Quotation, Delivery and Payment Records | VORA',
      seoDescription: 'How the quotation, delivery record, invoice, pre-payment receipt and confirmed payment receipt relate, how to reconcile them, and why verification should be secure.',
      coverAlt: 'A document relationship diagram linking quotation, delivery record, invoice and payment receipt',
      sections: [
        { h: 'A chain of records, not a pile', p: [
          'After the cargo has been delivered, a shipment leaves a set of documents behind: a quotation, a booking, a delivery record, an invoice, a payment and a receipt. In a pile, they invite disputes. In a chain, each one refers to the one before it, and a reader can follow a reference from the payment back to the quotation. Close-out is the step in which that chain is checked.',
        ] },
        { h: 'The records and what each states', table: {
          head: ['Record', 'What it states', 'What it does not state'],
          rows: [
            ['Quotation', 'Scope, items, price basis and validity as offered', 'That the service was performed'],
            ['Customer approval of the quotation', 'The customer accepted that scope and those terms', 'That the supplier has validated it on its side'],
            ['Delivery record (including POD)', 'Handover: who, when, quantity, condition, exceptions', 'That the invoice has been paid'],
            ['Invoice', 'Amount due, for what, by when, to which account', 'That payment was received'],
            ['Pre-payment receipt', 'The amount due and how to pay, issued before payment', 'That any money was received'],
            ['Confirmed payment receipt', 'That the supplier has checked the payment and confirmed it', 'A review of whether the goods were as ordered'],
          ],
        } },
        { h: 'Reconciliation in order', steps: [
          'Match the invoice lines to the quotation items. Differences should have a recorded reason, such as an approved change.',
          'Match the delivered quantity and condition on the delivery record to what the invoice charges for.',
          'Check exceptions on the delivery record and whether each one is closed, credited or still open.',
          'Check that the invoice and the pre-payment receipt state the same amount and account.',
          'When payment arrives, match the amount and reference to the invoice. Record partial payments and differences, and do not call the invoice paid until the supplier has confirmed.',
          'Issue or obtain the confirmed payment receipt after confirmation, not before.',
          'File the set with cross-references so each document can be found from any other.',
        ] },
        { h: 'A hypothetical transaction', example: {
          label: 'Hypothetical transaction, invented for illustration. It describes no customer or company history.',
          p: [
            'A quotation covers 10 pallets at a stated price per pallet. The delivery record shows 10 pallets handed over, with a note that two cartons on pallet 6 were wet. The invoice charges for 10 pallets. The customer pays the full amount and asks for the wet cartons to be considered.',
            'At close-out the reconciler sees three open points: the exception on the delivery record, the full payment against a disputed item, and the confirmation of the payment. The exception is logged as a claim under the shipment’s reference; the payment is matched and confirmed; the confirmed receipt is issued. The claim is handled on its own track and does not block the receipt, and the file shows exactly that.',
          ],
        } },
        { h: 'Why the receipt types are kept apart', p: [
          'A pre-payment receipt and a confirmed payment receipt serve different readers at different times. If both are called "receipt" and treated alike, a customer may believe an invoice is settled when no money has been confirmed, or a finance team may close a file on a document that never certified payment. Naming them separately, and stating on each what it does and does not show, protects both sides.',
        ] },
        { h: 'Secure verification', p: [
          'Documents that are sent by email are copied, forwarded and sometimes altered. A verification link or QR code that opens a record held by the issuer lets a reader check the document number, its type and its current status against the source. It should not expose more than the checker needs: personal data and amounts belong behind a link that does not list other customers’ records. The GS1 Traceability Standard describes recording key events and the data about them as the basis for trusting a chain, and the same idea applies to documents.',
        ] },
        { h: 'Limits of this guide', p: [
          'The article describes a pattern for reconciling records and makes no statement about the history or customers of any company. The example is hypothetical. Accounting, tax and e-stamp requirements for invoices and receipts depend on the law and on your accountant’s advice; this article is not advice on them. Standard forwarding documents, such as those FIATA publishes, have their own terms.',
        ] },
      ],
    },
    id: {
      slug: 'penutupan-pengiriman-hubungkan-quotation-bukti-serah-terima-dan-pembayaran',
      title: 'Penutupan Pengiriman: Hubungkan Quotation, Bukti Serah Terima, dan Pembayaran',
      excerpt: 'Pengiriman selesai ketika catatannya sepakat: apa yang ditawarkan, apa yang diantar, dan apa yang dibayar. Merekonsiliasinya secara berurutan, dengan pengecualian yang tetap terlihat, mencegah sengketa yang baru muncul berbulan-bulan kemudian.',
      seoTitle: 'Penutupan Pengiriman: Hubungkan Quotation, Serah Terima, dan Pembayaran | VORA',
      seoDescription: 'Hubungan antara quotation, catatan pengantaran, invoice, pre-payment receipt, dan kwitansi pembayaran terkonfirmasi; cara merekonsiliasinya; dan mengapa verifikasi harus aman.',
      coverAlt: 'Diagram hubungan dokumen yang menautkan quotation, catatan pengantaran, invoice, dan kwitansi pembayaran',
      sections: [
        { h: 'Rangkaian catatan, bukan tumpukan', p: [
          'Setelah barang diantar, sebuah pengiriman meninggalkan sejumlah dokumen: quotation, booking, catatan pengantaran, invoice, pembayaran, dan kwitansi. Dalam tumpukan, dokumen-dokumen itu mengundang sengketa. Dalam rangkaian, tiap dokumen merujuk pada yang sebelumnya, dan pembaca bisa menelusuri rujukan dari pembayaran kembali ke quotation. Penutupan adalah langkah ketika rangkaian itu diperiksa.',
        ] },
        { h: 'Catatan dan apa yang dinyatakan masing-masing', table: {
          head: ['Catatan', 'Yang dinyatakan', 'Yang tidak dinyatakan'],
          rows: [
            ['Quotation', 'Cakupan, item, dasar harga, dan masa berlaku sebagaimana ditawarkan', 'Bahwa layanan sudah dilaksanakan'],
            ['Persetujuan pelanggan atas quotation', 'Pelanggan menerima cakupan dan ketentuan tersebut', 'Bahwa penyedia sudah memvalidasinya di sisinya'],
            ['Catatan pengantaran (termasuk POD)', 'Serah terima: siapa, kapan, jumlah, kondisi, pengecualian', 'Bahwa invoice sudah dibayar'],
            ['Invoice', 'Jumlah yang harus dibayar, untuk apa, kapan, ke rekening mana', 'Bahwa pembayaran sudah diterima'],
            ['Pre-payment receipt', 'Jumlah yang harus dibayar dan cara membayar, diterbitkan sebelum pembayaran', 'Bahwa dana apa pun sudah diterima'],
            ['Kwitansi pembayaran terkonfirmasi', 'Bahwa penyedia sudah memeriksa pembayaran dan mengonfirmasinya', 'Penilaian apakah barang sesuai pesanan'],
          ],
        } },
        { h: 'Rekonsiliasi secara berurutan', steps: [
          'Cocokkan baris invoice dengan item quotation. Perbedaan harus punya alasan tercatat, misalnya perubahan yang disetujui.',
          'Cocokkan jumlah dan kondisi pada catatan pengantaran dengan yang ditagih invoice.',
          'Periksa pengecualian pada catatan pengantaran dan apakah masing-masing sudah ditutup, dikreditkan, atau masih terbuka.',
          'Periksa bahwa invoice dan pre-payment receipt menyatakan jumlah dan rekening yang sama.',
          'Saat pembayaran masuk, cocokkan jumlah dan referensinya dengan invoice. Catat pembayaran sebagian dan selisihnya, dan jangan menyebut invoice lunas sebelum penyedia mengonfirmasi.',
          'Terbitkan atau terima kwitansi pembayaran terkonfirmasi setelah konfirmasi, bukan sebelumnya.',
          'Arsipkan satu set dengan rujukan silang agar tiap dokumen dapat ditemukan dari dokumen lain.',
        ] },
        { h: 'Transaksi hipotetis', example: {
          label: 'Transaksi hipotetis, dibuat untuk ilustrasi. Tidak menggambarkan pelanggan atau riwayat perusahaan.',
          p: [
            'Sebuah quotation mencakup 10 pallet dengan harga per pallet yang tertulis. Catatan pengantaran menunjukkan 10 pallet diserahkan, dengan catatan bahwa dua karton di pallet 6 basah. Invoice menagih 10 pallet. Pelanggan membayar penuh dan meminta karton basah itu dipertimbangkan.',
            'Saat penutupan, petugas rekonsiliasi melihat tiga hal terbuka: pengecualian pada catatan pengantaran, pembayaran penuh atas item yang dipersoalkan, dan konfirmasi pembayaran. Pengecualian dicatat sebagai klaim di bawah referensi pengiriman; pembayaran dicocokkan dan dikonfirmasi; kwitansi terkonfirmasi diterbitkan. Klaim ditangani di jalurnya sendiri dan tidak menghambat kwitansi, dan berkas menunjukkan persis hal itu.',
          ],
        } },
        { h: 'Mengapa jenis kwitansi dipisahkan', p: [
          'Pre-payment receipt dan kwitansi pembayaran terkonfirmasi melayani pembaca berbeda pada waktu berbeda. Bila keduanya disebut "kwitansi" dan diperlakukan sama, pelanggan dapat mengira invoice sudah lunas padahal belum ada dana yang dikonfirmasi, atau tim keuangan dapat menutup berkas dengan dokumen yang tidak pernah menyatakan pembayaran. Menamai keduanya secara terpisah, dan menyatakan pada masing-masing apa yang ditunjukkan dan tidak ditunjukkannya, melindungi kedua pihak.',
        ] },
        { h: 'Verifikasi yang aman', p: [
          'Dokumen yang dikirim lewat email disalin, diteruskan, dan kadang diubah. Tautan verifikasi atau kode QR yang membuka catatan yang disimpan penerbit memungkinkan pembaca memeriksa nomor dokumen, jenis, dan statusnya terhadap sumber. Tautan itu tidak boleh membuka lebih dari yang dibutuhkan pemeriksa: data pribadi dan jumlah berada di balik tautan yang tidak mendaftar catatan pelanggan lain. GS1 Traceability Standard menjelaskan pencatatan peristiwa penting dan datanya sebagai dasar kepercayaan pada suatu rantai, dan gagasan yang sama berlaku untuk dokumen.',
        ] },
        { h: 'Batasan panduan ini', p: [
          'Artikel ini menjelaskan pola merekonsiliasi catatan dan tidak membuat pernyataan tentang riwayat atau pelanggan perusahaan mana pun. Contohnya hipotetis. Persyaratan akuntansi, pajak, dan meterai untuk invoice dan kwitansi bergantung pada hukum dan nasihat akuntan Anda; artikel ini bukan nasihat tentang hal itu. Dokumen forwarding standar, seperti yang diterbitkan FIATA, memiliki ketentuannya sendiri.',
        ] },
      ],
    },
  },
]
