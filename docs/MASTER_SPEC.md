# MASTER BUILD PROMPT — VORA | Corporate Website + CMS + Business Admin Portal

@Sites

Anda bertindak sebagai gabungan **principal full-stack engineer, solutions architect, senior UI/UX art director, technical SEO specialist, application security engineer, dan QA lead**. Bangun sebuah **production-oriented, fully functional, multi-page corporate website** untuk **VORA**, brand freight forwarding dan logistics milik **PT Satu Arah International**. Ini **BUKAN landing page, bukan sekadar mockup, bukan prototype Figma, dan bukan kumpulan halaman statis dengan dashboard admin palsu**. Saya ingin satu aplikasi website lengkap dengan public website, dashboard admin aman, persistent database, media storage, SEO, workflow content publishing, lead management, invoice dan receipt management, serta aset kode sumber yang dapat dipindahkan/deploy ulang.

**File yang saya lampirkan sebagai mandatory source of truth:**
1. `VORA_Complete_Brand_Kit.zip` — logo master, brand rules, PDF design system, implementation guide, CSS/JSON design tokens, SVG/PNG, website starter.
2. `ASET_WEB_VORA.zip` — 43 gambar aset PNG/WebP 3D untuk public website. Sebagian file bernama generik `ASET_WEB_VORA (n)`, jadi jangan menyimpulkan jenis gambar hanya dari filename.
3. Opsional: `VORA_Asset_Inventory.csv` — manifest teknis aset, jika ikut dilampirkan.

## 0. Cara bekerja dan definisi selesai

Mulai **langsung membangun aplikasi melalui Sites**, bukan menjawab dengan proposal panjang atau hanya rancangan. Audit seluruh input, tetapkan arsitektur, buat database/migrations, implementasi public pages dan admin pages, jalankan pengujian dan preview, perbaiki isu, lalu serahkan versi review, source archive, serta laporan QA. Simpan versi untuk review **tanpa mem-publish kepada publik** terlebih dahulu. Website harus siap dipublikasikan setelah approval owner.

Jangan mengaku fitur selesai bila hanya tampilan dummy. Setiap form dan setiap tombol inti harus mempunyai alur nyata dan data tersimpan. Bila ada fungsi yang memerlukan akun/secret/API provider eksternal, implementasikan adapters, environment variables, konfigurasi dan fallback yang aman; tandai sebagai `NEEDS_CONFIGURATION`, jangan memalsukan sukses. Jangan mengarang detail legal, kontak, izin, armada, cabang, pelanggan, KPI, SLA, sertifikasi, jaringan kantor, tarif, testimoni, atau proyek VORA. Berikan placeholder yang **jelas non-publik dan mudah diedit lewat admin** untuk informasi yang belum diberikan. Jangan meminta keputusan desain kecil yang bisa ditentukan dari brand kit; kerjakan secara mandiri dengan keputusan profesional.

## 1. Identitas merek dan visual rules — wajib presisi

- Brand: **VORA**. Legal entity (sesuai input pemilik, belum merupakan verifikasi registrasi): **PT Satu Arah International**.
- Tagline tepat: **Bringing the World Within Reach.**
- Brand descriptor: **Freight & Logistics**.
- Primary ink `#101720`; brand red `#B43E31` (brick red, **BUKAN orange/neon**); white `#FFFFFF`; paper `#F7F7F4`; neutrals `#64717C`, `#DCE0E1`, `#E9ECEE`.
- Ikuti `assets/design-tokens.json`, `assets/vora-tokens.css`, `docs/Brand_Rules.md`, dua PDF guideline dan asset audit report. Distribusi visual kira-kira 70% white/paper, 25% ink/neutrals, maksimum 5% brand red.
- **Jangan gambar ulang logo** dan jangan ketik VORA memakai font biasa. Pada surface terang gunakan `assets/logo/vora-primary.svg`, pada surface gelap gunakan `assets/logo/vora-reverse.svg` langsung di atas warna `#101720` **tanpa kotak putih**. Jangan ubah ligature, O negative space, sambungan R-A, dan counterform merah pada A.
- Favicon/app icon **hanya bentuk huruf A dengan aksen merah melengkung**, dari `assets/logo/vora-a-icon-primary.svg` atau varian reverse. **Dilarang menggunakan monogram VO lama**. Logo dan icon tidak diberi efek 3D, bayangan, glow, bentuk tambahan atau recoloring bebas.
- Font headline Inter Display SemiBold, body Inter; gunakan fallback berlisensi/hosted sendiri. Grid desktop 12 kolom; max width 1280px; gutter 24px; mobile padding 20px. Body 16–18px. Mobile-first dan aksesibel.

