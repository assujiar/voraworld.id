import type { Locale } from './index'

export type LegalKind = 'privacy' | 'terms'

/** English text supplied by the owner; Indonesian preserves its meaning, section order and effective date. */
export const LEGAL_DOCUMENTS: Record<LegalKind, Record<Locale, string>> = {
  privacy: {
    en: `<p><strong>Effective date: 30 October 2026</strong></p>
<p>At VORA, we believe that responsible logistics begins with trust. Protecting personal information is part of that responsibility.</p>
<p>This Privacy Notice explains how PT Satu Arah International, operating under the VORA brand ("VORA", "we", "us", or "our"), collects, uses, stores, shares, and protects personal data when you visit our website, submit an inquiry, request a quotation, or interact with our logistics services and digital documents.</p>
<hr>
<h2>01 / Who We Are</h2>
<p><strong>PT Satu Arah International</strong><br>VORA Freight &amp; Logistics<br>Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810, Indonesia.</p>
<p>Privacy inquiries: <a href="mailto:info@voraworld.id">info@voraworld.id</a></p>
<h2>02 / Information We Collect</h2>
<p>Depending on your interaction with VORA, the personal information we process may include:</p>
<ul>
<li><strong>Identity and contact information:</strong> name, company, job title, email address, telephone number, and business address.</li>
<li><strong>Commercial and shipment information:</strong> quotation requests, cargo descriptions, shipping instructions, delivery locations, transaction references, and relevant business correspondence.</li>
<li><strong>Delivery confirmation information:</strong> recipient identity and contact details, electronic signature, photographs of delivered goods, delivery condition, confirmation timestamps, and optional device location.</li>
<li><strong>Document and transaction information:</strong> details required for quotations, invoices, receipts, customer approvals, and related records.</li>
<li><strong>Technical information:</strong> IP address, browser or device information, timestamps, and security-related activity associated with website or document access.</li>
</ul>
<p>We aim to collect only information reasonably necessary for the applicable purpose. We ask users not to submit sensitive personal information unless specifically required and appropriately authorised.</p>
<h2>03 / How We Use Information</h2>
<p>We process personal information for legitimate business and operational purposes, including:</p>
<ul>
<li>Responding to inquiries and preparing logistics quotations.</li>
<li>Coordinating freight forwarding, transportation, warehousing, customs-related services, and cargo delivery.</li>
<li>Confirming cargo receipt through Proof of Delivery records.</li>
<li>Preparing and verifying business documents.</li>
<li>Managing customer communications, transactions, billing, and payment administration.</li>
<li>Maintaining service quality, system integrity, security, and audit records.</li>
<li>Meeting applicable legal, regulatory, contractual, and compliance obligations.</li>
</ul>
<h3>Legal Basis for Processing</h3>
<p>Depending on the circumstances, processing may rely on consent, contractual necessity, compliance with legal obligations, or other lawful grounds recognised under applicable Indonesian personal data protection law.</p>
<p>Where consent is required, we will seek it through an appropriate mechanism. Consent may be withdrawn in accordance with applicable law, without affecting processing already lawfully undertaken.</p>
<h2>04 / Proof of Delivery and Location Data</h2>
<p>VORA's Proof of Delivery process may collect a recipient's name, position, telephone number, electronic signature, delivery photographs, and confirmation time.</p>
<p>Location sharing is optional. When a recipient chooses to share location, the coordinates may be included in the delivery evidence.</p>
<p>These records are used to document the receipt and condition of goods, support operational verification, and help resolve delivery-related inquiries or disputes.</p>
<p>Access to delivery evidence is intended to be limited to authorised persons with a legitimate operational or contractual need.</p>
<h2>05 / Sharing with Service Providers</h2>
<p>Where necessary for the relevant service, personal information may be disclosed to carriers, freight agents, warehouse operators, customs-related service providers, customers or consignees, technology and infrastructure providers, professional advisers, and competent authorities.</p>
<p>Such disclosures must have an appropriate purpose and legal basis. We do not sell personal data to advertisers or data brokers.</p>
<h2>06 / International Data Transfers</h2>
<p>International logistics may require relevant information to be shared with parties outside Indonesia, including overseas logistics agents, carriers, and other service providers.</p>
<p>Where personal data is transferred internationally, we will apply the requirements and safeguards prescribed by applicable Indonesian law.</p>
<h2>07 / Data Security and Retention</h2>
<p>We apply organisational and technical measures designed to protect information against unauthorised access, alteration, disclosure, loss, or misuse.</p>
<p>Personal information is retained for purposes connected with the relevant service, contractual performance, legal compliance, accounting, audit, dispute management, and other lawful business requirements.</p>
<p>Retention periods depend on the type of record and applicable requirements. When information is no longer required, it will be deleted, anonymised, or otherwise handled in accordance with applicable law and established retention procedures.</p>
<p>No electronic system can guarantee absolute security. We review security practices and respond to incidents in accordance with applicable requirements.</p>
<h2>08 / Cookies and Website Technology</h2>
<p>Our website may use technical mechanisms necessary for core functionality, session management, security, and administration.</p>
<p>If optional analytics or other non-essential tracking technologies are introduced, their use will be addressed through appropriate notices and consent mechanisms where required.</p>
<h2>09 / Your Privacy Rights</h2>
<p>Subject to applicable law, individuals may have rights to:</p>
<ul>
<li>Obtain information about the processing of their personal data.</li>
<li>Request access to personal information.</li>
<li>Request corrections to inaccurate or incomplete information.</li>
<li>Request deletion or termination of processing where legally applicable.</li>
<li>Withdraw consent where processing relies on consent.</li>
<li>Exercise other rights available under Indonesian personal data protection law.</li>
</ul>
<p>Some requests may be subject to identity verification, lawful retention requirements, or applicable exceptions.</p>
<h2>10 / Contact and Privacy Requests</h2>
<p>For privacy inquiries, data access requests, correction requests, or concerns regarding the handling of personal information, contact:</p>
<p><strong>VORA / PT Satu Arah International</strong><br><a href="mailto:info@voraworld.id">info@voraworld.id</a></p>
<p>Please provide sufficient information for us to identify the relevant record and process your request securely.</p>
<h2>11 / Updates to This Notice</h2>
<p>We may revise this Privacy Notice to reflect changes in our services, systems, operational practices, or applicable law.</p>
<p>Material changes will be communicated where required by law. The latest published version will be available on this website.</p>
<hr>
<p><strong>VORA</strong><br>Bringing the World Within Reach.</p>`,
    id: `<p><strong>Tanggal berlaku: 30 Oktober 2026</strong></p>
<p>Bagi VORA, layanan logistik yang bertanggung jawab berawal dari kepercayaan. Melindungi informasi pribadi merupakan bagian dari tanggung jawab tersebut.</p>
<p>Pemberitahuan Privasi ini menjelaskan cara PT Satu Arah International, yang beroperasi dengan merek VORA ("VORA" atau "kami"), mengumpulkan, menggunakan, menyimpan, membagikan, dan melindungi data pribadi saat Anda mengunjungi website kami, mengirim pertanyaan, meminta penawaran, atau menggunakan layanan logistik dan dokumen digital kami.</p>
<hr>
<h2>01 / Tentang Kami</h2>
<p><strong>PT Satu Arah International</strong><br>VORA Freight &amp; Logistics<br>Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810, Indonesia.</p>
<p>Pertanyaan terkait privasi: <a href="mailto:info@voraworld.id">info@voraworld.id</a></p>
<h2>02 / Informasi yang Kami Kumpulkan</h2>
<p>Bergantung pada interaksi Anda dengan VORA, informasi pribadi yang kami proses dapat mencakup:</p>
<ul>
<li><strong>Identitas dan informasi kontak:</strong> nama, perusahaan, jabatan, alamat email, nomor telepon, dan alamat usaha.</li>
<li><strong>Informasi komersial dan pengiriman:</strong> permintaan penawaran, deskripsi barang, instruksi pengiriman, lokasi pengantaran, referensi transaksi, dan korespondensi bisnis yang relevan.</li>
<li><strong>Informasi konfirmasi pengiriman:</strong> identitas dan informasi kontak penerima, tanda tangan elektronik, foto barang yang diterima, kondisi barang saat diterima, waktu konfirmasi, serta lokasi perangkat jika dibagikan secara sukarela.</li>
<li><strong>Informasi dokumen dan transaksi:</strong> rincian yang diperlukan untuk penawaran, invoice, kuitansi, persetujuan pelanggan, dan catatan terkait.</li>
<li><strong>Informasi teknis:</strong> alamat IP, informasi browser atau perangkat, waktu aktivitas, serta aktivitas terkait keamanan saat mengakses website atau dokumen.</li>
</ul>
<p>Kami berupaya hanya mengumpulkan informasi yang secara wajar diperlukan untuk tujuan terkait. Kami meminta pengguna untuk tidak mengirim informasi pribadi sensitif, kecuali informasi tersebut secara khusus diperlukan dan disampaikan dengan kewenangan yang sesuai.</p>
<h2>03 / Cara Kami Menggunakan Informasi</h2>
<p>Kami memproses informasi pribadi untuk keperluan bisnis dan operasional yang sah, termasuk:</p>
<ul>
<li>Menanggapi pertanyaan dan menyiapkan penawaran layanan logistik.</li>
<li>Mengoordinasikan freight forwarding, transportasi, pergudangan, layanan terkait kepabeanan, dan pengantaran barang.</li>
<li>Mengonfirmasi penerimaan barang melalui catatan Bukti Serah Terima (Proof of Delivery).</li>
<li>Menyiapkan dan memverifikasi dokumen bisnis.</li>
<li>Mengelola komunikasi pelanggan, transaksi, penagihan, dan administrasi pembayaran.</li>
<li>Menjaga kualitas layanan, integritas sistem, keamanan, dan catatan audit.</li>
<li>Memenuhi kewajiban hukum, peraturan, kontrak, dan kepatuhan yang berlaku.</li>
</ul>
<h3>Dasar Hukum Pemrosesan</h3>
<p>Bergantung pada situasinya, pemrosesan dapat didasarkan pada persetujuan, kebutuhan untuk melaksanakan kontrak, pemenuhan kewajiban hukum, atau dasar sah lainnya yang diakui dalam peraturan pelindungan data pribadi yang berlaku di Indonesia.</p>
<p>Apabila persetujuan diperlukan, kami akan memintanya melalui mekanisme yang sesuai. Persetujuan dapat ditarik kembali sesuai ketentuan hukum yang berlaku, tanpa memengaruhi pemrosesan yang sebelumnya telah dilakukan secara sah.</p>
<h2>04 / Bukti Serah Terima dan Data Lokasi</h2>
<p>Proses Bukti Serah Terima VORA dapat mengumpulkan nama, jabatan, nomor telepon, tanda tangan elektronik penerima, foto pengiriman, dan waktu konfirmasi.</p>
<p>Berbagi lokasi bersifat opsional. Apabila penerima memilih untuk membagikan lokasi, koordinatnya dapat disertakan dalam bukti pengiriman.</p>
<p>Catatan tersebut digunakan untuk mendokumentasikan penerimaan dan kondisi barang, mendukung verifikasi operasional, serta membantu menindaklanjuti pertanyaan atau menyelesaikan sengketa terkait pengiriman.</p>
<p>Akses terhadap bukti pengiriman ditujukan untuk dibatasi kepada pihak yang berwenang dan memiliki kebutuhan operasional atau kontraktual yang sah.</p>
<h2>05 / Pembagian Informasi kepada Penyedia Layanan</h2>
<p>Apabila diperlukan untuk layanan terkait, informasi pribadi dapat dibagikan kepada pengangkut, agen freight, pengelola gudang, penyedia layanan terkait kepabeanan, pelanggan atau penerima barang, penyedia teknologi dan infrastruktur, penasihat profesional, serta pihak berwenang yang berkompeten.</p>
<p>Pembagian informasi tersebut harus memiliki tujuan dan dasar hukum yang sesuai. Kami tidak menjual data pribadi kepada pengiklan atau pialang data.</p>
<h2>06 / Transfer Data ke Luar Negeri</h2>
<p>Kegiatan logistik internasional dapat memerlukan pembagian informasi yang relevan kepada pihak di luar Indonesia, termasuk agen logistik di luar negeri, pengangkut, dan penyedia layanan lainnya.</p>
<p>Apabila data pribadi ditransfer ke luar negeri, kami akan menerapkan persyaratan dan pelindungan yang ditetapkan dalam hukum Indonesia yang berlaku.</p>
<h2>07 / Keamanan dan Penyimpanan Data</h2>
<p>Kami menerapkan langkah organisasi dan teknis yang dirancang untuk melindungi informasi dari akses, perubahan, pengungkapan, kehilangan, atau penyalahgunaan tanpa izin.</p>
<p>Informasi pribadi disimpan untuk keperluan yang berkaitan dengan layanan terkait, pelaksanaan kontrak, kepatuhan hukum, akuntansi, audit, penanganan sengketa, dan kebutuhan bisnis lainnya yang sah.</p>
<p>Masa penyimpanan bergantung pada jenis catatan dan ketentuan yang berlaku. Ketika informasi tidak lagi diperlukan, informasi tersebut akan dihapus, dianonimkan, atau ditangani dengan cara lain sesuai hukum yang berlaku dan prosedur penyimpanan yang telah ditetapkan.</p>
<p>Tidak ada sistem elektronik yang dapat menjamin keamanan secara mutlak. Kami meninjau praktik keamanan dan menangani insiden sesuai ketentuan yang berlaku.</p>
<h2>08 / Cookie dan Teknologi Website</h2>
<p>Website kami dapat menggunakan mekanisme teknis yang diperlukan untuk fungsi utama, pengelolaan sesi, keamanan, dan administrasi.</p>
<p>Apabila analitik opsional atau teknologi pelacakan lain yang tidak esensial diperkenalkan, penggunaannya akan disertai pemberitahuan yang sesuai serta mekanisme persetujuan apabila diwajibkan.</p>
<h2>09 / Hak Privasi Anda</h2>
<p>Sesuai ketentuan hukum yang berlaku, setiap individu dapat memiliki hak untuk:</p>
<ul>
<li>Memperoleh informasi mengenai pemrosesan data pribadinya.</li>
<li>Meminta akses terhadap informasi pribadi.</li>
<li>Meminta perbaikan atas informasi yang tidak akurat atau tidak lengkap.</li>
<li>Meminta penghapusan atau penghentian pemrosesan apabila diperbolehkan secara hukum.</li>
<li>Menarik persetujuan apabila pemrosesan didasarkan pada persetujuan.</li>
<li>Menggunakan hak lain yang tersedia berdasarkan peraturan pelindungan data pribadi di Indonesia.</li>
</ul>
<p>Permintaan tertentu dapat memerlukan verifikasi identitas serta tunduk pada kewajiban penyimpanan yang sah atau pengecualian yang berlaku.</p>
<h2>10 / Kontak dan Permintaan Terkait Privasi</h2>
<p>Untuk pertanyaan terkait privasi, permintaan akses atau perbaikan data, maupun kekhawatiran mengenai penanganan informasi pribadi, hubungi:</p>
<p><strong>VORA / PT Satu Arah International</strong><br><a href="mailto:info@voraworld.id">info@voraworld.id</a></p>
<p>Mohon berikan informasi yang memadai agar kami dapat mengidentifikasi catatan terkait dan memproses permintaan Anda dengan aman.</p>
<h2>11 / Pembaruan Pemberitahuan Ini</h2>
<p>Kami dapat memperbarui Pemberitahuan Privasi ini untuk menyesuaikan dengan perubahan layanan, sistem, praktik operasional, atau hukum yang berlaku.</p>
<p>Perubahan penting akan diberitahukan apabila diwajibkan oleh hukum. Versi terbaru yang telah diterbitkan akan tersedia di website ini.</p>
<hr>
<p><strong>VORA</strong><br>Bringing the World Within Reach.</p>`,
  },
  terms: {
    en: `<p><strong>Effective date: 30 October 2026</strong></p>
<p>Welcome to VORA. These Terms of Use govern your access to and use of the website operated by PT Satu Arah International under the VORA brand.</p>
<p>By accessing or using this website, you agree to comply with these Terms of Use to the extent permitted by applicable law.</p>
<hr>
<h2>01 / About VORA</h2>
<p><strong>VORA</strong> is a freight forwarding and logistics brand operated by PT Satu Arah International, based in Jakarta, Indonesia.</p>
<p>Our website provides information about international freight forwarding, domestic distribution, customs coordination, warehousing, project cargo, and related logistics services.</p>
<p>Information displayed on this website is provided for general business and informational purposes.</p>
<h2>02 / Website Information</h2>
<p>We make reasonable efforts to maintain accurate, relevant, and updated website information.</p>
<p>However, descriptions of services, transport coverage, shipping schedules, indicative transit times, and other operational information may change without prior notice.</p>
<p>Website content does not constitute a binding service commitment or guaranteed availability unless expressly confirmed through an authorised quotation or written agreement.</p>
<h2>03 / Requests for Quotation</h2>
<p>Submitting a Request for Quotation (RFQ), inquiry, or contact form does not automatically create a contractual relationship with VORA.</p>
<p>Each request may require further assessment of cargo specifications, origin, destination, routing, transport capacity, regulatory requirements, and commercial feasibility.</p>
<p>A quotation becomes subject to the validity period, scope, payment terms, exclusions, and other conditions expressly stated in the relevant quotation or written agreement.</p>
<p>Services are subject to confirmation and acceptance by the relevant parties.</p>
<h2>04 / Customer Responsibilities</h2>
<p>When submitting an inquiry or using our digital services, you agree to provide information that is accurate, complete, and lawfully supplied.</p>
<p>Where applicable, you are responsible for ensuring that relevant cargo descriptions, dimensions, weights, commodity information, shipping instructions, and supporting documents are correct.</p>
<p>Users must not submit unlawful, misleading, fraudulent, or malicious content through our systems.</p>
<h2>05 / Digital Documents and Verification</h2>
<p>VORA may provide online tools for accessing, submitting, reviewing, or verifying quotations, delivery notes, Proof of Delivery records, invoices, receipts, and other business documents.</p>
<p>Verification links and QR codes allow users to check information recorded within VORA's systems, subject to the relevant document's status and access conditions.</p>
<p>Online verification does not, by itself, constitute a qualified electronic signature, a guarantee against alteration of external document copies, or independent certification by a government authority.</p>
<p>Document validity and evidentiary value remain subject to the applicable agreement and governing law.</p>
<h2>06 / Authorised Access and Security</h2>
<p>Users must not attempt to access restricted systems, administrative functions, private documents, or information belonging to another party without appropriate authorisation.</p>
<p>Unauthorised access, automated abuse, security testing without permission, and interference with website functionality are prohibited.</p>
<p>We may restrict access when reasonably necessary to protect users, systems, business information, or compliance obligations.</p>
<h2>07 / Intellectual Property</h2>
<p>Unless otherwise stated, the VORA name, brand identity, logos, graphics, website design, original text, and other proprietary materials are owned by or used under authorisation of PT Satu Arah International.</p>
<p>These materials may not be copied, redistributed, commercially exploited, or used in a manner suggesting endorsement without appropriate permission, except as allowed by applicable law.</p>
<h2>08 / Third-Party Services and Links</h2>
<p>Our website may refer to external websites, service providers, transport operators, carriers, or logistics partners.</p>
<p>Those parties may operate under separate terms, policies, and regulatory requirements.</p>
<p>VORA does not automatically endorse or assume responsibility for independently operated third-party websites merely because they are linked from our website.</p>
<h2>09 / Service Availability</h2>
<p>We aim to maintain reliable access to our website and digital services, but temporary interruption may occur due to maintenance, technical incidents, third-party infrastructure, or circumstances outside our reasonable control.</p>
<p>We do not guarantee uninterrupted availability or error-free operation of every website function.</p>
<h2>10 / Liability</h2>
<p>To the extent permitted by applicable law, VORA is not responsible for losses arising solely from reliance on general website information without obtaining a specific service confirmation.</p>
<p>Liability connected with actual logistics services shall be determined under the relevant quotation, transport documents, applicable contractual arrangements, and governing law.</p>
<p>Nothing in these Terms of Use excludes or restricts rights or liabilities that cannot lawfully be excluded or restricted.</p>
<h2>11 / Privacy and Personal Data</h2>
<p>Personal information submitted through this website and associated digital processes is handled according to our <a href="/en/privacy">Privacy Notice</a> and applicable Indonesian law.</p>
<p>Users submitting personal information about other individuals must have an appropriate legal basis or authorisation to do so.</p>
<h2>12 / Governing Law and Disputes</h2>
<p>These Terms of Use are governed by the laws of the Republic of Indonesia.</p>
<p>Any dispute connected with website use should first be addressed through good-faith communication between the parties.</p>
<p>Where resolution cannot be reached, applicable legal remedies remain available in accordance with governing law.</p>
<h2>13 / Changes to These Terms</h2>
<p>VORA may update these Terms of Use to reflect changes in website functionality, business practices, legal requirements, or related services.</p>
<p>The revised version will become effective upon publication unless another effective date is stated or applicable law requires otherwise.</p>
<h2>14 / Contact</h2>
<p>Questions regarding these Terms of Use may be addressed to:</p>
<p><strong>PT Satu Arah International</strong><br>VORA Freight &amp; Logistics<br>Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810, Indonesia.</p>
<p>Email: <a href="mailto:info@voraworld.id">info@voraworld.id</a></p>
<hr>
<p><strong>VORA</strong><br>Bringing the World Within Reach.</p>`,
    id: `<p><strong>Tanggal berlaku: 30 Oktober 2026</strong></p>
<p>Selamat datang di VORA. Ketentuan Penggunaan ini mengatur akses dan penggunaan website yang dioperasikan oleh PT Satu Arah International dengan merek VORA.</p>
<p>Dengan mengakses atau menggunakan website ini, Anda setuju untuk mematuhi Ketentuan Penggunaan ini sepanjang diperbolehkan oleh hukum yang berlaku.</p>
<hr>
<h2>01 / Tentang VORA</h2>
<p><strong>VORA</strong> adalah merek layanan freight forwarding dan logistik yang dioperasikan oleh PT Satu Arah International, yang berkedudukan di Jakarta, Indonesia.</p>
<p>Website kami menyediakan informasi tentang freight forwarding internasional, distribusi domestik, koordinasi kepabeanan, pergudangan, project cargo, dan layanan logistik terkait.</p>
<p>Informasi yang ditampilkan di website ini disediakan untuk keperluan informasi dan bisnis secara umum.</p>
<h2>02 / Informasi Website</h2>
<p>Kami melakukan upaya yang wajar untuk menjaga agar informasi di website tetap akurat, relevan, dan mutakhir.</p>
<p>Namun, deskripsi layanan, cakupan transportasi, jadwal pengiriman, perkiraan waktu pengiriman, dan informasi operasional lainnya dapat berubah tanpa pemberitahuan sebelumnya.</p>
<p>Isi website tidak merupakan komitmen layanan yang mengikat atau jaminan ketersediaan, kecuali telah dikonfirmasi secara tegas melalui penawaran resmi atau perjanjian tertulis.</p>
<h2>03 / Permintaan Penawaran</h2>
<p>Pengiriman formulir permintaan penawaran (Request for Quotation atau RFQ), pertanyaan, maupun formulir kontak tidak secara otomatis membentuk hubungan kontraktual dengan VORA.</p>
<p>Setiap permintaan dapat memerlukan penilaian lebih lanjut atas spesifikasi barang, asal, tujuan, rute, kapasitas transportasi, persyaratan peraturan, dan kelayakan komersial.</p>
<p>Penawaran tunduk pada masa berlaku, cakupan, ketentuan pembayaran, pengecualian, dan persyaratan lain yang secara tegas tercantum dalam penawaran terkait atau perjanjian tertulis.</p>
<p>Pelaksanaan layanan memerlukan konfirmasi dan persetujuan dari pihak-pihak terkait.</p>
<h2>04 / Tanggung Jawab Pelanggan</h2>
<p>Saat mengirim pertanyaan atau menggunakan layanan digital kami, Anda setuju untuk memberikan informasi yang akurat, lengkap, dan disampaikan secara sah.</p>
<p>Jika relevan, Anda bertanggung jawab untuk memastikan kebenaran deskripsi barang, dimensi, berat, informasi komoditas, instruksi pengiriman, dan dokumen pendukung.</p>
<p>Pengguna dilarang mengirim konten yang melanggar hukum, menyesatkan, bersifat penipuan, atau berbahaya melalui sistem kami.</p>
<h2>05 / Dokumen Digital dan Verifikasi</h2>
<p>VORA dapat menyediakan sarana daring untuk mengakses, mengirim, meninjau, atau memverifikasi penawaran, surat jalan, catatan Bukti Serah Terima (Proof of Delivery), invoice, kuitansi, dan dokumen bisnis lainnya.</p>
<p>Tautan verifikasi dan kode QR memungkinkan pengguna memeriksa informasi yang tercatat dalam sistem VORA, sesuai status dan ketentuan akses dokumen terkait.</p>
<p>Verifikasi daring itu sendiri tidak merupakan tanda tangan elektronik tersertifikasi, jaminan bahwa salinan dokumen di luar sistem tidak dapat diubah, atau sertifikasi independen dari lembaga pemerintah.</p>
<p>Keabsahan dokumen dan kekuatan pembuktiannya tetap tunduk pada perjanjian serta hukum yang berlaku.</p>
<h2>06 / Kewenangan Akses dan Keamanan</h2>
<p>Pengguna dilarang mencoba mengakses sistem terbatas, fungsi administrasi, dokumen pribadi, atau informasi milik pihak lain tanpa kewenangan yang sesuai.</p>
<p>Akses tanpa izin, penyalahgunaan otomatis, pengujian keamanan tanpa izin, dan gangguan terhadap fungsi website dilarang.</p>
<p>Kami dapat membatasi akses apabila secara wajar diperlukan untuk melindungi pengguna, sistem, informasi bisnis, atau memenuhi kewajiban kepatuhan.</p>
<h2>07 / Kekayaan Intelektual</h2>
<p>Kecuali dinyatakan lain, nama VORA, identitas merek, logo, grafis, desain website, tulisan asli, dan materi milik lainnya dimiliki oleh atau digunakan atas izin PT Satu Arah International.</p>
<p>Materi tersebut tidak boleh disalin, disebarluaskan, dimanfaatkan secara komersial, atau digunakan dengan cara yang memberi kesan adanya dukungan tanpa izin yang sesuai, kecuali diperbolehkan oleh hukum yang berlaku.</p>
<h2>08 / Layanan dan Tautan Pihak Ketiga</h2>
<p>Website kami dapat merujuk ke website eksternal, penyedia layanan, operator transportasi, pengangkut, atau mitra logistik.</p>
<p>Pihak-pihak tersebut dapat menerapkan ketentuan, kebijakan, dan persyaratan peraturan yang berbeda.</p>
<p>Tercantumnya tautan pada website kami tidak secara otomatis berarti VORA mendukung atau bertanggung jawab atas website pihak ketiga yang dikelola secara independen.</p>
<h2>09 / Ketersediaan Layanan</h2>
<p>Kami berupaya menjaga keandalan akses ke website dan layanan digital kami. Namun, gangguan sementara dapat terjadi akibat pemeliharaan, insiden teknis, infrastruktur pihak ketiga, atau keadaan di luar kendali wajar kami.</p>
<p>Kami tidak menjamin ketersediaan tanpa gangguan atau bahwa setiap fungsi website selalu berjalan tanpa kesalahan.</p>
<h2>10 / Tanggung Jawab Hukum</h2>
<p>Sepanjang diperbolehkan oleh hukum yang berlaku, VORA tidak bertanggung jawab atas kerugian yang timbul semata-mata karena mengandalkan informasi umum di website tanpa memperoleh konfirmasi layanan yang spesifik.</p>
<p>Tanggung jawab yang berkaitan dengan layanan logistik yang benar-benar dilaksanakan ditentukan berdasarkan penawaran terkait, dokumen pengangkutan, pengaturan kontrak yang berlaku, serta hukum yang berlaku.</p>
<p>Tidak ada ketentuan dalam Ketentuan Penggunaan ini yang mengesampingkan atau membatasi hak maupun tanggung jawab yang menurut hukum tidak boleh dikesampingkan atau dibatasi.</p>
<h2>11 / Privasi dan Data Pribadi</h2>
<p>Informasi pribadi yang dikirim melalui website ini dan proses digital terkait ditangani sesuai <a href="/id/privacy">Pemberitahuan Privasi</a> kami serta hukum Indonesia yang berlaku.</p>
<p>Pengguna yang mengirim informasi pribadi tentang orang lain harus memiliki dasar hukum atau kewenangan yang sesuai untuk melakukannya.</p>
<h2>12 / Hukum yang Berlaku dan Penyelesaian Sengketa</h2>
<p>Ketentuan Penggunaan ini diatur oleh hukum Republik Indonesia.</p>
<p>Setiap sengketa yang berkaitan dengan penggunaan website terlebih dahulu diupayakan penyelesaiannya melalui komunikasi dengan iktikad baik antara para pihak.</p>
<p>Apabila penyelesaian tidak tercapai, upaya hukum yang berlaku tetap tersedia sesuai ketentuan hukum yang berlaku.</p>
<h2>13 / Perubahan Ketentuan</h2>
<p>VORA dapat memperbarui Ketentuan Penggunaan ini untuk menyesuaikan dengan perubahan fungsi website, praktik bisnis, persyaratan hukum, atau layanan terkait.</p>
<p>Versi yang diperbarui mulai berlaku sejak diterbitkan, kecuali dinyatakan tanggal berlaku yang berbeda atau hukum yang berlaku menentukan lain.</p>
<h2>14 / Kontak</h2>
<p>Pertanyaan mengenai Ketentuan Penggunaan ini dapat disampaikan kepada:</p>
<p><strong>PT Satu Arah International</strong><br>VORA Freight &amp; Logistics<br>Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810, Indonesia.</p>
<p>Email: <a href="mailto:info@voraworld.id">info@voraworld.id</a></p>
<hr>
<p><strong>VORA</strong><br>Bringing the World Within Reach.</p>`,
  },
}
