# VORA QA & Acceptance Report

**Build:** 0.1.0 source review release  
**Date:** 29 October 2026  
**Environment:** local Python 3.13, SQLAlchemy/SQLite ephemeral test DB, FastAPI TestClient; Chromium offline/in-memory HTML renders; ReportLab-generated A4 PDF.  
**Public deployment:** NONE. No production data used.  
**Verdict:** LOCAL CORE TESTS PASS; PRODUCTION / SITES ACCEPTANCE NOT MET.

## Actual test commands and results

```text
$ pytest tests/test_e2e.py -q --disable-warnings --maxfail=1
..                                                                       [100%]
$ python -m compileall -q vora
COMPILE PASS
$ python /tmp/vora-browser-qa-offline.py  # local QA harness, not in release
Rendered 38 screenshots; issues: 0
$ python /tmp/vora-additional-qa.py      # local QA harness, not in release
Checked 24 responsive combinations / issues 0
```

`previews/BROWSER_QA_RESULTS.json` contains page-by-page Chromium layout results for 19 routes at 1440px and 390px. `previews/RESPONSIVE_MATRIX.json` contains 24 combinations of Home, Services, Admin Dashboard, Invoice at widths 360, 390, 768, 1024, 1440 and 1920px. These are **real browser layout renders fed HTML/CSS/image bytes directly**, NOT live HTTP navigation: network security blocked Chromium access to localhost. No synthetic performance scores are reported.

`previews/qa-invoice.pdf` and `qa-receipt.pdf` are **real generated PDF files** from QA-only local records; they have one A4 page each, the unchanged approved SVG-derived VORA logo and QR verification URL. Their QR URLs point to a **nonpublic local QA base URL**, not a real public verification service. `previews/*-pdf-preview.png` are their rendered pages.

## Acceptance matrix

| Page/feature | Status | Actual local evidence / gap |
| --- | --- | --- |
| `/en/`, `/id/` Home | PASS local | HTTP 200 and desktop/mobile render, brand assets loaded |
| `/about`, `/services`, all 7 service details | PASS local | public routes 200, distinct service copy and artwork; not all content admin-editable |
| `/solutions`, `/network` | PASS local | renders; coverage only shows explicitly enabled DB regions |
| `/insights`, published `/insights/[slug]` | PASS local | create/publish/unpublish article integration and sitemap update |
| `/faq`, `/contact`, `/request-quote` | PASS local | pages 200; RFQ submitted with CSRF, persisted to SQL and visible to admin |
| `/privacy`, `/terms` | NEEDS_CONFIGURATION | blank policy fields are noindex until owner approves copy |
| `/verify/[token]` | PASS local | genuine DB token lookup, minimum metadata only, revoked receipt displays VOID |
| Admin login/logout | PASS local | hashed credentials, server-side signed cookies, CSRF |
| Server-side roles and protected data | PASS local | unauthenticated 401; viewer 403 for restricted reads/mutations |
| Admin overview | PASS local | counts from SQL, test leads/invoices visible; no invented activity figures |
| Lead management | PARTIAL | RFQ→DB→pipeline/note persisted, search/filter/export; no import/bulk/attachments |
| Customers | PARTIAL | create tested via HTTP; read/update endpoints implemented but not exercised in integration tests; no dedicated delete workflow |
| Article editor / HTML mode | PARTIAL | WYSIWYG basic controls and HTML source; sanitized, revision history. Advanced table/embeds/scheduling missing |
| Visual page builder | PARTIAL | page create, sections, draft/publish isolation, revision restore actions, reorder buttons. Drag/drop and comprehensive theme/translation editing missing |
| Global contact settings | PASS local | admin changed email/address; public contact output updated without source change |
| Media library | PARTIAL | real PNG upload to local filesystem + SQL row persisted, public fetch; remote Supabase upload not run; SVG/crop/replacement missing |
| Coverage/Nav/FAQ | PASS local | DB CRUD endpoints implemented; preview render checked, not every mutation E2E-tested |
| Invoice calculations | PASS local | two items: subtotal IDR 2,500,000, discount IDR 50,000, tax 11%, withholding 2% = total IDR 2,670,500 |
| Invoice PDF + QR | PASS local | `%PDF` bytes and actual rendered A4; local verification link authentic |
| Partial payment | PASS local | IDR 500,000 paid → outstanding IDR 2,170,500; overpayment rejected 422 |
| Receipt PDF + QR | PASS local | receipt issued for recorded payment, PDF bytes present; token verifies authentic |
| Void/reverse payment | PASS local | receipt token becomes VOID; payment void, outstanding resets to IDR 2,670,500; regression fixed |
| Concurrent number sequences | NEEDS_CONFIGURATION | PostgreSQL row/advisory locking implemented, but concurrency not tested against real Supabase PostgreSQL |
| SEO dynamic sitemap and robots | PASS local | published article included/unpublished removed; robots disallow admin and verify |
| Advanced technical SEO / multilingual | PARTIAL | canonical/metadata/Organization JSON-LD present; Service/Article schema, full translations, rich OG and live Search Console checks missing |
| Responsive and browser screenshots | PASS for static render only | 38 screenshots + 24 width checks; zero horizontal overflow/broken images in sampled routes |
| Live browser navigation and console | BLOCKED | Browser administrative network policy blocked requests to 127.0.0.1 and localhost; not a live E2E flow |
| Private ChatGPT Sites staging URL | BLOCKED | no Sites runtime/project creation tool connected to this session |
| Supabase PostgreSQL/Storage, Vercel deployment | NEEDS_CONFIGURATION | migration and adapters included; no connected external credentials or actual deployment tests |
| SMTP provider and analytics | NOT_IMPLEMENTED | env placeholders only, no claim of emails sent or analytics recorded |
| Actual Web Vitals/Lighthouse | NOT_IMPLEMENTED | no real domain or live browser network performance run |

