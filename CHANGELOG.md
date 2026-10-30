# Changelog

Newest first. Entries from `1.0.0` downwards describe the Python/FastAPI application, which is preserved unchanged on the branch `python-v1.0.0`.

## Unreleased

- **Public redesign.** One stylesheet (`public/static/css/vora.css`) replaces the previous public styling and its scripts (`experience.css`, `experience.js`). Typeface: Archivo Variable (self-hosted, width axis). Each page has its own composition: split-line headline on the home page, services as clay tiles with the 3D renders, a list with a stage on `/services`, a layout per service group with its own requirements list (`src/content/service-extras.ts`), journal rows for insights. The hero draws its routes with a Remotion composition (`@remotion/player`, client-only, paused off-screen, one still frame for reduced motion; Remotion may need a company licence, see README). The scroll cue, numbered eyebrows and arrow glyphs are gone. On phones the header holds only the logo and the menu button; the language switch is the last row of the menu.
- **Admin lists show a skeleton.** The heading, notices and filters stay on screen while the table loads behind a Suspense boundary keyed by the filters (`ListLoad` in `AdminPage.tsx`). Notices are not part of the key, so saving does not flash a skeleton.
- **In-page dependent pickers.** New delivery note / New invoice: customer, validated quotation and (for invoices) delivery notes are chosen on one screen. Each list is read through `/admin/api/pickers/*` when the choice above it is made, says it is loading, says why it is empty, and a late answer for an earlier choice is dropped.
- **Real upload progress.** In the portal a chosen file is sent first to `/admin/api/upload` (XHR, bytes counted by the browser) and the form is submitted with a staging token instead of the file; `takeStaged` (in `adminRun`) turns the token back into an ordinary `File`. The button shows the share and size really sent, then "checking and saving" once everything has gone up. A visitor's own upload form (the customer approval page) still posts the file with the form and shows an indicator without a number. Staged files are removed when used and swept after an hour.
- **Email templates.** Each template has a preview made by the server with the same sanitiser as the real message (sample data, unknown variables flagged), the variables of that email as buttons that insert at the cursor, and a "send example to the administrator" action that sends what is in the form, not what was last saved.
- **Autosave of drafts.** Draft articles and pages are saved three seconds after the last keystroke, only while still the version the page loaded (a draft changed elsewhere is not overwritten; the writer is told). Published items are never autosaved; no revision is made per autosave.
- Remotion's Player is started with `numberOfSharedAudioTags={0}`: its default silent audio tags were blocked by the Content Security Policy and filled the console.

