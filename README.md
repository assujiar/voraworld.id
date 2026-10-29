# VORA | Corporate website + CMS + Business Portal

An **actual FastAPI/SQLAlchemy server-rendered application** with a persisted relational database, protected administrator routes, CMS, leads, contacts/RFQs, customers, invoices/receipts and QR verification. Official brand marks are sourced from the supplied VORA brand kit. Visual source assets are selected from the uploaded archive, not redrawn.

## What this deliverable is

- A reviewable **source code release** that runs on your machine or a Vercel Python deployment connected to Supabase PostgreSQL/Storage after configuration.
- A local browser-rendered **screen collection** in `previews/`, plus integration tests.
- NOT a deployed ChatGPT Sites project, NOT a public website and NOT a verified production environment. Limitations are documented in `KNOWN_LIMITATIONS.md` and `QA_REPORT.md`.

## Quick start locally

Requires Python 3.11+ (tested with Python 3.13). The bundle ships no credentials or production database.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env       # copy manually on Windows
# Set SESSION_SECRET and PUBLIC_BASE_URL, load .env variables into your shell.
# For local setup, DATABASE_URL=sqlite:///./vora.db is fine.
python -c "from vora.db import init_db; init_db()"
python scripts/create_admin.py
uvicorn vora.main:app --host 127.0.0.1 --port 8765 --reload
```

Public home: `http://127.0.0.1:8765/en/` (switch to `/id/` for Bahasa Indonesia). Administrator: `http://127.0.0.1:8765/admin/login`.

> FastAPI does not load `.env` automatically. Export the variables or use a process manager such as `dotenv`/`direnv`. No default admin password is shipped. A missing local secret falls back to a **development-only** value. **Production** startup refuses missing/weak secret, non-PostgreSQL database or non-HTTPS base URL.

## Tests

```bash
pytest tests/test_e2e.py -q
python -m compileall -q vora
```

Integration tests create their own temporary SQLite database, QA-only users and test invoices. They never create production data. See `QA_REPORT.md` for test scope and limitations.

## Main directories

- `vora/main.py` FastAPI HTTP endpoints, SSR routing, server authorization, admin actions and submissions
- `vora/db.py` SQLAlchemy relational schema
- `vora/logic.py` decimal-safe invoice arithmetic, PDF/QR, sanitizer, verification
- `vora/content.py` reviewed service copy and bilingual core page labels
- `vora/templates/` reusable Jinja templates, admin screens and public page sections
- `vora/static/` approved brand logos, image assets, design tokens and CSS/JS
- `migrations/0001_initial_postgres.sql` baseline schema for a NEW Supabase database
- `scripts/create_admin.py` one-time administrator setup
- `tests/` integration tests
- `previews/` browser-renders and QA-only PDF documents

## Native pointer and motion policy

The site retains the standard browser cursor (including the conventional link hand). It does not use custom cursor images, pointer trails, magnetic buttons, or mouse-position-controlled tilt. Ambient clay morphing and entrance transitions remain, with `prefers-reduced-motion` support. The browser QA outputs and motion video are in `previews/`.

## Important boundaries

Core services and first-page narratives are provided as clear, conservative copy in source (`vora/content.py`). Newly created pages and extra sections, FAQs, articles, legal copy, contact info, navigation and verified coverage are editable via admin. The design tokens and official logo are intentionally locked. Editing the service-page core copy itself requires development work in this version, a documented acceptance gap.

The app intentionally does not invent public offices, actual routes, certifications, client names, service metrics, legal licenses or published article claims. Admin must review all company details before launch.

Start with `DEPLOY.md`, `CMS_ADMIN_GUIDE.md` and `KNOWN_LIMITATIONS.md` before moving out of review mode.

## Approved VORA public contact details (2026-10-29)

Email: `info@voraworld.id`  
Office: Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810

New local installations seed these values through `init_db()`; production must apply `migrations/0002_contact_details.sql` after the baseline. Public pages and invoices read the settings database and can be edited without source changes at `/admin/settings`. Telephone and WhatsApp are intentionally unconfigured.

### Document reference numbering (29 October 2026)

Current format is `{INV|RCP|QUO}-VORA-{CUSTOMER_OR_LEAD_CODE}-{YYYYMM}-{RANDOM_5}`. Inquiry references use `RFQ` or `INQ` instead. See `NUMBERING_POLICY.md` and apply migration `0005_document_numbering.sql` after earlier migrations. Quotation numbering, PDF and verify are implemented; outbound quotation SMTP is not yet end-to-end tested.

## Review deploy package (2026-10-29)

This source release extends the initial build with a secure quotation approval link, private signed/stamped PDF upload, Finance review controls, invoice customer email, secured mail scheduler hook, and an additional migration (`0009`). `migrations/0001` through `0009` must be applied in order to a new PostgreSQL schema. See `RELEASE_READINESS_2026-10-29.md` for exact PASS/BLOCKED decisions and `qa_samples/` for synthetic 5-item/6-item invoice, receipt and quotation PDF renders. This is **not a production acceptance certificate**.

### Detailed finance document revision (29 Oct 2026)

Apply migration `0010_detailed_commercial_documents.sql` after migrations 0001–0009. Invoice fields now include optional service mode, origin, destination, and B/L/AWB reference. Detailed invoice and receipt renderers use actual database fields and payment reconciliation, with a QA-only sample PDF set under `qa_samples/`. For limitations, see `FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md`.