## Key assertions exercised in `tests/test_e2e.py`

1. Public English/Indonesian and service pages return HTTP 200; pages contain official SVG source references.
2. Anonymous access to protected admin records returns 401; read-only viewer cannot access finance/CRM or mutate settings.
3. Contact/RFQ submissions require CSRF, valid consent, name/email/message and save to SQL.
4. Lead state and comments persist across HTTP requests and new DB sessions.
5. Updated site settings propagate to public contact page.
6. Article HTML is sanitized; script tags/event attributes do not survive; publish and unpublish change public route and sitemap.
7. New custom page remains 404 until section changes are published as a snapshot.
8. Invoice with configurable tax/withholding/discount uses integer minor units. Generated PDF bytes begin with `%PDF`.
9. Opaque verification token displays minimum metadata only; not customer name. Receipt token is revoked on void.
10. Partial payment changes outstanding and status, overpayment is rejected, voiding the receipt reverses the payment and reconciles the invoice.
11. Only authorized admin can upload media. Valid PNG persists in local storage and can be fetched. Corrupt CSRF token is rejected.
12. Arithmetic tests cover IDR/foreign currency minor units and exact calculation.

## Outstanding business/technical approval

Before public deployment: validate legal name/registration, bank details and policies; verify actual capabilities and service coverage; secure and test a Supabase/Vercel staging deployment; run browser-driven real network E2E, access controls and role administration; finish listed CMS/CRM/finance gaps; configure backup/restore, incident logging and external providers; obtain explicit site-owner approval.

**Acceptance decision:** Source review can proceed. **Final production approval is NOT recommended yet** against `docs/MASTER_SPEC.md`.

## Follow-up motion regression (29 October 2026, v0.1.1)

Changes made after owner feedback: browser-native pointer retained; pointer-following 3D tilt, mouse-driven hero rotation and magnetic button movement removed. Existing ambient morphing, floating images, scroll progress and reactive RFQ summary are retained.

```text
pytest tests/test_e2e.py -q --disable-warnings --maxfail=1
..                                                                       [100%]
python -m compileall -q vora
COMPILE PASS
python scripts/qa_motion.py
RESULTS 36 route/viewport combos, 12 functional checks
PASS pointer tracking is absent
PASS pointer-driven hero/card motion is absent
PASS clay morphing, RFQ summary, reduced motion and mobile nav
PASS no browser JavaScript exceptions / broken images / horizontal overflow
```

Source for actual browser results: `previews/MOTION_QA_RESULTS.json`; short video: `previews/VORA_Motion_Experience.mp4`. The Chromium tests render public HTML/CSS/JS into a local page without testing public hosting or actual live HTTP navigation. This is **not** a production deploy verification.

## Service portfolio cropping fix (29 October 2026, v0.1.2)

**Issue:** the International Freight Forwarding illustration was cut at the card boundary and overlapped body text. The original 3D art file itself was intact. The previous video also placed the card's bottom content under the playback controls due to scroll framing.

**Changes:** contained the illustration on desktop; gave it a separate art zone at mobile/tablet widths; maintained native cursor and existing reduced-motion behavior; regenerated the motion preview.

**Actual local test commands/results:**

```text
PYTHONPATH=. python scripts/qa_service_art.py
360 PASS contained True separate True
390 PASS contained True separate True
768 PASS contained True separate True
900 PASS contained True separate True
1024 PASS contained True separate True
1440 PASS contained True separate True
1920 PASS contained True separate True

PYTHONPATH=. pytest -q
..                                                                       [100%]
```

