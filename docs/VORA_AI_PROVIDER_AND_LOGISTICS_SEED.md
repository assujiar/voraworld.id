# VORA Virtual Agent: AI Settings dan Logistics Knowledge

## Aktivasi di website existing

1. Deploy source code ini ke Next.js/Vercel dengan konfigurasi Supabase existing yang sudah berfungsi. `GEMINI_API_KEY`, `OPENAI_API_KEY` dan `VORA_AGENT_MODEL` **tidak digunakan** lagi. `VORA_AGENT_ENABLED=false` tetap dapat dipakai sebagai emergency kill switch, jika diperlukan.
2. Pada Supabase existing, jalankan **`migrations/0034_agent_ai_settings.sql`** di SQL Editor. Migrasi ini mengaktifkan Supabase Vault dan menambah tabel `agent_ai_config` serta `agent_ai_credentials` dengan RLS. Fungsi untuk menyimpan dan membaca kredensial hanya boleh dieksekusi oleh service role server VORA.
3. Jalankan **`migrations/0035_logistics_knowledge_seed.sql`** di SQL Editor untuk menambahkan **35 artikel bilingual EN/ID**, langsung `published`. Jika ingin SQL standalone, gunakan `docs/VORA_LOGISTICS_KNOWLEDGE_SEED.sql`, isinya sama dengan migrasi 0035. Jangan menjalankan kedua file sebagai dua dataset berbeda; walau idempotent, cukup jalankan salah satunya. Migrasi 0035 membutuhkan 0033 dan 0034.
4. Buka **Admin → VORA Virtual Agent → AI Settings** di `/admin/agent-settings`. Pilih Google Gemini atau OpenAI, tempel API key, pilih model, aktifkan chat, lalu klik **Save AI configuration**.
5. Setelah disimpan, gunakan **Fetch available models** untuk melihat model text-generation yang tersedia pada API key tersebut. Pilih model yang benar-benar tersedia, simpan, lalu gunakan **Test saved key & model**. Test memakai API provider dan bisa menggunakan kuota/biaya menurut paket masing-masing.
6. Buka **Admin → VORA Virtual Agent → Knowledge Base** untuk melihat/edit artikel seed. Publish versi yang diedit agar perubahan digunakan agent. Lakukan uji pertanyaan pada chat publik EN/ID dan pastikan tidak ada rujukan/sitasi dalam respons.

Jika migrasi 0031–0033 belum pernah diterapkan, jalankan semuanya berurutan mulai dari 0031. `SUPABASE_MANUAL_SETUP.sql` diperuntukkan untuk **proyek Supabase benar-benar baru**, bukan database VORA existing.

## Perlindungan API key

- Kunci rahasia terenkripsi menggunakan **Supabase Vault**, bukan ditaruh di kolom teks, browser, React state dari server, atau `NEXT_PUBLIC_` environment.
- Admin hanya melihat status key dan **empat karakter terakhir** untuk identifikasi. Key lengkap tidak pernah ditampilkan lagi dalam UI.
- Permintaan ke API Gemini/OpenAI terjadi langsung dari backend Next.js. Chat customer tidak menerima key.
- Perubahan credential/configuration membutuhkan session Admin aktif dan same-origin request. Fungsi Vault hanya diberi izin `service_role` untuk server.
- Setelah model diganti, request baru menggunakan model yang baru. Tidak ada pergantian otomatis ke model lain bila terjadi quota/error.
- **Model dari OpenAI API secara umum dikenakan biaya**, sedangkan paket dan batas free tier Gemini bergantung pada model dan Google project. Periksa billing/quota provider sebelum mengaktifkan.
- Jika key bocor di luar aplikasi, lakukan rotasi juga di dashboard provider. Vault mengenkripsi penyimpanan, tetapi tidak menggantikan rotasi credential dan proteksi akses Admin.

## Knowledge base dan validitas

- Seed berisi pengetahuan umum tentang: Incoterms® 2020, FCA/FOB/CIF/CIP/DAP/DPU/DDP, FCL/LCL, AWB/B/L, Packing List, VGM SOLAS, IMDG/IATA dangerous goods, lithium battery handling, OOG, breakbulk, heavy-lift, cargo securing, HS classification, lartas, customs valuation, demurrage/detention, 3PL, reefer, route survey, RFQ dan komunikasi customer.
- Materi ditulis dalam bahasa Inggris dan Indonesia. `source_url` menyimpan tautan badan otoritatif (ICC, IMO, IATA, WCO, FIATA) hanya untuk review internal; **agent tidak menampilkan sumber atau sitasi ke customer**.
- Konten membedakan standar industri dari layanan yang benar-benar tersedia di VORA. Pengetahuan umum tidak boleh digunakan untuk mengklaim VORA memiliki izin, armada, kapal, gudang, rate, carrier agreement atau approval tertentu.
- Draft tidak dibaca agent. SQL seed hanya mengisi artikel baru berdasarkan `seed_key`, sehingga menjalankan ulang tidak mengubah artikel yang sudah diedit Admin.
- Pencarian `agent_search_knowledge` mengambil potongan artikel published tanpa membuat embedding API/vector database. Untuk pertanyaan panjang atau ambigu, informasi umum perlu direview agar agent tidak menyimpulkan data yang tidak ada.
- Regulasi, biaya dan acceptance bisa berubah. IMDG Amendment 42-24 mulai wajib pada 1 Januari 2026; IATA DGR yang relevan pada 2026 adalah edisi ke-67; Incoterms® 2020 merupakan edisi terkini hingga November 2026. Sebelum membuat komitmen operasional, tim harus mengecek versi dan aturan terbaru.
- **Seed SQL tidak menjamin jawaban AI selalu benar.** System prompt dan filter respons mengurangi risiko, sementara keputusan kepabeanan/teknis/komersial tetap harus melewati verifikasi manusia.

## Pengujian sebelum production

Jalankan `npm ci`, `npm run typecheck`, `npm run test:unit` dan `npm run build` dalam environment dengan akses registry. Dengan Supabase dan API key asli, lakukan tes untuk: pergantian provider, key invalid, key revoked, quota 429, model yang tidak punya akses, penghapusan key aktif, prompt injection, draft artikel tidak tampil, seed publish, sumber tersembunyi, EN/ID, registrasi wajib, dedup kontak, serta mobile UI.

Untuk migrasi yang dieksekusi langsung lewat SQL Editor, catat file yang sudah dijalankan pada tabel `schema_migrations` sesuai checksum berkas agar `db:migrate` tidak mencoba menerapkannya ulang; migrasi runner `npm run db:migrate -- --apply` otomatis melakukannya. Jangan mencatat migrasi sebagai applied sebelum SQL berhasil.
