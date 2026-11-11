# VORA Virtual Agent: Knowledge Base

## Mengaktifkan

Repository sudah mencakup migrasi `0031` (agent), `0032` (identitas/CRM) dan `0033` (Knowledge Base). Untuk database VORA yang sudah menggunakan `0031` dan `0032`, **jalankan `migrations/0033_vora_agent_knowledge.sql` saja** melalui Supabase SQL Editor. Untuk database baru, jalankan migrasi berurutan atau `SUPABASE_MANUAL_SETUP.sql` (khusus database kosong).

Deployment berikutnya menggunakan source code baru. API key dan model kini diatur melalui **Admin → VORA Virtual Agent → AI Settings**, bukan `GEMINI_API_KEY` di Vercel. Pastikan migrasi 0034 telah dijalankan. Database memanfaatkan Supabase existing, tanpa vector database, embedding API, atau chatbot SaaS tambahan.

**Storage:** file PDF/DOCX diunggah ke bucket **private** `vora-documents` (atau nama bucket yang diatur di konfigurasi aplikasi). Migrasi `0033` memperbarui MIME types bucket default agar mendukung DOCX. Jika proyek memakai nama bucket kustom, izinkan MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document` secara manual pada bucket tersebut. Jika policy/limit Storage berbeda, samakan dengan kebutuhan aplikasi sebelum upload.

## Alur Admin

1. Login ke `/admin` dengan role `admin`, pilih **VORA Virtual Agent → Knowledge Base**.
2. Klik **New knowledge**, pilih kategori dan masukkan judul + konten EN/ID. Minimal satu bahasa harus terisi dengan pasangan judul dan isi. Isi yang dibuat sendiri tidak diterjemahkan otomatis.
3. Opsional: impor PDF/DOCX sampai **4 MB**. Sistem mengekstrak teks dan membuat draft dalam bahasa yang dipilih, lalu menyimpan file asli secara privat. PDF scan tanpa selectable text harus di-OCR dahulu. Tidak ada data dari file yang dipublikasikan otomatis.
4. Tinjau teks, hapus detail customer/kontrak/rate internal, dan pastikan semua klaim VORA telah disetujui. Tambahkan URL rujukan publik jika tersedia.
5. Gunakan panel **Test this draft** untuk menyimulasikan jawaban Gemini dengan teks editor saat ini. Preview membutuhkan API key aktif, menggunakan kuota Gemini, dibatasi per admin, dan tidak membuat lead.
6. Klik **Save working draft**, lalu **Publish article**. Article baru tersedia pada permintaan chat berikutnya, **tanpa redeploy**.
7. Jika artikel yang sudah published diedit, versi lama tetap terbaca publik sampai perubahan disimpan dan tombol **Publish** ditekan. **Unpublish** dan **Archive** menghentikan retrieval segera. **Restore revision** mengembalikan konten ke draft kerja dan harus dipublish kembali.

## Cara kerja retrieval

- Backend memanggil RPC Supabase `agent_search_knowledge` yang hanya memilih potongan teks dari dokumen **published**. Kolom status pada record dan indeks potongan diverifikasi di database, bukan dikendalikan browser.
- Pencarian memakai PostgreSQL full-text search (`simple` untuk istilah EN/ID) dan potongan teks yang overlap. Tidak membutuhkan embeddings berbayar.
- Urutan prioritas: (1) artikel approved dari Admin, (2) FAQ live dari CMS dan konten resmi website, (3) referensi logistics bawaan yang sifatnya edukatif.
- Jika bahasa yang diminta belum diisi, artikel bisa menggunakan konten bahasa lain sebagai fallback; AI tetap diminta menjawab dalam bahasa customer.
- Tidak ada akses AI ke CRM, invoice, quotation, kontak customer lain, dokumen mentah, atau draft Knowledge Base. Pencocokan registrasi agent berlangsung di backend terpisah.
- Akurasi tetap perlu review berkala, terutama regulasi, Incoterms, HS code, DG, carrier, transit time, service coverage, perizinan, kapasitas, dan quotation. Agent dilarang menjanjikan rate/booking/approval aktual tanpa verifikasi.

## Batasan dan operasional

- Upload maksimum 4 MB per file agar berada di bawah batas request Vercel sekitar 4,5 MB. Teks ekstraksi maksimum 80.000 karakter per artikel; pecah manual bila lebih besar.
- Pencarian adalah lexical/full-text, tidak sekuat semantic embeddings pada sinonim dan istilah yang berbeda. Untuk pertanyaan teknis, gunakan judul dan kata kunci yang mencerminkan cara customer bertanya.
- Penambahan/edit artikel tidak menggunakan Gemini untuk training atau fine-tuning. AI membaca potongan pengetahuan saat chat berlangsung.
- Gemini Free Tier memiliki batas yang dapat berubah; ketika kuota habis agent dapat mengalami error. Data yang dikirim ke provider AI perlu mengikuti kebijakan privasi yang sesuai.
- File asli tetap privat dan hanya bisa diunduh oleh admin. Menghapus artikel secara permanen akan menghapus record, history, dan file yang bersangkutan. Jangan mengunggah materi rahasia, PII, atau dokumen yang tidak boleh diproses AI.
- Jika migrasi `0033` belum dijalankan, Admin Knowledge Base gagal dibuka, tetapi chat lama dapat fallback ke sumber bawaan (pesan error muncul di server log). Migrasi harus dijalankan sebelum mengoperasikan editor.

## Validasi deployment

Jalankan `npm ci`, `npm run typecheck`, `npm run build`, dan `npm run test:unit` pada environment yang dapat mengakses npm dan Supabase bila tersedia. Setelah deploy: simpan draft, cek draft tidak muncul di chat publik, publish, coba pertanyaan EN/ID, uji unpublish, lalu verifikasi histori dan download dokumen dengan user non-admin ditolak.
