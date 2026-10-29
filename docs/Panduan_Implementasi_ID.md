# VORA — Panduan Implementasi Brand & Digital Design
**Versi kerja 2.2 | 29 Oktober 2026**  
**Nama brand:** VORA  
**Nama perusahaan (sesuai brief, belum diverifikasi AHU):** PT Satu Arah International  
**Descriptor:** Freight & Logistics  
**Tagline:** Bringing the World Within Reach.

Dokumen ini merupakan panduan implementasi untuk tim web, social media, marketing, sales, vendor kreatif, dan percetakan. Design system ini mengatur **konsistensi visual**, bukan menggantikan pemeriksaan merek, izin usaha, verifikasi klaim layanan, atau persetujuan desain final.

## 1. Prinsip desain
VORA harus terasa **tenang, tegas, presisi, dan kompeten**. Keunikannya datang dari tipografi yang terhubung dan tata letak editorial, bukan ikon logistik generik, efek 3D, atau dekorasi acak. Prioritaskan kejelasan informasi operasional sebelum permainan visual.

- **Khas tanpa ramai:** satu elemen identitas jelas lebih kuat daripada lima ornamen.
- **Editorial tanpa monoton:** gunakan perbandingan ukuran, grid tidak simetris yang terkendali, dan whitespace; jangan menyusun semua seksi dalam kartu berulang.
- **Bukti sebelum klaim:** setiap angka SLA, coverage, jumlah negara, jumlah shipment, rating customer, dan sertifikasi harus punya sumber internal yang bisa diverifikasi.
- **Berfungsi sebelum terlihat keren:** keterbacaan, aksesibilitas, performa website, dan kejelasan CTA adalah syarat utama.

## 2. Arsitektur merek
Gunakan **VORA** sebagai brand utama. Descriptor **Freight & Logistics** dipakai pada konteks yang membutuhkan penjelasan kategori, misalnya company profile, quotation cover, profil sosial, dan halaman awal website. Tagline **Bringing the World Within Reach.** adalah perangkat komunikasi, **bukan bagian permanen dari logotype**.

Nama PT sebaiknya dicantumkan hanya pada legal footer, faktur, kontrak, proposal formal, dan dokumen yang mensyaratkan badan hukum. Sebelum nama tersebut muncul dalam dokumen legal yang diterbitkan, pastikan nama perseroan sudah disetujui di AHU dan nomor perizinan perusahaan benar.

## 3. Sistem logo
- **Master:** `assets/logo/vora-primary.svg`. Ini satu-satunya logo utama untuk latar putih/terang.
- **Reverse:** `assets/logo/vora-reverse.svg`, untuk bidang #101720 atau bidang gelap yang homogen.
- **Monochrome:** `vora-monochrome.svg` atau `vora-one-color-white.svg` saat produksi cetak satu warna.
- **Logogram:** `vora-a-icon-primary.svg` untuk favicon, aplikasi, avatar yang terlalu kecil untuk wordmark, dan penanda sekunder. Jangan mengganti wordmark penuh dengan icon A di materi perkenalan perusahaan.
- **Aksen:** bentuk merah di ruang kosong huruf A, **bukan segitiga tambahan yang dipasang di luar logotype**. Bentuk dan ukuran aksen tidak boleh diubah secara bebas.
- **Clear space:** minimal **0,5 kali tinggi visual huruf O** di keempat sisi.
- **Ukuran minimum awal:** wordmark 120 px pada web atau 25 mm pada cetak; icon A minimal 32 px digital (ukuran 16 px harus diuji keterbacaan). Ini adalah nilai awal, uji keterbacaan pada media aktual.

**Dilarang:** mengetik VORA menggunakan font biasa untuk menggantikan logo; meregangkan; mengubah jarak bagian ligature; mengubah posisi aksen; menambah panah, kapal, kontainer, atau globe; membuat gradient/emboss/shadow di dalam logo; menaruh logo langsung di atas foto yang ramai.

**Catatan produksi penting:** SVG dalam kit ini merupakan **hasil rekonstruksi/tracing dari gambar final yang dipilih**, belum merupakan master kurva Bezier yang digambar manual dan disetujui desainer. Lakukan audit anchor/path dan export proof sebelum signage permanen atau pendaftaran merek.


### 3.1 Logo master yang DISETUJUI (koreksi wajib)

**Referensi tunggal:** `assets/logo/VORA_APPROVED_REFERENCE.png` (gambar yang disetujui), direkonstruksi untuk produksi di `assets/logo/vora-primary.svg` dan `vora-reverse.svg`.

