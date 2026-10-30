import type { Locale } from './index'

export interface FaqEntry { id: string; q: Record<Locale, string>; a: Record<Locale, string> }

/**
 * Answers shown when no questions have been entered in the admin portal. They describe how a quotation request is handled and what the documents
 * mean; none of them states a price, a transit time, a free-time allowance, a coverage area or a capacity. The Indonesian text is edited on its own,
 * not translated line by line.
 */
export const faqEntries: FaqEntry[] = [
  {
    id: 'rfq-info',
    q: { en: 'What should I include in a quotation request?', id: 'Informasi apa yang perlu saya tulis saat meminta penawaran?' },
    a: {
      en: 'The route (origin and destination at city or port level), what the goods are, how they are packed, the gross weight and the size of each package, and the date the cargo is ready. Add the agreed Incoterm if you have one. The more of these you give in the first message, the fewer follow-up questions you will get before a quotation can be prepared.',
      id: 'Rute (asal dan tujuan sampai tingkat kota atau pelabuhan), jenis barang, cara pengemasan, berat kotor, ukuran tiap kemasan, dan tanggal barang siap. Sertakan Incoterm yang disepakati bila ada. Semakin lengkap pesan pertama Anda, semakin sedikit pertanyaan lanjutan sebelum penawaran bisa disusun.',
    },
  },
  {
    id: 'scope',
    q: { en: 'How do I know what a quotation covers?', id: 'Bagaimana saya tahu apa saja yang tercakup dalam penawaran?' },
    a: {
      en: 'A quotation lists its items one by one and states its scope. Read it against your trade term: origin pickup, export clearance, the main leg, destination handling, import clearance and delivery are separate steps, and a quotation may include some of them and leave others to another party. If a step is not written, ask whether it is in or out.',
      id: 'Penawaran mencantumkan tiap item dan menyatakan cakupannya. Bacalah bersama term perdagangan Anda: penjemputan di asal, export clearance, pengiriman utama, penanganan di tujuan, import clearance, dan pengantaran adalah langkah yang terpisah. Penawaran bisa memuat sebagian dan menyerahkan sisanya kepada pihak lain. Bila suatu langkah tidak tertulis, tanyakan apakah termasuk atau tidak.',
    },
  },
  {
    id: 'validity',
    q: { en: 'How long is a quotation valid?', id: 'Berapa lama penawaran berlaku?' },
    a: {
      en: 'Each quotation states its own validity date. Carrier and airline rates, surcharges and exchange rates can change, so a quotation is a statement for that date and that cargo. If the cargo, route or quantity changes, ask for the quotation to be reviewed rather than assuming the earlier figures still apply.',
      id: 'Setiap penawaran mencantumkan tanggal berlakunya sendiri. Tarif pelayaran dan maskapai, surcharge, dan kurs dapat berubah, jadi penawaran berlaku untuk tanggal dan barang yang tertulis. Bila barang, rute, atau jumlahnya berubah, mintalah penawaran ditinjau ulang, jangan mengandalkan angka sebelumnya.',
    },
  },
  {
    id: 'chargeable',
    q: { en: 'What is chargeable weight?', id: 'Apa itu chargeable weight?' },
    a: {
      en: 'For air freight the charge usually follows the greater of the actual gross weight and the volumetric weight, which is calculated from the package dimensions with a divisor set by the carrier. A light but bulky shipment can therefore be charged on its volume. Send exact package dimensions so the basis can be stated in the quotation.',
      id: 'Pada air freight, biaya biasanya mengikuti yang lebih besar antara berat kotor aktual dan berat volumetrik, yang dihitung dari dimensi kemasan dengan pembagi yang ditetapkan maskapai. Kiriman ringan tetapi memakan tempat dapat dikenai biaya berdasarkan volumenya. Kirim dimensi kemasan yang tepat agar dasar perhitungannya bisa dicantumkan di penawaran.',
    },
  },
  {
    id: 'packing',
    q: { en: 'Who decides how the cargo is packed?', id: 'Siapa yang menentukan cara pengemasan barang?' },
    a: {
      en: 'The shipper is responsible for packing that suits the goods and the journey. We can tell you what a mode of transport or a handling step usually requires and flag a packing that looks unsuitable, but suitability depends on the cargo itself. Describe the packing in the request and send photographs if the goods are fragile, heavy or unusual in shape.',
      id: 'Pengirim bertanggung jawab atas kemasan yang sesuai dengan barang dan perjalanannya. Kami dapat menjelaskan persyaratan umum suatu moda atau tahap penanganan dan memberi tahu bila kemasan tampak kurang sesuai, tetapi kesesuaian bergantung pada barangnya. Jelaskan kemasan dalam permintaan Anda dan kirim foto bila barang rapuh, berat, atau bentuknya tidak lazim.',
    },
  },
  {
    id: 'customs-docs',
    q: { en: 'Which documents are needed for customs clearance?', id: 'Dokumen apa yang diperlukan untuk proses kepabeanan?' },
    a: {
      en: 'Usually a commercial invoice, a packing list, the transport document and the importer or exporter identity details. Some goods also need permits or certificates. Which ones apply depends on the product and the HS classification, which the authorities determine. Send the documents you have and we will tell you what looks inconsistent or missing before the shipment arrives.',
      id: 'Umumnya commercial invoice, packing list, dokumen angkutan, dan data identitas importir atau eksportir. Sebagian barang juga memerlukan izin atau sertifikat. Dokumen yang berlaku bergantung pada produk dan klasifikasi HS, yang ditetapkan oleh otoritas. Kirimkan dokumen yang Anda miliki, dan kami akan menunjukkan bagian yang tampak tidak konsisten atau belum ada sebelum barang tiba.',
    },
  },
  {
    id: 'special-cargo',
    q: { en: 'Can you move batteries, liquids or other special cargo?', id: 'Apakah baterai, cairan, atau kargo khusus lain bisa dikirim?' },
    a: {
      en: 'It depends on the product, its composition and the carrier or airline that would carry it. Tell us early, with the safety data sheet and the packaging details. An inquiry is not an acceptance: the operator must accept the cargo, and shipping dangerous goods requires people trained for it. We will say plainly if a product needs a different arrangement.',
      id: 'Tergantung produk, komposisinya, dan pelayaran atau maskapai yang akan mengangkutnya. Beri tahu kami sejak awal, lengkap dengan safety data sheet dan rincian kemasan. Pertanyaan bukan persetujuan: operator harus menerima kargo tersebut, dan pengiriman barang berbahaya membutuhkan tenaga yang terlatih. Kami akan menyampaikan secara terbuka bila suatu produk memerlukan pengaturan lain.',
    },
  },
  {
    id: 'windows',
    q: { en: 'Can I set a pickup or delivery window?', id: 'Bisakah saya menetapkan jendela waktu penjemputan atau pengantaran?' },
    a: {
      en: 'Yes, state the window you need in the request together with the access at each address: dock or ground level, vehicle size limits and receiving hours. A window is confirmed in the quotation or the booking, not assumed from the request. Traffic, weather and receiving-site delays are outside any forwarder’s control, so ask what happens if a window is missed.',
      id: 'Bisa. Sebutkan jendela waktu yang Anda perlukan dalam permintaan, beserta kondisi akses di tiap alamat: dock atau permukaan tanah, batas ukuran kendaraan, dan jam penerimaan. Jendela waktu dikonfirmasi dalam penawaran atau booking, bukan dianggap berlaku dari permintaan. Lalu lintas, cuaca, dan keterlambatan di lokasi penerima di luar kendali forwarder mana pun, jadi tanyakan apa yang terjadi bila jendela waktu terlewat.',
    },
  },
  {
    id: 'pod',
    q: { en: 'What does a proof of delivery show?', id: 'Apa yang ditunjukkan bukti serah terima (POD)?' },
    a: {
      en: 'It records the handover: who received the goods, when, in what condition and with which exceptions, such as a quantity difference or visible damage. It can carry a signature, photographs and a timestamp. It is a handover record, not proof that an invoice was paid, and it does not by itself settle a claim.',
      id: 'POD mencatat serah terima: siapa yang menerima barang, kapan, dalam kondisi apa, dan pengecualian yang ada, misalnya selisih jumlah atau kerusakan yang terlihat. POD dapat memuat tanda tangan, foto, dan waktu penerimaan. POD adalah catatan serah terima, bukan bukti bahwa invoice sudah dibayar, dan tidak dengan sendirinya menyelesaikan klaim.',
    },
  },
  {
    id: 'approval',
    q: { en: 'How is a quotation approved?', id: 'Bagaimana penawaran disetujui?' },
    a: {
      en: 'The quotation reaches you by email with an approval link. Approving it records your acceptance of the stated scope and terms. VORA then validates the quotation on its side, and that is a separate step: approval by the customer and validation by VORA are recorded separately, and you receive an email for each.',
      id: 'Penawaran dikirim melalui email dengan tautan persetujuan. Menyetujuinya berarti Anda menerima cakupan dan ketentuan yang tertulis. VORA kemudian memvalidasi penawaran di sisinya, dan itu langkah yang terpisah: persetujuan pelanggan dan validasi VORA dicatat sendiri-sendiri, dan Anda menerima email untuk masing-masing.',
    },
  },
  {
    id: 'invoice-prepayment',
    q: { en: 'What is the Pre-Payment Receipt that arrives with an invoice?', id: 'Apa itu Pre-Payment Receipt yang menyertai invoice?' },
    a: {
      en: 'It accompanies the invoice and lists what is to be paid and how. It is issued before payment and does not confirm that any money has been received. Keep it with the invoice for your payment records.',
      id: 'Dokumen ini menyertai invoice dan memuat apa yang harus dibayar serta caranya. Dokumen ini diterbitkan sebelum pembayaran dan tidak menyatakan bahwa dana sudah diterima. Simpan bersama invoice untuk catatan pembayaran Anda.',
    },
  },
  {
    id: 'payment-receipt',
    q: { en: 'When do I get a receipt that confirms my payment?', id: 'Kapan saya menerima kwitansi yang mengonfirmasi pembayaran?' },
    a: {
      en: 'After VORA has checked the payment against its records and confirmed it. The official payment receipt is issued at that point and sent to you by email. A transfer slip alone is not a confirmation, and a Pre-Payment Receipt is not one either.',
      id: 'Setelah VORA mencocokkan pembayaran dengan catatannya dan mengonfirmasinya. Kwitansi pembayaran resmi diterbitkan pada saat itu dan dikirim ke email Anda. Bukti transfer saja bukan konfirmasi, dan Pre-Payment Receipt juga bukan konfirmasi.',
    },
  },
  {
    id: 'verify',
    q: { en: 'How can I check that a VORA document is genuine?', id: 'Bagaimana saya memastikan dokumen VORA asli?' },
    a: {
      en: 'Documents issued from the VORA system carry a QR code and a verification link. Opening it shows the document number, its type and its current status. If what the page shows does not match what you were given, write to us before acting on the document.',
      id: 'Dokumen yang diterbitkan dari sistem VORA memuat kode QR dan tautan verifikasi. Saat dibuka, halaman menampilkan nomor dokumen, jenisnya, dan statusnya saat ini. Bila yang tampil berbeda dari dokumen yang Anda terima, hubungi kami sebelum menindaklanjuti dokumen tersebut.',
    },
  },
]