## 2. Creative direction dan frontend

Saya ingin **premium 3D neumorphism (neuromorphism) + premium claymorphism**, dengan material tactile, refined satin-polymer, ceramic/soft-touch dan depth yang terasa. Gunakan 3D objek dari ZIP sebagai fokus visual secara **selektif**, bukan hiasan yang disebar ke setiap kartu. Tampilan harus kuat, editorial, modern, sophisticated, credible, dan cocok untuk perusahaan forwarding internasional. Bukan desain SaaS template generik, bukan cartoon, bukan brutalism acak, bukan penuh glass blobs, bukan AI slop.

Komposisi **variatif antarhalaman dan antarsection**: asymmetrical split hero, oversize editorial headline, narrow text column + sculptural 3D asset, offset media, sticky service index, image-led narrative, split background, horizontal statistics only if verified, accordion, dense operational details, alternating white/paper/ink surfaces, sophisticated typography, informative footer. Hindari satu pola repetitif `headline + 3 cards` sepanjang website. Gunakan whitespace sengaja, strong visual rhythm, grid alignment, pixel-perfect spacing, motion yang halus dan functional (prefer CSS transforms; respect `prefers-reduced-motion`). Hindari glow merah/neon yang mengubah brand red menjadi oranye.

Semua aset ZIP harus diinventarisasi, di-preview dan diklasifikasikan berdasarkan isi visualnya. Buat file manifest/asset catalog yang memetakan nama file asli -> objek -> section yang tepat -> dimensi -> status transparansi -> prioritas penggunaan. Jangan menduplikasi objek sejenis atau memakai yang rusak/artefak. Pertahankan alpha yang memang asli. Optimasi ke WebP/AVIF responsive bila relevan; simpan original. Logo selalu dari brand kit, **bukan logo yang kebetulan digambar di aset AI**. Jangan menempelkan 3D illustration yang merusak hierarchy atau aksesibilitas.

Quality bar: responsif di 360, 390, 768, 1024, 1440, dan 1920px; navigasi desktop/mobile usable; WCAG 2.2 AA sejauh memungkinkan; keyboard focus jelas, alt text bermakna, semantic HTML, aria hanya bila dibutuhkan; CLS rendah, lazy loading di bawah fold, visual critical path dioptimalkan, skeleton atau loading state tepat; smooth tetapi tidak berat. Usahakan LCP <2.5s, CLS <0.1, INP <200ms pada mobile dalam pengujian realistis, laporkan hasil aktual bukan mengarang.

## 3. Public website: benar-benar multipage

Buat **full corporate website**, minimal:

1. `/` Home: premium hero, value proposition, services pathways, why VORA (bukti hanya jika valid), operation process, scalable network/coverage **tanpa klaim coverage palsu**, featured insights, contact CTA.
2. `/about` Who We Are, perusahaan, filosofi, visi/misi (editorial draft bisa disetujui admin), approach, values, legal company info yang telah disetujui admin. Jangan mengarang tahun berdiri atau penghargaan.
3. `/services` master services index, kategori dan CTA.
4. **Unique detailed pages** untuk `/services/air-freight`, `/services/sea-freight`, `/services/road-transport`, `/services/customs-clearance`, `/services/project-cargo`, `/services/warehousing-3pl`, `/services/distribution`. Masing-masing: layanan, proses, scope, common use cases, opsi yang relevan, FAQ/service-specific, CTA/RFQ. Gunakan konten jelas, bukan klaim kemampuan operasional yang belum diverifikasi.
5. `/solutions` industry/use-case solutions: manufacturing, retail/ecommerce, industrial project, general cargo; bukan klaim sudah melayani perusahaan/industri tertentu.
6. `/network` atau `/coverage`: peta/region fleksibel **hanya dari data serviceability/countries/cities yang ditetapkan admin**. Tidak membuat titik kantor/bendera/route tanpa data.
7. `/insights`, `/insights/[slug]`, category/tag/search/pagination, related posts, author (jika ada), breadcrumbs, share, reading time.
8. `/faq` yang dikelola CMS.
9. `/contact` contact detail, inquiry form yang benar-benar masuk database, consent dan anti-spam, validasi, state sukses/gagal.
10. `/request-quote` structured RFQ untuk service mode, origin/destination, cargo details, equipment/weight/volume, pickup date, contact, remarks, consent; menghasilkan lead dengan tipe `RFQ`.
11. `/verify/[token]` public invoice/receipt QR verification, hanya menampilkan data **minimum** dan status dokumen, tanpa membuka data pribadi/customer dan informasi sensitif. Beri noindex.
12. `/privacy`, `/terms` (status draft bila belum disetujui), accessible 404, maintenance/empty states.

Gunakan bahasa **English profesional natural** sebagai utama dengan **opsi Bahasa Indonesia** yang ditulis dengan baik melalui locale switcher dan field translation CMS. Bila konten translation belum ada, gunakan fallback yang jelas dan jangan membuat halaman berlabel ID namun bercampur bahasa. URL, canonical dan hreflang harus konsisten per bahasa. Konten factual yang belum disediakan harus bersifat editable draft, tidak dikarang menjadi klaim publik.

## 4. Backoffice/admin yang sungguhan

Protected `/admin` dengan login aman, logout, recovery path yang sesuai kemampuan hosting, role-based permissions `superadmin`, `admin/editor`, `sales`, `finance`, `viewer` (minimal tiga role bila pembatasan host). Sediakan seeded akun demo development hanya jika aman dan tidak pernah terekspos di produksi. **Auth dan authorization di SERVER**, bukan sekadar sembunyikan menu client-side. Admin tidak terindeks search engine.

### 4A. Overview dashboard
Real counts dari database: leads baru per periode, source, funnel/pipeline status, contact form conversion yang dapat diukur, artikel draft/published, invoice open/overdue/paid, receipts, recent activity, pending tasks. Filter tanggal. Tidak boleh KPI dummy yang disajikan seolah nyata.

### 4B. CMS + visual page customizer, tanpa edit kode
Sediakan menu `Pages`, `Sections`, `Navigation`, `Footer`, `Media`, `Theme`, `SEO`, `Site Settings`, `Translations`. Admin dapat tambah/edit/hapus/duplikasi page umum, edit page title/slug/SEO, manage sections dan urutan via drag-and-drop, toggle visibility, memilih layout preset editorial, mengubah headline/body/image/CTA, service cards, FAQ, quotes, featured posts, statistics (bila ada source), background mode, layout alignment, border/radius within design system, section spacing presets, nav/dropdowns/footer links, global announcement banner, contact widgets, form labels, sosial links, site icon, legal/address/contact data. Page templates dan reusable blocks berbasis schema; **preview draft > publish > unpublish > revision history > rollback**. Publish tidak harus redeploy kode setiap perubahan CMS. Guardrail design tokens agar identitas VORA tidak berubah sembarang.

Implement **media library** persistent dengan upload PNG/JPG/WebP/AVIF/SVG yang disanitasi, alt text, metadata, categories, storage usage, crop/focal point jika memungkinkan, reuse assets dan replace tanpa broken links. Admin bisa memilih image untuk section dari library. Jangan menyimpan file sebagai base64 dalam SQL.