- **Logo normal / latar terang:** seluruh badan huruf VORA memakai `#101720`, sedangkan aksen di rongga huruf **A** memakai `#B43E31`.
- **Logo reversed / latar gelap:** seluruh badan huruf VORA berubah menjadi **putih `#FFFFFF`**, tetapi bentuk, warna, ukuran, dan posisi aksen merah **TIDAK BERUBAH**.
- **Anatomi aksen:** satu bidang merah berbentuk segitiga tegak dengan **alas cekung melengkung**. Bentuk ini berada di **ruang kosong/negative space bagian dalam A**, terpisah dari dua sisi gelap/putih huruf A oleh jarak kosong yang tetap.
- **Dilarang:** memindahkannya ke puncak luar A; menjadikan warna merah sebagai bagian ujung/atap stroke A; mengubahnya menjadi segitiga penuh dengan alas datar; mengecilkan aksen; mengubah lengkungan alas; menambah garis/bentuk merah lain.
- **Kesamaan aset:** dua versi utama adalah satu geometri identik, hanya warna badan wordmark yang beralih dari ink ke putih. Jangan redraw dengan karakter font, jangan membuat versi dark baru dengan AI image generation.

**Urutan prioritas master:** gambar referensi disetujui > file master SVG hasil tracing > layout mockup dan contoh visual. Jika terlihat bertentangan, gambar referensi yang berlaku.

## 4. Palet warna
| Token | Hex | Penggunaan |
|---|---|---|
| Ink / Primary | `#101720` | Logo utama, heading, teks, tombol utama, background gelap |
| Signature Red | `#B43E31` | Aksen A, garis penanda, focus ring, highlight terbatas |
| White | `#FFFFFF` | Canvas utama, halaman, reverse contrast |
| Warm Paper | `#F7F7F4` | Alternatif background seksi, card area |
| Soft Warm | `#EEECE7` | Bidang sekunder warm/neutral |
| Slate | `#64717C` | Metadata dan supporting text (pastikan kontras) |
| Line | `#DCE0E1` | Divider, border, tabel |
| Deep Ink | `#0B1219` | Dark hero, footer, presentasi |

Komposisi visual awal: **±70% White/Paper, ±25% Ink/Neutral, maksimal ±5% Signature Red**. Ini prinsip art direction, bukan rumus matematis wajib. Jangan pakai merah sebagai warna paragraf kecil di background gelap. Aksen tidak perlu muncul di setiap komponen.

**Percetakan:** gunakan proof dari mesin dan profil ICC vendor. Hindari menyatakan nilai CMYK tertentu sebagai standar universal sebelum output proof disetujui.

## 5. Tipografi & hirarki
Font sistem: **Inter Display** untuk headline, **Inter** untuk body dan UI, fallback Arial/sans-serif. File font tidak disertakan dalam kit.

| Jenis | Ukuran web | Berat | Line height |
|---|---|---|---|
| Display hero | `clamp(52px, 7vw, 108px)` | 600 | 0.98–1.05 |
| H1 | `clamp(42px, 5vw, 80px)` | 600 | 1.03–1.10 |
| H2 | `clamp(32px, 3.4vw, 58px)` | 600 | 1.08–1.15 |
| H3 | `clamp(24px, 2vw, 36px)` | 600 | 1.20–1.28 |
| Body | 16–18 px | 400–500 | 1.55–1.70 |
| Label | 11–13 px | 600–700 | 1.20–1.40 |

Headline boleh memakai tracking negatif sekitar `-0.03em` sampai `-0.05em`. Body tracking normal. All-caps hanya untuk label singkat, bukan paragraf. Jangan memaksakan tiap judul menjadi tiga baris dengan susunan yang sama pada semua halaman.

## 6. Grid dan spacing website
- Container maksimum: **1280 px**; desktop **12 kolom**, gutter **24 px**; mobile **4 kolom**, gutter **16 px**.
- Padding halaman: **64 px** desktop (adaptif) dan **20 px** mobile.
- Skala jarak: **4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px**.
- Jarak antar section: **64–128 px** desktop dan **48–72 px** mobile tergantung kepadatan isi.
- Card: border 1 px `#DCE0E1`, radius 10 px. Gunakan secukupnya; halaman tidak boleh berubah menjadi tumpukan kartu seragam.

**Pola layout editorial yang direkomendasikan:** Hero 5/12 teks + 7/12 visual, selingi section penuh foto atau tipografi besar, daftar layanan dengan susunan campuran, case-study dua kolom, kemudian CTA sederhana. Setiap section punya fungsi informasi yang jelas; variasi layout mengikuti konten, bukan sekadar ingin terlihat berbeda.

