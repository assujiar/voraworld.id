# VORA Virtual Agent

Website `/en` dan `/id` memiliki VORA Virtual Agent berbasis AI dengan registrasi identitas wajib (nama lengkap, perusahaan, telepon, email) sebelum chat. Kontak dicocokkan secara konservatif dengan CRM, dan ringkasan inquiry dapat dikirim ke Leads berdasarkan persetujuan customer.

### Aktivasi

1. Pastikan Supabase, autentikasi Admin dan konfigurasi Next.js existing sudah berjalan.
2. Terapkan migrasi `0031_vora_agent.sql`, `0032_vora_agent_identity.sql`, `0033_vora_agent_knowledge.sql`, `0034_agent_ai_settings.sql`, `0035_logistics_knowledge_seed.sql`, dan `0036_agent_logistics_special_cargo.sql` **secara berurutan**, hanya migrasi yang belum diterapkan.
3. Buka **Admin → VORA Virtual Agent → AI Settings** (`/admin/agent-settings`). Simpan API key Google Gemini atau OpenAI, pilih model dan aktifkan agent.
4. Uji provider, tanya jawab ID/EN, registrasi customer, inquiry handoff ke Leads, histori dan penghapusan chat.
5. Untuk perubahan knowledge umum atau VORA, gunakan **Admin → VORA Virtual Agent → Knowledge Base** (`/admin/agent-knowledge`). Publish agar artikel dipakai chat. Respons agent tidak menampilkan rujukan atau sitasi.

Panduan setting, Vault, model, SQL seed dan validasi terdapat pada [VORA_AI_PROVIDER_AND_LOGISTICS_SEED.md](VORA_AI_PROVIDER_AND_LOGISTICS_SEED.md).

### Privasi dan biaya

API key disimpan terenkripsi di Supabase Vault, hanya diakses backend. Chat hanya tersedia ketika admin mengaktifkan dan key provider yang dipilih tersimpan. Data kontak registrasi tidak dimasukkan ke prompt model. Histori chat berakhir setelah tujuh hari, sedangkan CRM contact memiliki retensi terpisah. Perlakuan data provider mengikuti kebijakan akun/model yang dipilih. OpenAI API umumnya berbayar. Gemini Free Tier tunduk pada batas model/project, dan tidak ada fallback otomatis ke model lain.

`VORA_AGENT_ENABLED=false` dapat digunakan sebagai pemutus darurat di Vercel jika diperlukan. Semua konfigurasi provider/model/API key normal berada di UI Admin; environment `GEMINI_API_KEY` tidak dipakai.