### 4C. Full article publishing editor
Rich text WYSIWYG layaknya CMS profesional: heading H2–H6, paragraph, bold/italic/underline/strike, links rel/noopener options, list ordered/unordered, table, image insert/upload + alt/caption, blockquote, callout, code block, horizontal rule, alignment dengan batasan, embedded media aman, undo/redo, keyboard shortcuts; **HTML source edit mode** dengan sanitization server-side dan preview hasil render. Editor yang dipakai harus benar-benar menyimpan konten HTML/JSON terstruktur dan aman dari XSS. Post: title, slug, excerpt, cover, category, tags, author, draft/scheduled/published/unpublished, canonical, SEO title/description, OG image, content locale, publish date, SEO score lint sederhana, revision history, duplicate, delete. Scheduled publish hanya bila tersedia mekanisme scheduler nyata; jika tidak, dokumentasikan sebagai butuh konfigurasi.

### 4D. Lead management / lightweight CRM
Contact form dan RFQ masuk DB sebagai lead. Lead list/table dengan search/filter/sort, pipeline `new`, `contacted`, `qualified`, `quotation_sent`, `negotiation`, `won`, `lost`, `archived`; status dan source; priority, assignee, notes, tags, activities, internal comments, follow-up date, attachments, company/contact information, duplicate detection, export CSV, import CSV dengan mapping/preview, bulk actions (role controlled), timeline/audit log. Detail lead bisa dihubungkan ke invoice jika telah menjadi customer. Dashboard chart berbasis data nyata. Notifikasi email hanya bila mail provider/env telah disiapkan; jangan fake email sent.

### 4E. Customers + invoice and receipt management
Buat modul finance **benar-benar berfungsi**, dengan master customer (company/person, billing address, tax identifier optional, email, phone, currency, payment terms). Invoice CRUD: unique document numbering sequence (configurable prefix/year/month), draft/issued/sent/partially-paid/paid/overdue/void, issue date, due date, line item description, unit, quantity, unit price, discount, configurable tax and withholding, subtotal, tax, total, outstanding, IDR default and optional foreign currency, notes, bank account information entered by admin, logo and legal issuer info from Settings. **Jangan hardcode asumsi pajak atau menyamakan invoice komersial dengan e-Faktur.** Invoice preview, export/download print-ready A4 PDF, share/copy verification URL, print; optional outbound email only after configured.

Receipt/payment record CRUD: reference invoice, partial/multiple payments, payment date, method, reference number, amount, currency, note, attachment bukti bayar, receipt unique numbering, issue printable PDF. Receipt hanya bisa diterbitkan untuk payment yang tercatat; edit/void harus menjaga konsistensi outstanding dan audit trail. Preview PDF dan pagination. Invoice payment total tidak boleh melebihi outstanding tanpa explicit handling/refund. Concurrent invoice numbering safe/transactional. Semua nominal dihitung dan dibulatkan server-side dengan integer minor units/decimal-safe arithmetic, **bukan binary floating-point**.

**QR Code Digital Verification:** Pada **SETIAP invoice dan receipt PDF**, QR adalah tautan HTTPS ke `/verify/[opaque-random-token]`, bukan QRIS payment, bukan QR yang sekadar menampilkan nomor dokumen. Token acak sulit ditebak, tersimpan di DB, revocable. Public verification endpoint menampilkan jenis dokumen, nomor, penerbit VORA, tanggal, dan status authentic/void; nilai/identitas customer jangan dibuka secara default. Hindari indeks, brute-force enumeration, dan kebocoran data. Sertakan tombol verify/code check dan contoh PDF yang dapat dites. Jangan mengklaim ini tanda tangan elektronik tersertifikasi atau faktur pajak resmi.

### 4F. Site administration
Manage company name, legal name, tagline (lock branding), full company profile, addresses (multi-location optional), phone/WhatsApp/email, contact person, operational hours, maps link, social links, service catalog, coverage/serviceable regions, policies, footer/legal, email notification settings, SEO global defaults, structured data business info, domain/base URL, robots rules, custom redirects, branding surfaces, social preview, cookie/privacy copy. UI harus menyimpan ke DB dan **langsung mengubah public website setelah publish**, tanpa mengedit source. Audit perubahan dan optional backup/export JSON. Konfigurasi external providers melalui server-side secrets only; UI boleh menampilkan connection status tetapi tidak mengekspos secret.