## 7. Komponen digital
**CTA:** tinggi minimal 48 px, radius 6 px. Primary: ink + white. Secondary: white/transparent + border ink. Fokus keyboard: outline merah 3 px offset 3 px. Hover harus cukup kontras; hindari animasi melenting atau tombol bercahaya.

**Form quote:** kumpulkan hanya data yang perlu untuk kalkulasi awal: kontak perusahaan; origin/destination; mode; commodity; gross weight/dimensi/CBM; jumlah package; incoterms bila relevan; ready date; serta kebutuhan customs/delivery. Tampilkan field dinamis sesuai mode. Jangan meminta dokumen sensitif terlalu dini.

**Rate/quotation table:** tampilkan asal, tujuan, jenis layanan, unit rate, minimum, validity, local charges, exclusions, transit-time estimate bila ada, serta syarat perdagangan dan pembayaran. Tidak boleh menyembunyikan biaya penting di tooltip.

**Status:** setiap status harus memiliki teks seperti `In transit`, `Pending documents`, atau `Completed`. Warna bukan satu-satunya indikator. Gunakan loading, empty, error, dan success states yang informatif.

**Motion:** micro 160 ms, standar 240 ms, maksimal 420 ms untuk reveal besar. Animasi harus menyampaikan hubungan konten, bukan terus-menerus bergerak. Hormati `prefers-reduced-motion`.

## 8. Struktur website VORA
1. **Home:** brand promise, problem/solution, ringkasan layanan, cara kerja, bukti terverifikasi, CTA quote.
2. **Solutions:** International Freight, Domestic Distribution, Customs, Warehousing & 3PL (tampilkan hanya layanan yang benar-benar dapat dipenuhi).
3. **Industries:** buat jika ada bukti kapabilitas atau case study relevan, bukan halaman kosong berisi jargon.
4. **About:** filosofi, model layanan, tim dan governance operasional, informasi legal yang sudah sah.
5. **Insights:** konten edukasi, explainer proses, ketentuan regulasi dengan tanggal sumber.
6. **Contact / Get a Quote:** form ringkas, kontak resmi, kebutuhan RFQ, persetujuan privasi.

**Beranda harus berfungsi sebagai alat penjualan**, bukan sekadar company profile digital. Pengunjung harus cepat memahami apa yang dapat ditangani VORA, bagaimana memulai RFQ, dan alasan memilihnya, tanpa klaim yang mengada-ada.

## 9. Photography, video, dan ilustrasi
Gunakan foto operasional aktual yang memiliki izin: handling cargo, equipment, port/airport, warehouse, truck, tim profesional, dokumentasi proses. Hindari foto stok generik jabat tangan, globe transparan, jalur merah yang mengelilingi dunia, kapal fantasi, dan AI-generated facilities yang seolah-olah benar-benar dimiliki perusahaan.

Crop boleh editorial dan asimetris. Jangan beri overlay biru berat pada semua foto. Gunakan gambar detail proses untuk membuat ritme visual, selingi dengan foto skala besar agar tidak monoton.

**Motion/video:** identitas dibuka dengan logotype asli, gunakan morphing/masing yang mempertahankan geometri logo, variasikan ritme teks, dan buat transisi natural. Logo tidak perlu selalu muncul. Jangan buat voice-over berulang memakai formula kalimat yang sama antarvideo. Video brand boleh 16:9; turunan sosial 9:16 dan 4:5 harus direframe, bukan sekadar crop otomatis.

## 10. Sistem konten digital
**Ukuran:** Instagram feed prioritas **1080×1350**; square **1080×1080**; story/reel **1080×1920**; presentasi **1920×1080**; capability sheet A4.

Setiap materi sebaiknya punya **satu headline jelas, satu informasi/bukti yang berguna, satu tindakan**, dengan logo yang proporsional. Jangan memaksakan seluruh konten menjadi poster dengan angka besar dan logo di tengah.

Contoh pilar editorial awal (bukan kewajiban tetap): **40% edukasi/proof**, **30% layanan/solusi**, **20% people/process**, **10% kampanye**.

**Contoh headline yang aman sebagai konsep:** “Closer to new markets.” / “Know what moves your cargo.” / “Clarity before departure.” Hindari klaim “fastest”, “global leader”, “guaranteed delivery” tanpa bukti sah.

