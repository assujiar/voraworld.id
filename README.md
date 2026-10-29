# VORA | Corporate website, CMS and business portal

Bilingual (English first, Indonesian) corporate website for **VORA / PT Satu Arah International**, with an admin portal for content, leads, customers and finance documents. A server-rendered **FastAPI + SQLAlchemy** application that runs on **Vercel (serverless Python) with Supabase (PostgreSQL + Storage)**, and locally on SQLite.

* **Public site:** five service groups (International Freight Forwarding, Customs Brokerage, 3PL & Warehousing, Domestic Distribution, Project Cargo) with nine sub-services, About, Solutions, Network, Insights, FAQ, Contact and RFQ forms, localized SEO.
* **Admin:** role-based sign-in, CMS (articles with HTML mode, section-based page editor, media, FAQ, navigation, coverage, SEO), leads, customers, audit log, company settings, custom SMTP with editable templates, rules, delivery log and retry.
* **Commercial documents:** quotations (with customer approval link and signed-PDF review), invoices (multiple bank accounts, tax, withholding, shipment metadata, five items per A4 page), payments held *pending* until Finance confirms cleared funds, receipts with manual e-meterai release, QR verification. Numbers: `[INV|RCP|QUO]-VORA-<OWNER_CODE>-YYYYMM-<RANDOM_5>`.

> **Status:** code-complete and tested locally (SQLite and PostgreSQL 16). **Not yet run on a live Vercel/Supabase/SMTP account.** Read `RELEASE_READINESS.md` before going public.

## Set it up (production)

Do these in order; each guide is written to be followed literally.

| Step | Document |
| --- | --- |
| 1. Create the database and storage | `SUPABASE_SETUP_GUIDE.md` (`SUPABASE_MANUAL_SETUP.sql`, then `SUPABASE_VERIFICATION.sql`) |
| 2. Deploy the app | `VERCEL_SETUP_GUIDE.md` (variables listed in `.env.example`) |
| 3. Create the first superadmin and configure the company | `ADMIN_SETUP_GUIDE.md` |
| 4. Know what was tested and what was not | `QA_REPORT.md`, `RELEASE_READINESS.md` |

## Run it locally

Requires Python 3.11+ (developed and tested on 3.13).

```bash
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
export APP_ENV=development SESSION_SECRET="$(openssl rand -hex 32)" PUBLIC_BASE_URL=http://127.0.0.1:8765
python -c "from vora.db import init_db; init_db()"        # creates ./vora.db (SQLite) and seeds defaults
python scripts/manage_users.py create you@example.com --role superadmin
uvicorn vora.main:app --host 127.0.0.1 --port 8765 --reload
```

Public site `http://127.0.0.1:8765/en/` (`/id/` for Indonesian); admin `http://127.0.0.1:8765/admin/login`. FastAPI does not read `.env` by itself; export the variables or use `direnv`.

## Tests

```bash
python -m pytest                                          # SQLite; PostgreSQL-only tests skip
# Whole suite against a PostgreSQL database built only from the migrations:
createdb vora_test && DATABASE_URL=postgresql://localhost/vora_test python scripts/apply_migrations.py --apply
VORA_TEST_DATABASE_URL=postgresql://localhost/vora_test python -m pytest
```

Tests use only synthetic data and a faked SMTP socket. See `QA_REPORT.md`.

## Repository map

| Path | Contents |
| --- | --- |
| `app/index.py` | Vercel entrypoint |
| `vora/main.py` | HTTP routes, authentication, admin actions |
| `vora/db.py`, `vora/logic.py` | Models, money maths, numbering, verification |
| `vora/pdf_*.py`, `vora/receipt_stamp.py` | A4 PDF renderers, private storage and integrity checks |
| `vora/mail.py` | Encrypted SMTP settings, templates, outbox |
| `vora/content.py`, `vora/templates/`, `vora/static/` | Service taxonomy, localized copy, Jinja templates, brand assets, CSS/JS |
| `migrations/0001`–`0014` | Ordered SQL for PostgreSQL |
| `SUPABASE_MANUAL_SETUP.sql` | All migrations as one script for an empty database (generated: `python scripts/build_manual_setup.py`) |
| `SUPABASE_VERIFICATION.sql` | Read-only post-setup checklist |
| `scripts/` | `apply_migrations.py`, `manage_users.py`, `build_manual_setup.py`, browser QA helpers |
| `tests/` | Test suite |
| `docs/` | Original product brief and implementation notes (historical) |

Other references: `ARCHITECTURE.md`, `NUMBERING_POLICY.md`, `FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md`, `CMS_ADMIN_GUIDE.md`, `SEO_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md`.

## Brand and interaction rules

The site keeps the standard browser cursor (no custom cursors, pointer trails or pointer-driven tilt); motion respects `prefers-reduced-motion`. Logos, the A-icon watermark and design tokens are the supplied brand files in `vora/static/assets/` and must not be redrawn. The original full-size PNG sources of the illustrations are no longer in the tree; the optimised WebP files used by the site are. `ASSET_MANIFEST.csv` records which sources were selected. The PNGs remain in Git history (commit `2e1122b`).

## Approved public company details

PT Satu Arah International · `info@voraworld.id` · Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810. No telephone or WhatsApp number is shown, and no public page links to the admin portal. Details are editable in Admin → Site Settings.