- **Seal placement by drag and drop.** On the seal form, the chosen PDF is shown page by page (drawn in the browser with PDF.js; the file is not uploaded for this) and the seal is a box that is dragged onto the page with a mouse or a finger, or moved with the arrow keys (Shift for bigger steps). Corner buttons still snap it. The seal can go on the first page, the last, every page or one page that is chosen. The preview and the sealed PDF place the seal with the same function (`content/seal-layout.ts`), also on rotated pages, and a seal dropped past the edge is pulled back inside the page. Adds `pdfjs-dist` (4.10.38, exact).
- **Phase 4, admin in plain language.** The sidebar follows the work (Sales & Customers, Delivery, Finance, Documents, Website & Content, Settings). The overview shows what needs attention now, each a live count that links to its list: new leads, quotations to validate, delivery notes awaiting proof, unpaid invoices, payments to confirm, receipts awaiting e-meterai, failed emails. Statuses of leads, deliveries, invoices, receipts, documents, approvals and articles read as words (for example *Menunggu E-Meterai*) instead of stored codes, and the activity log names the person, the action and links the record. Validating a quotation and issuing an invoice now ask first, like voiding and confirming funds.
- **Phase 4, public copy.** Rewritten where it used contrast formulas, "from X to Y" slogans or three-part slogans (home, 3PL, domestic distribution, freight forwarding, services, about, how-it-works), in English and Indonesian. `tests/copy.test.ts` reads every public sentence and fails on "more than", "not just", "from X to Y", the listed clichés and their Indonesian equivalents. Service pages no longer end with two call-to-action bands in a row.
- **Agreements (perjanjian) in Documents & Letters.** Three types: Cooperation agreement (`PKS`), Logistics service agreement (`PLL`) and NDA, in Indonesian and English. Each starts from a template of articles (Pasal) that is edited as a table (add, remove, move, edit; up to 40 articles of 3,000 characters), with both parties, background, closing and a signature column per party that carries the document's QR code. Text still in `[isi: ...]` / `[fill in: ...]` brackets blocks issuing. The templates are a starting point, not legal advice: have an agreement reviewed before it is signed.
- **QR seal on PDFs issued by other parties** (document type `seal`, prefix `SEL`). The admin uploads the PDF, chooses the pages, corner and size, previews the placement, and issues it: VORA's seal (QR code, signatory, meaning of the endorsement, time in WIB) is drawn on the chosen pages, whatever their rotation, and the original is never altered. The original and the sealed file are stored privately with their SHA-256; the QR opens a verification page that shows both fingerprints and lets anyone check a file they hold in their own browser (nothing is uploaded). A voided seal withdraws the file and revokes the QR. PDFs that are encrypted, damaged, carry active content, exceed 200 pages or already carry a cryptographic signature (which a seal would break) are refused. No database migration is needed.
- **Phase 4.3, processing feedback.** Every submit button of the portal is now an `AsyncButton`: it names what is running (for example *Menyimpan Customer...*), ignores a second click, keeps its place, names an upload without inventing a percentage, and asks first before voiding, deleting or confirming funds (*Konfirmasi dana sudah diterima?*). Forms keep what was typed after a refusal and say *Perubahan belum disimpan* / *Menyimpan perubahan...* / *Gagal menyimpan perubahan*; a lost connection ends in an honest "the outcome is not certain" message instead of a stuck loader. Notices are toasts. The mail pages show plain-language names for every automatic email and a non-promising status for each outbox job ("accepted by the SMTP server", never "delivered"). Found while building it: `useFormStatus` stays false under this React build, so the pending state comes from the form's own action state.

- **Phase 3A: one commercial workflow with two equal entry points, the customer as the canonical entity** (migration `0026`). Path A: Lead -> Customer -> Quotation. Path B: Customer -> Quotation, never needing or creating a lead. A new quotation requires a customer; the lead is optional; historical lead-only quotations still open, print and approve. Customers gain a contact person (name, position, email, phone), manual creation, a directory search (name, code, email, contact person, phone) and similar-customer detection that never merges silently. Customer page actions: Buat Quotation, Lihat Quotations, Lihat Delivery Notes, Lihat Invoices, Lihat Pembayaran, Lihat Dokumen Terkait.
- **Leads:** the public contact and RFQ forms now ask for a phone / WhatsApp number (validated, stored in `leads.phone`, shown in the admin, exported, included in the admin notification). A lead is converted with Simpan sebagai Customer, Buat Quotation or Simpan sebagai Customer & Buat Quotation: similar customers are shown first, an existing customer can be linked, the lead is kept, and it cannot be converted twice.
- **Quotation states** separate what the customer did from what VORA decided: Draft, Issued, Awaiting customer approval, Approved by customer (to validate), Validated, Rejected: needs correction, Void. An upload is never validation; only the admin's *Validate Quotation* (after checking the signature and stamp by hand) unlocks delivery notes and invoices. Two emails: to the admin when the customer uploads, to the customer when it is validated. Earlier `approved` records become `validated` only where the approval evidence exists.
- **Delivery notes and invoices follow the quotation:** customer -> validated quotation -> prefilled form. An invoice bills one or more delivered notes (`invoice_delivery_notes`), with safeguards against billing across customers or quotations, an unvalidated quotation, the same note twice, the quotation total multiplied by the number of notes, and mixed currencies. Voiding an invoice releases its notes. The invoice PDF shows the quotation and delivery note references and still holds five items per page.
- **One email, two PDFs:** *Kirim Invoice & Pre-Payment Receipt* sends the invoice and its pre-payment receipt together and is refused as a whole if either is not ready (for example while the e-meterai is pending). The outbox now carries several attachments per message (`email_job_attachments`).
- **Payments:** a payment claim reads *Menunggu Konfirmasi Pembayaran* until *Konfirmasi Dana Diterima*; each confirmed payment has its own official receipt, whose email (`VORA | Payment Receipt <number>`, with customer, invoice, amount, date, verify link and PDF) is idempotent, retried, and can be sent again by hand. A mail failure never reverses a payment or a receipt. Every document page shows its related records and mail history.
- **Structured item tables** (add, remove, move, edit; no `|` syntax) for quotations, delivery notes and invoices; the server recalculates every amount in exact decimal arithmetic.
- **Bug found by the browser tests and fixed:** the phone field's `pattern` was not a valid expression under the `v` flag modern browsers apply, so the browser ignored it.
- **Tests:** `tests/commercial.test.ts` (Paths A, B, C and the safeguards against a real PostgREST) and browser specs `finance.spec.ts` (Path B end to end without a lead), `commercial.spec.ts` (Paths A and C), `delivery.spec.ts`, `cms.spec.ts` (phone end to end).