## 11. Materi promosi dan penjualan
- **Company profile:** tentang VORA, cakupan jasa aktual, proses, diferensiasi terverifikasi, contoh kasus yang diizinkan, kontak.
- **Quotation:** service & lane paling menonjol; breakdown rate yang transparan; currency, validity, inclusions, exclusions, surcharge, tax, payment term, cargo assumptions, catatan SLA/transit bila tersedia.
- **One-pager:** maksimal satu proposisi, kelompok layanan inti, bukti pendukung, satu CTA.
- **Proposal:** satu pesan utama per slide, angka diberi sumber/periode, diagram hanya untuk menyederhanakan sesuatu yang benar-benar kompleks.
- **Physical collateral:** business card, letterhead, signage, stiker, vehicle branding gunakan master logo, toleransi clear space, dan proof warna.

## 12. Governance dan QA sebelum tayang
**Approvals:** (1) pemilik brand memvalidasi positioning & bahasa, (2) design lead memeriksa bentuk/spacing/warna, (3) operations memastikan klaim layanan & SLA, (4) legal/compliance memeriksa merek, perizinan, hak foto, dan informasi pribadi, (5) developer mengecek responsivitas/aksesibilitas.

Checklist release:
- [ ] Gunakan SVG master, tidak membuat ulang logo dengan font.
- [ ] Warna utama dan aksen sesuai tokens.
- [ ] Tidak ada logo distorsi, gradient, atau aksen mengambang.
- [ ] Tidak ada angka atau klaim layanan yang belum dibuktikan.
- [ ] Tampilan diuji pada lebar 375, 768, dan 1440 px.
- [ ] Heading, formulir, fokus keyboard, dan text contrast terbaca.
- [ ] Foto punya izin, metadata dan credit tercatat bila diperlukan.
- [ ] Domain, email, nomor telepon, dan legal footer sudah diperiksa.
- [ ] Semua CTA mengarah ke fungsi yang aktif, bukan halaman kosong.
- [ ] File final tersimpan sebagai editable master + export resmi.

## 13. Berkas implementasi di ZIP
- `docs/VORA_Brand_Design_System.pdf`: panduan visual 20 halaman.
- `assets/logo/`: full logo, logogram A, reverse, monochrome, counterform aksen.
- `assets/templates/`: materi sosial, story, cover presentasi, A4 sales sheet, app icon.
- `assets/design-tokens.json` dan `assets/vora-tokens.css`: sumber parameter digital.
- `web/VORA_Web_Starter.html`: contoh layout responsive berbasis tokens. **Prototype, bukan situs siap online**; ganti semua placeholder dan tautan kontak sebelum dipakai publik.

**Status:** identitas visual kerja final siap dipakai sebagai fondasi desain. SVG logo hasil tracing masih memerlukan finalisasi kurva dan persetujuan khusus sebelum pengadaan signage permanen, filing merek, atau registrasi logo resmi.


## 14. Icon resmi VORA (revisi final)

Referensi gambar icon **disetujui**: `VORA_A_ICON_MASTER_PREVIEW.png`. Seluruh favicon, app icon, avatar sosial, dan contoh materi berukuran kecil harus menggunakan bentuk **A melengkung beraksen merah** tersebut, bukan simbol VO yang pernah dipakai pada versi terdahulu.

- **Light:** `vora-a-icon-primary.svg` (badan #101720, aksen #B43E31) pada bidang terang.
- **Dark:** `vora-a-icon-reverse.svg` (badan putih, aksen #B43E31) pada bidang gelap.
- **Monochrome:** kedua elemen satu warna hanya untuk keterbatasan produksi.
- **Master logotype:** tetap bentuk VORA ligature dengan red counterform di dalam huruf A, tidak ada perubahan huruf atau posisi aksen.
- Favicon/ikon aplikasi dibuat dari simbol A langsung. Jangan mengganti icon dengan VO, kap merah melayang, segitiga terpisah, atau logo penuh yang diperkecil hingga tidak terbaca.
- **Status produksi:** hasil vektor merupakan tracing yang mengikuti gambar referensi; kurva dan anchor harus diaudit sebelum registrasi merek dan produksi permanen.





### Icon master hasil audit
Icon A yang digunakan dalam seluruh aset dirancang ulang sebagai geometri vektor simetris: kedua sisi A dan aksen merah berbagi satu sumbu tengah; bentuk dasar aksen melengkung tetap dipertahankan. Gunakan `assets/logo/vora-a-icon-primary.svg` / `vora-a-icon-reverse.svg` sebagai **satu-satunya sumber** untuk turunan digital. Logo VORA penuh tidak diubah. Warna #101720 dan #B43E31.
