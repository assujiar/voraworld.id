# Changelog

Newest first. Entries from `1.0.0` downwards describe the Python/FastAPI application, which is preserved unchanged on the branch `python-v1.0.0`.

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