## 5. Data, architecture dan deployment

Prioritaskan **stack native yang didukung ChatGPT Sites**: TypeScript/React SSR dan routing yang cocok dengan Sites, persistent relational **D1** (jika tersedia), object storage **R2** (jika tersedia), migrations, typed server routes/actions, validated schemas, server-rendered public routes untuk SEO. Bila memilih stack lain, pastikan benar-benar kompatibel dengan Sites dan portable; **jangan memaksakan framework atau database yang tidak didukung runtime**. Pisahkan UI, domain services, persistence/repositories, auth, PDF/QR utilities, SEO, and configuration. Jangan hardcode contents dalam JSX ketika seharusnya berasal dari CMS.

Minimal entity/tabel: `users`, `roles/permissions`, `company_settings`, `site_settings`, `pages`, `page_sections`, `navigation_items`, `media_assets`, `articles`, `article_revisions`, `categories`, `tags`, `article_tags`, `faq`, `services`, `coverage`, `leads`, `lead_activities`, `customers`, `invoices`, `invoice_items`, `payments`, `receipts`, `document_verification_tokens`, `audit_logs`, `seo_redirects`; sesuaikan tabel lain jika dibutuhkan. Foreign key/constraints/indexes, seed minimal aman. Semua data tetap tersedia setelah refresh, logout-login dan redeploy. Backup/export data plan dijelaskan.

Security: hardened sessions with secure HttpOnly cookies, CSRF protection when appropriate, server-side RBAC for every admin mutation and file, Zod/schema validation, HTML sanitize, safe SVG upload handling, file size/type limits, rate limiting/honeypot/captcha optional forms, secret storage, no hardcoded credentials, audit logs, graceful error handling, privacy-aware logging. Terapkan perlindungan data pribadi yang relevan, secure admin, dan noindex admin serta verification pages. Account credentials/private invoices tidak boleh ikut di preview publik.

## 6. SEO end-to-end, AEO, analytics

Implement SSR/indexable HTML untuk seluruh public page dan dynamic blog/service pages. Setiap halaman memiliki unique and editable `title`, `meta description`, canonical, index/follow, OG/Twitter metadata/images, proper heading hierarchy, descriptive internal links, alt text, optimized filenames and image sizes, breadcrumb nav. Sitemap XML dinamis (published public URLs saja), `robots.txt` benar, JSON-LD `Organization`, `WebSite`, `BreadcrumbList`, `Service`, `Article`/`BlogPosting`, `FAQPage` **hanya jika eligible dan kontennya benar-benar visible**. Locale URL and hreflang alternate jika bilingual. 301 redirect manager ketika slug berubah, handle 404/410 appropriately, no duplicate content, no fake ratings/reviews, no auto-generated spam content.

CMS SEO editor: title/description length warnings, missing alt, no H1/multiple H1, reading preview, slug validity, content preview before publish, canonical editor, social share preview, schema validation. Structured data organization contact and address **hanya berdasarkan field company yang telah diverifikasi admin**. Integrasi Google Search Console/GA4/Google Tag Manager opsional via editable IDs setelah user mengisi; consent-aware tracking and privacy. Siapkan humans-readable `SEO_CHECKLIST.md` dan audit report yang membedakan audit sudah dijalankan vs pending akses domain/Search Console.

## 7. End-to-end verification, bukan sekadar screenshot

Lakukan dan dokumentasikan:
1. Build/typecheck/lint/test pass, no syntax/runtime errors, no broken asset/route.
2. Visual screenshots / functional preview: Home, About, Services Index, minimal 2 Service Details, Insights Listing, Article, Contact/RFQ, Admin Dashboard, Article Editor HTML mode, Lead Detail, Invoice Editor/PDF, Receipt PDF, QR Verification, Visual Page Editor, Company Settings. Ambil desktop & mobile representative, uji 360/390/768/1024/1440.
3. Contact/RFQ submission -> DB persisted -> admin sees it -> change pipeline and notes -> persists after refresh.
4. Create article in rich editor, switch to HTML safely, save draft, preview, publish -> appears on public `/insights/[slug]` with metadata/sitemap; undo via unpublish.
5. Admin modifies public phone/address/company profile & saves/publishes -> public header/footer/contact and schema reflect changes without code edits.
6. Create customer -> create multi-item invoice with tax and PDF -> QR opens verification -> record partial payment -> outstanding recalculated -> issue receipt PDF -> QR works -> void/revoke tested.
7. Upload and replace image in media library -> public page displays it without broken asset.
8. Non-admin users cannot access or mutate restricted routes/data; public cannot retrieve lead/customer/invoice records via APIs.
9. Real browsers show no severe console errors/overlap/overflow, keyboard navigation works; performance and SEO checks contain evidence, not made-up scores.

