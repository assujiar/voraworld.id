# Changelog

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
