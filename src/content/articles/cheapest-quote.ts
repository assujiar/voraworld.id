import type { LangDraft } from '../archive/types'

/**
 * The first article written for publication (not part of the archive collection). Slugs differ by language because `articles.slug` is unique across
 * languages in production; the two entries are linked with the `pair:` tag so each page names the other as its hreflang alternate.
 */
export const cheapestQuote = {
  group: 'cheapest-quote',
  tags: 'pair:cheapest-quote,freight quote,pricing,forwarding',
  category: { en: 'Pricing', id: 'Harga' },
  sources: ['S1', 'S4', 'S10'],
  en: {
    slug: 'cheapest-freight-quote-often-costs-more',
    title: 'The Cheapest Freight Quote Is Usually the Most Expensive One',
    excerpt: 'Everyone says to collect three quotes and take the lowest. That advice compares numbers that were never measuring the same thing. Here is how to compare the scope first, find what a low figure leaves out and decide on the cost of the whole shipment.',
    seoTitle: 'Cheapest Freight Quote? Why It Often Costs More | VORA',
    seoDescription: 'Picking the lowest of three freight quotes is poor advice. Compare scope line by line, spot what a low quote leaves out and judge the total cost.',
    coverAlt: 'Two freight quotes side by side with the missing lines highlighted',
    sections: [
      { h: 'The advice everyone gives, and why it fails', p: [
        'Ask anyone how to buy freight and you will hear the same rule: get three quotes and take the lowest. It sounds like discipline. In practice it compares three documents that were not written to answer the same question.',
        'A freight quote is not a price tag on a fixed product. It is a description of what the forwarder will do, for which cargo, between which two points, on which assumptions, with a number attached. Change any of those parts and the number changes with it. When two quotes differ by a third, the honest first question is not "who is cheaper?" but "what is each one actually promising?"',
      ] },
      { h: 'How a low number gets made', p: [
        'Most differences between quotes are honest differences of scope, not tricks. The trouble is that they are invisible on the page, where only the total is easy to compare. A lower total can come from any of these:',
      ], list: [
        '**A narrower scope.** The quote ends at the port or airport, while another one includes handling at the destination, customs coordination and delivery to your door.',
        '**Generous assumptions.** Normal weight, normal dimensions, no waiting, no re-delivery. If the cargo turns out to be bulkier than assumed, the charge is recalculated later.',
        '**Items that are "at cost" or "to be advised".** The line exists, but without a number. The quote looks lower because part of the bill has not been written yet.',
        '**A short validity window.** The figure is real today and may not be next week, when your cargo is actually ready.',
        '**A different charging basis.** For air freight the charge follows the greater of actual and volumetric weight, so a light, bulky shipment is charged on its volume. A quote that quietly assumes the actual weight will look cheaper until the cargo is measured.',
      ] },
      { h: 'Normalize before you compare', p: [
        'The useful move is to rewrite every quote into the same shape before you look at a total. A table with one row for each step of the journey is enough. Fill each cell with what the quote says, and with a question mark where it says nothing.',
      ], table: {
        head: ['Step', 'Quote A', 'Quote B', 'What to ask'],
        rows: [
          ['Pickup at origin', 'Included', '?', 'Is pickup in the price, and from which address?'],
          ['Origin handling and documents', '?', 'Included', 'Which fees are charged before departure?'],
          ['Main transport', 'Included', 'Included', 'On what chargeable weight or volume?'],
          ['Destination handling', '?', '?', 'Who pays terminal and handling charges on arrival?'],
          ['Customs clearance', 'Excluded', 'Included', 'Who prepares the declaration, and what are its fees?'],
          ['Delivery to the final address', 'Excluded', 'Included', 'Where does the quote stop?'],
          ['Validity', '7 days', '14 days', 'What happens to the figure after that?'],
        ],
      }, after: ['Every question mark is a cost that somebody will bill you for later, or a step that somebody assumes you will arrange yourself.'] },
      { h: 'A worked example with invented numbers', example: {
        label: 'Hypothetical example, invented for illustration. The units are arbitrary and no real rate is implied.',
        p: [
          'Quote A totals 100 units. Quote B totals 130. Written into the table above, A turns out to stop at the destination terminal: it leaves out destination handling (18 units), customs clearance (9 units) and delivery (22 units). Quote B already contains all three.',
          'Put on the same scope, A comes to 100 + 18 + 9 + 22 = 149 units against 130 for B. The quote that looked 23% cheaper is about 15% more expensive once it covers the same journey. If A also assumed the actual weight and the cargo is later charged on volume, the gap widens further.',
        ],
      } },
      { h: 'The number you are not comparing: what a day of delay costs', p: [
        'Even a perfectly normalized comparison leaves out the largest variable. Freight is not bought for its own sake. It is bought so that goods arrive when somebody needs them. A late shipment can mean a production line waiting for parts, a missed sales window, or a customer who buys elsewhere.',
        'So ask a second question next to the price: what does one day of delay cost me? If the answer is "almost nothing", the lowest normalized quote is a sensible choice. If the answer is "a stopped line", paying more for a clearer scope, an earlier departure or a forwarder who explains the documents before they are needed is usually the cheaper decision.',
        'Charges that start when cargo waits are part of the same arithmetic. Carriers publish their own rules for free time, demurrage and detention, and those rules depend on the location and the contract, so a delay at the destination can turn into a bill that was never in the quote.',
      ] },
      { h: 'Five questions that expose the gap', steps: [
        'Where exactly does this quote start and stop, and which steps are mine to arrange?',
        'On which weight, volume or container basis is the price calculated, and what happens if the real cargo differs?',
        'Which charges are not in this total, and how will each of them be billed?',
        'Until what date is the figure valid, and what moves it?',
        'If the cargo is delayed or changes, who pays for what, and where is that written?',
      ], after: ['A forwarder who answers these in writing before you book is telling you something useful about how the rest of the job will go.'] },
      { h: 'When the cheapest quote is the right one', p: [
        'None of this means the lowest number is always wrong. For standard cargo, flexible timing and a buyer who is happy to handle the destination side, the cheapest like-for-like quote is often the right one. The point is narrower: an unexamined lowest quote is a bet that nothing was left out. Examining it takes an hour and a table.',
        'It also helps to settle the allocation of responsibilities between buyer and seller before you ask for quotes. Incoterms® 2020, published by the International Chamber of Commerce, allocate costs, risks and obligations between the two parties of a sale, and they are the starting point for knowing which steps a quote has to cover at all.',
      ] },
      { h: 'Start from a brief, not from a target price', p: [
        'The most reliable way to receive comparable quotes is to send the same, complete request to everyone: the goods, the packing, weights and dimensions, the route, the ready date, the agreed trade term and the steps you want quoted. The checklists on our [Insights page](/en/insights) and the [frequently asked questions](/en/faq) list what to include. When you are ready, you can [request a quote](/en/request-quote) with the route and the cargo, and we will confirm the arrangement for that inquiry.',
      ] },
      { h: 'Limits of this article', p: [
        'This article explains how to compare quotes. It does not state any current rate, transit time or free-time allowance, and the example uses invented numbers. Carrier and airline conditions differ by location and contract, so rely on the written terms of the quote you receive.',
      ] },
    ],
  } satisfies LangDraft,
  id: {
    slug: 'penawaran-freight-termurah-sering-lebih-mahal',
    title: 'Penawaran Freight Termurah Sering Jadi yang Paling Mahal',
    excerpt: 'Nasihat umumnya: kumpulkan tiga penawaran lalu ambil yang terendah. Cara itu membandingkan angka yang tidak pernah mengukur hal yang sama. Berikut cara membandingkan cakupannya lebih dulu, menemukan apa yang tidak ada di angka rendah, dan menilai biaya seluruh pengiriman.',
    seoTitle: 'Penawaran Freight Termurah Sering Lebih Mahal | VORA',
    seoDescription: 'Memilih penawaran freight terendah dari tiga penawaran adalah saran yang keliru. Bandingkan cakupan baris demi baris dan nilai biaya totalnya.',
    coverAlt: 'Dua penawaran freight berdampingan dengan baris yang hilang disorot',
    sections: [
      { h: 'Saran yang semua orang berikan, dan mengapa gagal', p: [
        'Tanyakan kepada siapa pun cara membeli jasa pengiriman dan Anda akan mendengar aturan yang sama: minta tiga penawaran, ambil yang terendah. Kedengarannya disiplin. Dalam praktik, cara itu membandingkan tiga dokumen yang tidak ditulis untuk menjawab pertanyaan yang sama.',
        'Penawaran freight bukan label harga pada produk yang bentuknya tetap. Penawaran adalah uraian tentang apa yang akan dikerjakan forwarder, untuk barang apa, antara dua titik mana, dengan asumsi apa, lalu diberi angka. Ubah salah satu bagiannya dan angkanya ikut berubah. Bila dua penawaran selisih sepertiga, pertanyaan pertama yang jujur bukan "siapa yang lebih murah?", melainkan "apa sebenarnya yang dijanjikan masing-masing?"',
      ] },
      { h: 'Bagaimana angka rendah terbentuk', p: [
        'Sebagian besar selisih antarpenawaran adalah perbedaan cakupan yang wajar, bukan akal-akalan. Masalahnya, perbedaan itu tidak terlihat di halaman penawaran, tempat hanya total yang mudah dibandingkan. Total yang lebih rendah bisa berasal dari salah satu hal ini:',
      ], list: [
        '**Cakupan yang lebih sempit.** Penawaran berhenti di pelabuhan atau bandara, sedangkan penawaran lain memuat penanganan di tujuan, koordinasi kepabeanan, dan pengantaran sampai pintu Anda.',
        '**Asumsi yang longgar.** Berat dan ukuran normal, tanpa menunggu, tanpa pengantaran ulang. Bila barang ternyata lebih besar dari perkiraan, biayanya dihitung ulang kemudian.',
        '**Komponen "at cost" atau "to be advised".** Barisnya ada, angkanya tidak. Penawaran tampak lebih rendah karena sebagian tagihan belum ditulis.',
        '**Masa berlaku yang pendek.** Angkanya nyata hari ini dan belum tentu berlaku minggu depan, saat barang Anda benar-benar siap.',
        '**Dasar perhitungan yang berbeda.** Pada air freight, biaya mengikuti yang lebih besar antara berat aktual dan berat volumetrik, sehingga kiriman ringan yang memakan tempat dihitung berdasarkan volumenya. Penawaran yang diam-diam memakai berat aktual akan tampak lebih murah sampai barangnya diukur.',
      ] },
      { h: 'Samakan bentuknya sebelum membandingkan', p: [
        'Langkah yang berguna adalah menulis ulang setiap penawaran dalam bentuk yang sama sebelum melihat totalnya. Cukup satu tabel dengan satu baris untuk tiap tahap perjalanan. Isi setiap sel dengan apa yang tertulis di penawaran, dan tanda tanya di tempat penawaran tidak menyebut apa pun.',
      ], table: {
        head: ['Tahap', 'Penawaran A', 'Penawaran B', 'Yang perlu ditanyakan'],
        rows: [
          ['Penjemputan di asal', 'Termasuk', '?', 'Apakah penjemputan sudah dalam harga, dan dari alamat mana?'],
          ['Penanganan dan dokumen di asal', '?', 'Termasuk', 'Biaya apa saja yang dikenakan sebelum keberangkatan?'],
          ['Pengangkutan utama', 'Termasuk', 'Termasuk', 'Berdasarkan berat atau volume tertagih berapa?'],
          ['Penanganan di tujuan', '?', '?', 'Siapa yang membayar biaya terminal dan handling saat tiba?'],
          ['Kepabeanan', 'Tidak termasuk', 'Termasuk', 'Siapa yang menyiapkan pemberitahuan, dan berapa biayanya?'],
          ['Pengantaran ke alamat akhir', 'Tidak termasuk', 'Termasuk', 'Di mana penawaran berhenti?'],
          ['Masa berlaku', '7 hari', '14 hari', 'Apa yang terjadi pada angka setelah itu?'],
        ],
      }, after: ['Setiap tanda tanya adalah biaya yang akan ditagihkan kepada Anda belakangan, atau tahap yang diasumsikan akan Anda urus sendiri.'] },
      { h: 'Contoh hitungan dengan angka rekaan', example: {
        label: 'Contoh hipotetis, angka dibuat untuk ilustrasi. Satuannya sembarang dan tidak menyiratkan tarif nyata.',
        p: [
          'Penawaran A berjumlah 100 satuan. Penawaran B berjumlah 130. Setelah dimasukkan ke tabel di atas, A ternyata berhenti di terminal tujuan: tidak memuat penanganan di tujuan (18 satuan), kepabeanan (9 satuan), dan pengantaran (22 satuan). Penawaran B sudah memuat ketiganya.',
          'Pada cakupan yang sama, A menjadi 100 + 18 + 9 + 22 = 149 satuan, dibanding 130 untuk B. Penawaran yang tampak 23% lebih murah ternyata sekitar 15% lebih mahal begitu mencakup perjalanan yang sama. Bila A juga mengasumsikan berat aktual dan barang kemudian dihitung berdasarkan volume, selisihnya melebar lagi.',
        ],
      } },
      { h: 'Angka yang tidak Anda bandingkan: biaya sehari keterlambatan', p: [
        'Perbandingan yang sudah disamakan pun masih melewatkan variabel terbesar. Freight tidak dibeli demi freight itu sendiri. Freight dibeli supaya barang tiba saat dibutuhkan. Pengiriman yang terlambat bisa berarti lini produksi menunggu suku cadang, momen penjualan terlewat, atau pelanggan membeli di tempat lain.',
        'Karena itu ajukan pertanyaan kedua di samping harga: berapa biaya satu hari keterlambatan bagi saya? Bila jawabannya "nyaris nol", penawaran terendah yang sudah disamakan cakupannya adalah pilihan yang masuk akal. Bila jawabannya "lini berhenti", membayar lebih untuk cakupan yang jelas, keberangkatan yang lebih awal, atau forwarder yang menjelaskan dokumen sebelum dibutuhkan biasanya keputusan yang lebih murah.',
        'Biaya yang mulai berjalan saat barang menunggu termasuk dalam hitungan yang sama. Pengangkut menerbitkan aturannya sendiri tentang free time, demurrage, dan detention, dan aturan itu bergantung pada lokasi dan kontrak, jadi keterlambatan di tujuan bisa berubah menjadi tagihan yang tidak pernah ada di penawaran.',
      ] },
      { h: 'Lima pertanyaan yang membuka celahnya', steps: [
        'Di mana persisnya penawaran ini mulai dan berhenti, dan tahap mana yang harus saya atur sendiri?',
        'Harga dihitung berdasarkan berat, volume, atau kontainer apa, dan apa yang terjadi bila barang sebenarnya berbeda?',
        'Biaya apa saja yang tidak ada dalam total ini, dan bagaimana masing-masing akan ditagih?',
        'Sampai tanggal berapa angka ini berlaku, dan apa yang dapat mengubahnya?',
        'Bila barang tertunda atau berubah, siapa membayar apa, dan di mana hal itu tertulis?',
      ], after: ['Forwarder yang menjawab semua ini secara tertulis sebelum Anda booking sedang memberi tahu Anda sesuatu yang berguna tentang cara pekerjaan lainnya akan berjalan.'] },
      { h: 'Kapan penawaran termurah memang tepat', p: [
        'Semua ini tidak berarti angka terendah selalu salah. Untuk barang standar, jadwal yang fleksibel, dan pembeli yang bersedia mengurus sisi tujuan, penawaran termurah dengan cakupan setara sering menjadi pilihan yang tepat. Intinya lebih sempit: penawaran terendah yang tidak diperiksa adalah taruhan bahwa tidak ada yang terlewat. Memeriksanya hanya butuh satu jam dan satu tabel.',
        'Akan membantu pula bila pembagian tanggung jawab antara pembeli dan penjual disepakati sebelum Anda meminta penawaran. Incoterms® 2020 dari International Chamber of Commerce membagi biaya, risiko, dan kewajiban antara kedua pihak dalam jual beli, dan menjadi titik awal untuk mengetahui tahap mana yang harus dicakup sebuah penawaran.',
      ] },
      { h: 'Mulailah dari brief, bukan dari target harga', p: [
        'Cara paling andal untuk mendapat penawaran yang bisa dibandingkan adalah mengirim permintaan yang sama dan lengkap kepada semua pihak: barang, kemasan, berat dan dimensi, rute, tanggal siap, term perdagangan yang disepakati, dan tahap yang ingin dihitung. [Pertanyaan yang sering diajukan](/id/faq) memuat apa saja yang perlu disertakan. Bila sudah siap, Anda dapat [meminta penawaran](/id/request-quote) dengan menyebut rute dan barangnya, dan kami akan mengonfirmasi pilihan layanan untuk permintaan itu.',
      ] },
      { h: 'Batasan artikel ini', p: [
        'Artikel ini menjelaskan cara membandingkan penawaran. Artikel ini tidak menyebut tarif, waktu tempuh, atau free time yang berlaku saat ini, dan contohnya memakai angka rekaan. Ketentuan pengangkut dan maskapai berbeda menurut lokasi dan kontrak, jadi andalkan ketentuan tertulis pada penawaran yang Anda terima.',
      ] },
    ],
  } satisfies LangDraft,
}