Evidence: `previews/service-art-contained-390.png`, `previews/service-art-contained-1440.png`, `previews/SERVICE_ART_QA.json`, and refreshed `previews/VORA_Motion_Experience.mp4`. These confirm the card's image bounds and distinct content zone in local Chromium rendering; they do **not** verify a public deployment.

## Public/admin navigation regression · 29 October 2026

- `pytest tests/test_e2e.py -q`: 2 passed. Includes direct admin access permissions, rejected `/admin` and `/en/admin/settings` public nav inserts, and exclusion of a legacy `/admin` nav row.
- Offline Chromium: seven public routes had **zero** anchor links to `#/admin`. Direct `#/admin` remained navigable for demo/testing. No JavaScript page errors.
- Public Contact and RFQ show only owner-approved email and office address, not telephone/WhatsApp.
- **Security distinction:** hiding links is a presentation choice. Server-side `/admin` authentication and RBAC remain mandatory; the offline browser prototype does not implement authentication.

## Actual additional tests · 29 October 2026 · numbering revision

Status: **PASS (local):** `pytest -q tests/test_e2e.py` -> `3 passed`. Tests include successful RFQ storage, customer/invoice payment/receipt, quote generated from customer and from lead, exact `INV/RCP/QUO/RFQ-VORA-CODE-YYYYMM-#####` patterns, stable owner code, forced collision/retry, PDF generation, QR verification for draft / issued / void.

Status: **PASS (browser):** standalone Chromium test created customer, invoice, receipt, quotation; checked shared customer code across all three; issued quotation and checked no horizontal overflow at 390px. JS errors: 0. Full prototype regression: 43/43 routes; 7/7 previously defined flows; 14/14 responsive checks; 0 JS errors.

Status: **NEEDS_CONFIGURATION:** migration `0005` on actual Supabase PostgreSQL and production concurrency test. **NOT IMPLEMENTED:** SMTP dispatch for quotations. No production deployment was performed.

---

## NEW: Current release QA | 29 Oct 2026 | deployment candidate source (NOT public-approved)

Previous sections above were written for older build stages. The assertions below supersede older comments that SMTP workflows or quotation outbound emails had not been implemented.

**Actual commands and outputs:**

```text
$ python -m compileall -q vora
PASS (no errors)
$ python -m pytest -q --disable-warnings --maxfail=1
.......                                                                  [100%]
7 passed
```

**Expanded integration tests:** `tests/test_quotation_approval.py` verifies admin-only request creation, queued quotation email with PDF attachment and unguessable approval URL, public `noindex` customer approval form, PDF download, upload with matching document reference, private file download, manual Finance checkbox, approval status transition and link non-reuse. It also checks invoice outbound SMTP queue/attachment via **mock SMTP transport**, and rejects unauthorized cron dispatch.

**Actual PDF render check:** synthetic examples generated with `build_vora_release_previews.py` into `qa_samples`: **5 line items = 1 A4 page**, **6 line items = 2 A4 pages** with respective 5+1 rows, receipt = 1 page, quotation = 1 page. Rendered PNGs were examined to verify layout, logo, watermark, QR, line separation and summary positioning. The examples contain fictional QA-only customer and bank data; no real financial records.

**NOT RUN / NEEDS CONFIGURATION:** Vercel deploy, live Supabase PostgreSQL migration, remote PDF storage, actual SMTP server, DNS email deliverability, real e-meterai verification, cron retry under hosting limits, browser full E2E, accessibility/performance auditing on a public hostname, all master-spec CRUD and SEO requirements. **Do not mark these PASS.**

**Known unreconciled functional requirement:** `Receipt issued for billing before funds received` remains absent. Present release only issues receipts once Finance confirms effective funds, and sends the corresponding confirmation through enabled SMTP rules. See `RELEASE_READINESS_2026-10-29.md`.

## 29 Oct 2026 — Detailed invoice / receipt revision

- PASS: `python -m pytest -q` — 9 local tests, including new detailed-document metadata and amount-in-words tests.
- PASS: `python -m compileall -q vora`.
- PASS: Invoice with five ordinary line items renders on one A4 page, six line items split 5 + 1. Full shipment metadata with five concise lines and one bank also renders on one page; extremely verbose cases may require a separate financial summary page to preserve legibility.
- PASS: Receipt with confirmed payment, bank trace, cumulative settlement, outstanding balance and English IDR amount renders on one A4 page.
- NEEDS_CONFIGURATION: PostgreSQL migration 0010 has not run on a real hosted Supabase environment.
- BLOCKED: Live SMTP, e-meterai validation, canonical-PDF integrity comparison and hosted browser verification.