- **Company-red accent on the footer of every generated PDF** (invoice, quotation, receipt, every page): a short red tab on the footer line and a red edge along the foot of the page, answering the red edge under the header band. One shared routine, `Sheet.footer`; the receipt's QR code moved up 2 pt to keep an even margin above the new edge; pixel-level tests.

## 2.0.0 | 2026-10-29 | Rewrite in Next.js / React / TypeScript, single `admin` role

Everything below is described, with evidence, in `QA_REPORT.md`. Nothing has run on a live Vercel, Supabase or SMTP account.

- **One codebase for page and backend.** The FastAPI application was replaced by a Next.js 15 App Router application (React 19, TypeScript strict): Server Components for the public site and the portal, Server Actions for every form, route handlers for PDFs, files, sitemap, robots and the cron dispatcher. No separate API service, no Python at runtime.
- **Same product, same database lineage.** Public site (EN/ID), CMS, leads, customers, bank accounts, quotations with customer approval, invoices (five items per A4 page), payments held pending until Finance confirms cleared funds, receipts with the manual e-meterai workflow, QR verification, custom SMTP with encrypted password, templates, rules, outbox and retry. Migrations `0001`–`0014` are unchanged; Python-written password hashes still verify.
- **One role.** The portal now has a single role, `admin`, with access to every menu (`superadmin` becomes `admin` in migration `0017`; other legacy roles have no access). The sidebar stays grouped into Sales, Finance, Website and System. Consequence: no separation of duties inside the system, documented in `ADMIN_SETUP_GUIDE.md` §2.
- **Every Server Action is guarded** by one wrapper (same origin, signed in, admin role), enforced by a test that reads the source of all actions and executes each one as an anonymous visitor, as every other role value, as a deactivated or stale session, with a forged cookie and from another origin, proving no table changes.
- **Money.** Exact BigInt decimal arithmetic, half-up rounding, 64-bit money columns (migration `0016`; a single invoice above IDR 2.1 billion would have failed before). Business dates are Jakarta dates, including the month inside document numbers and the dates shown in the portal.
- **PDFs** are drawn with `pdf-lib`: invoice paginated five items per page with an overflow summary page, quotation measured onto one page (fails loudly rather than clipping), receipt on one page. Uploaded PDFs (stamped receipts, signed quotations) are inspected for structure, size, page count, active content and the document's own reference numbers, stored privately with a SHA-256 and re-hashed on every read.
- **Start-up check.** `src/instrumentation.ts` refuses to start a production server with a missing database URL, a non-https `PUBLIC_BASE_URL`, a weak or placeholder `SESSION_SECRET`, or a Vercel deployment that is not in production mode. The dashboard shows a setup checklist (presence only, never values).
- **Owner tooling.** `npm run users -- create|reset-password|deactivate|activate|list` (no role option, hidden password prompt or `--password-stdin`, 14-character minimum), `npm run db:migrate` (dry run by default, `--baseline`), `npm run build:setup-sql` for `SUPABASE_MANUAL_SETUP.sql` (checked by a test), `SUPABASE_VERIFICATION.sql` (18 migrations, 64-bit money, admin-only accounts), `.env.example` kept in sync with the code by a test.
- **New since 1.0.0:** reply to a lead by email from the lead page (`lead_reply` rule, off until enabled), migration `0015` (column defaults that the Python ORM used to apply on the client, now enforced by the database), `0018` (aligns three seeded email templates with the code's wording unless an admin already edited them).
- **Bugs found while driving the real UI and the real server, and fixed:** a form control named `id` made `form.id` return the control, so React dropped the clicked submit button (Publish, Issue and Void silently lost their action), now `record`, with a test that forbids such names; `/admin/../../evil` was accepted as a post-sign-in destination; hostile input (NUL bytes, 50,000-character fields, oversized ids) crashed pages or queries; a garbage PDF with a `%PDF-` header returned a 500; the cron endpoint accepted a bare secret without `Bearer `; an email approval link lost its `href` on an `http://` base; a malformed percent-escape in an unrelated cookie turned a PDF request into a 500; a lead logged shortly after midnight in Jakarta got the previous month in its reference; the admin "Coverage" page was hidden from Git by a `coverage/` ignore pattern, so a fresh clone had a dead menu link (found by testing a fresh clone).
- **Tests:** unit and integration suite on PostgreSQL 16 (one throw-away database per file, built only from the migrations), a real `next build` + `next start` HTTP suite with a stand-in for Supabase Storage, and Chromium runs of the finance flow, the CMS flow and 78 admin page loads.
- **Removed:** the Python application (`vora/`, `app/index.py`), its tests and scripts, `requirements*.txt`, `pytest.ini`, `Dockerfile`, `.python-version` and `.vercelignore`. All of it is kept on the branch `python-v1.0.0`.

## 0.1.0 | 2026-10-29 | Local source review release

- Audited supplied brand/source archives; approved logos and A favicon preserved.
- Implemented server-rendered bilingual corporate pages and seven service routes.
- Implemented protected admin login, role-based access and server-side CSRF checks.
- Added database-backed articles, FAQ, pages/sections with published snapshots, leads, verified coverage, navigation and settings.
- Added customer/invoice/payment/receipt database, decimal calculations, PDF generation with official VORA logo and QR public verification.
- Added Supabase PostgreSQL SQL baseline, media storage adapter for configured Supabase, Vercel Python adapter and deployment/admin/SEO guides.
- Completed SQLite HTTP integration test suite and local Chromium in-memory responsive screenshots.
- Fixed a financial balance bug discovered in the reversal test; invoice outstanding now recalculates correctly after voiding a receipt/payment.
- Fixed a collapsed mobile admin menu after visual review, and adjusted PDF logo/legal-name positioning.

No live Sites URL or public deployment has been created. Outstanding requirements remain documented in `KNOWN_LIMITATIONS.md`.

## 0.1.1 | 2026-10-29 | Native cursor refinement

- Removed pointer-position tracking, 3D tilt, pointer-driven hero rotations, and magnetic button transforms.
- Preserved system cursor, subtle conventional hover states, morphing clay surfaces, floating imagery, scroll cues, RFQ live summary, and reduced-motion behavior.
- Updated motion test coverage and cache-busting query strings.

## 0.1.2 | 2026-10-29 | Service artwork containment and video framing

- Fixed the first service card's 3D illustration clipping and visual overlap with heading/body copy.
- Constrained the illustration to a dedicated contained artwork zone, preserving the original transparent VORA asset and the embossed clay stage.
- Added dedicated tablet/mobile composition rather than placing text over the image.
- Updated the stylesheet cache version to invalidate the old layout.
- Regenerated the local motion preview with the full card visible above video controls.
- Added executable Chromium regression checks across seven viewport widths (`scripts/qa_service_art.py`).

### Contact identity update · 2026-10-29
- Set public email to info@voraworld.id and office address to Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810; added PostgreSQL contact migration and verified invoice issuer details.

## 2026-10-29 · PDF public-facing copy refresh

- Removed electronic-signature/tax-invoice disclaimer wording from invoice and receipt PDF footer and public verification page. Document authenticity remains verified using the existing unique QR token and VORA verification endpoint.
- Updated offline prototype invoice/receipt print preview to a neutral internal-review label.
- Regenerated sample PDFs and screenshots; integration tests assert the removed wording does not appear.
- These edits do not confer any certification or change the legal status of issued documents.

## 2026-10-29 · Unified document numbering
- New format `INV/RCP/QUO-VORA-OWNER-YYYYMM-RANDOM5`; RFQ/INQ lead references use the same grammar.
- Stable random customer/lead codes (`C`/`L` + 10 hex); PostgreSQL migration 0005 backfills existing records without rewriting historical invoices or receipts.
- Database-scope locking and unique constraints to reject reused document numbers; fixed-width five-digit suffix uses a secure RNG, not a running counter.
- Added basic quotation persistence, PDF, QR verification, and draft / issue / void UI. Quotation outbound SMTP delivery still needs integration and live tests.
- Prototype offline updated to show the same number syntax, plus an interactive quotation editor/list/issue flow.

## 2026-10-29 — Detailed financial document layout revision
- Compared VORA source-generated invoice/receipt with supplied reference samples; retained the official branded monospace document system.
- Added optional invoice service mode, origin, destination and B/L/AWB transport reference to protected admin form, SQLAlchemy and PostgreSQL migration 0010.
- Enhanced invoice with source-backed shipment metadata, calculated payment terms and explicit percentage-based tax/withholding labels. Invoice pagination still caps item rows at five per physical page.
- Replaced basic receipt PDF generation with a one-page payment reconciliation report containing current balance, individual versus cumulative payment, English IDR words, bank reference and Finance audit information when recorded.
- Added regression tests validating actual fields, 5-item invoice, money wording, payment reconciliation and privacy. All samples use QA-only fictional values.
- Outstanding risk: QR status verification is not sufficient on its own to detect tampering with a copied PDF. See FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md.

## 0.2.0-staging | 2026-10-29 | Vercel + Supabase staging preparation

- Imported the Finance detailed staging source (migrations 0001-0010) unmodified, then fixed hosting compatibility in separate commits.
- `vercel.json` moved off legacy `builds`/`routes`; Python 3.13 pinned; runtime and dev requirements split.
- Database engine is Supabase-pooler safe (no prepared statements) and uses `NullPool` on Vercel.
- Upload ceiling lowered to 4 MB on Vercel (4.5 MB platform limit); startup refuses a non-production `APP_ENV` on Vercel.
- Added migration `0011_enable_rls.sql` (deny Supabase Data API access to all tables) and `scripts/apply_migrations.py`.
- Added `tests/test_deploy_compat.py`. Not deployed.

## 1.0.0 | 2026-10-29 | Production-oriented release candidate

Everything below is described, with evidence, in `QA_REPORT.md`.

- **Security:** Row Level Security on all tables (`0011`); login throttling (`0012`); credential-bound sessions; POST+CSRF logout; no user enumeration by timing; authentication before record lookup on every admin route (route-table test); strict CSP and static caching; new Supabase `sb_secret_` key support; account CLI `scripts/manage_users.py`.
- **Production correctness:** email templates and rules seeded by migration (`0014`; production never ran the dev bootstrap); storage buckets by migration (`0013`); PostgreSQL concurrency tests for numbering and payment confirmation; the PostgreSQL suite runs on a migrations-only database.
- **Admin:** sidebar grouped into collapsible, role-aware categories (Sales, Finance, Website, System); SMTP test email and per-message retry; mobile admin menu fixed; stray mobile header marker fixed.
- **Documents:** invoice states it is a payment request, not proof of payment; clear 409 when a stored receipt fails its integrity check.
- **Localization:** navigation, footer, About, Solutions, Network, FAQ, contact/RFQ forms, legal headings and SEO titles translated to Indonesian; public pages no longer mention the admin portal.
- **Deployment:** zero-config FastAPI `vercel.json` with bundle excludes and a daily mail-retry cron; Python 3.13; runtime/dev requirements split; pooler-safe engine; Vercel upload limits.
- **Deliverables:** `SUPABASE_MANUAL_SETUP.sql`, `SUPABASE_VERIFICATION.sql`, `scripts/apply_migrations.py`, `.env.example`, `VERCEL_SETUP_GUIDE.md`, `SUPABASE_SETUP_GUIDE.md`, `ADMIN_SETUP_GUIDE.md`, `QA_REPORT.md`, `RELEASE_READINESS.md`.
- **Removed from the tree** (all remain in Git history): the source zip, generated QA sample PDFs/PNGs, the unused full-size illustration PNGs, the placeholder `test.md`, and superseded staging notes.