Jika ada proses yang gagal, **perbaiki dan uji ulang** sebelum menyebut complete. Jangan membuat dummy UI atau tombol inert untuk menutup requirement. Tandai setiap bagian secara transparan: `PASS`, `NEEDS_CONFIGURATION`, `BLOCKED`, atau `NOT_IMPLEMENTED`.

## 8. FINAL OUTPUT wajib

**A. Preview:** Sites private staging/preview yang dapat dibuka, beserta ringkasan navigasi dan 12+ representative desktop/mobile screenshots (dapat dalam `previews/`). Jangan deploy public sebelum saya review; bila Sites preview/staging memiliki batasan, jelaskan dan beri versi save yang dapat diperiksa.

**B. Full portable CODEBASE ZIP — `VORA_Website_CMS_Production_Source.zip`:** seluruh application source TypeScript/components/routes, CSS/tokens, logo SVG master dan optimized original image assets yang benar-benar digunakan, full admin UI, backend/api, migrations, schema, seeds aman, unit/integration/e2e tests, config, lockfile, `package.json`, `.env.example` (tanpa credentials), `.openai/hosting.json` bila Sites project menggunakannya, PDF/QR generation, Dockerfile atau deployment instructions yang **sesuai runtime** bila portable, `README.md`, `DEPLOY.md`, `ARCHITECTURE.md`, `CMS_ADMIN_GUIDE.md`, `SEO_CHECKLIST.md`, `QA_REPORT.md`, `ASSET_MANIFEST.csv`, `CHANGELOG.md` dan `KNOWN_LIMITATIONS.md`. **Jangan kemas hanya screenshot, tidak boleh ada folder source kosong, fake exports, placeholder component, atau build yang hanya jalan via preview internal**. Beri ZIP yang benar-benar bisa diunduh; jika platform tidak dapat mengekspor satu ZIP, buat repo/export sumber dan jelaskan pengganti yang benar tanpa klaim file ada.

**C. Operational deployment/readiness:** langkah local install, migration/apply schema, storage bindings, environment secrets, connect domain, preview deploy, public publish, production security checklist, backups, admin setup, mail/analytics setup, optional provider integrations, verified vs pending configuration. Source code harus bisa dibangun kembali tanpa ketergantungan tersembunyi selain documented services.

**D. Acceptance matrix:** daftar tiap halaman dan modul dengan status PASS/NEEDS_CONFIGURATION/BLOCKED; lampirkan hasil test yang bisa diverifikasi (commands dan output ringkas). Cantumkan khusus 1) lead capture, 2) CMS editor + HTML, 3) visual page builder, 4) invoice PDF + QR verify, 5) receipt PDF + QR verify, 6) public settings edits, 7) SEO.

**Definition of done:** website multipage berfungsi penuh, mobile dan desktop premium, setiap modul penting berjalan dengan storage nyata, mudah dikelola tanpa edit kode, tidak ada identitas visual yang melanggar brand kit, source lengkap, preview dapat diuji, dan manual deployment yang jujur. Jika semua requirement terlalu besar dalam satu eksekusi, kerjakan end-to-end secara bertahap **dalam project Sites yang sama**, simpan progress dan lanjut implementasi, namun **jangan menandai pekerjaan final sebelum seluruh acceptance criteria yang core terpenuhi**. Fokus pada produk yang benar-benar bisa dioperasikan, bukan gambar demo.
