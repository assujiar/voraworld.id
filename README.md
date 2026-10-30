# VORA | Corporate website, CMS and business portal

Bilingual (English first, Indonesian) corporate website for **VORA / PT Satu Arah International**, with an admin portal for content, leads, customers and finance documents. One **Next.js 15 (App Router) / React 19 / TypeScript** application: the public pages, the admin portal and the backend (server actions and route handlers) live in the same codebase. It runs on **Vercel with Supabase (PostgreSQL + Storage)**, and locally on any PostgreSQL 16.

* **Public site:** five service groups (International Freight Forwarding, Customs Brokerage, 3PL & Warehousing, Domestic Distribution, Project Cargo) with nine sub-services, About, Solutions, Network, Insights, FAQ, Contact and RFQ forms, localized SEO. Everything is rendered on the server, so crawlers get real HTML.
* **Admin portal:** one role, `admin`, which opens every menu. CMS (articles with HTML mode, section-based page editor, media, FAQ, navigation, coverage, SEO and redirects), leads with email replies, customers, audit log, company settings, custom SMTP with editable templates, rules, delivery log and retry. The sidebar is grouped into Sales, Finance, Website and System.
* **Commercial documents:** quotations (customer approval link and signed-PDF review), invoices (multiple bank accounts, tax, withholding, shipment metadata, five items per A4 page), payments held *pending* until Finance confirms cleared funds, receipts with manual e-meterai release, QR verification pages. Numbers: `[INV|RCP|QUO]-VORA-<OWNER_CODE>-YYYYMM-<RANDOM_5>`.

> **Status:** code-complete and tested locally against PostgreSQL 16 and a real `next start` server. **Not yet run on a live Vercel, Supabase or SMTP account.** Read `RELEASE_READINESS.md` before going public.
>
> **One role means no separation of duties.** Whoever can sign in can record *and* confirm a payment, issue and void documents, and change settings. Share the account only with people you would trust with all of that. See `ADMIN_SETUP_GUIDE.md` §2.

## Set it up (production)

You do these steps in your own accounts; nothing in this repository creates a project, runs a migration or deploys. Do them in order; each guide is written to be followed literally.

| What | Document |
| --- | --- |
| Deploy: Supabase SQL, Auth, Vercel settings and variables, domain, checks | `DEPLOYMENT.md` |
| What was tested and what was not | `QA_REPORT.md`, `RELEASE_READINESS.md` |

The dashboard of the running app shows a **setup checklist** (database, storage, SMTP, bank accounts, company details...) so you can see what is still missing. It reports presence only, never a secret.

## Run it locally

Requires Node.js 20.9 or newer (developed and tested on 22) and a Supabase project (a free one is enough; the local Supabase stack works too).

```bash
npm ci
cp .env.example .env.local     # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
# SQL Editor: run SUPABASE_MANUAL_SETUP.sql, create a user, then: select public.promote_admin('you@example.com');   (see DEPLOYMENT.md)
npm run dev
```

Public site `http://localhost:3000/en` (`/id` for Indonesian); admin `http://localhost:3000/admin/login`. 

## Tests

```bash
export TEST_DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres   # a server URL that may create databases
npm run typecheck
npm test                  # unit and integration tests; every test file gets its own throw-away database
npm run test:http         # `next build`, then real HTTP requests against `next start` with a stand-in Supabase Storage
npx playwright install chromium   # once, for the browser suite
npm run test:e2e          # `next build`, then Chromium drives the finance flow, the CMS flow and page audits at several widths
```

`test:e2e` starts its own production server on port 3310 (`E2E_PORT` changes it) and a throw-away database. If you already have a Chrome or Chromium binary, set `PLAYWRIGHT_CHROMIUM_PATH` to it instead of installing one.

The tests use only synthetic data (`*.invalid`, `*.example`), a faked SMTP socket and a local stand-in for Supabase Storage. See `QA_REPORT.md` for what they prove and what they cannot.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Standard Next.js commands. |
| `npm test` / `test:http` / `test:e2e` / `typecheck` | The test suites described above. |
| `npm run db:migrate [-- --apply] [-- --baseline NNNN]` | Applies `migrations/*.sql` in order, each in its own transaction. Without `--apply` it only lists what is pending. |
| `npm run build:setup-sql [-- --check]` | Regenerates `SUPABASE_MANUAL_SETUP.sql` from `migrations/` (`--check` fails if it is stale; a test does the same). |
| `npm run build:pdf-assets` | Regenerates `src/server/pdf/brand-assets.ts` (the logo images embedded in PDFs) from `public/static/assets`. |
| `npm run gen:schema` | Regenerates `src/server/schema.ts` (typed table rows) from a freshly migrated database; a test fails if it drifts from `migrations/`. |

## Repository map

| Path | Contents |
| --- | --- |
| `src/app/(site)/` | Public pages under `/en` and `/id`, sitemap, robots, article and page previews. |
| `src/app/(admin)/` | Admin portal: login, grouped sidebar, CMS, CRM, settings, finance pages and their PDF/file routes. |
| `src/app/(docs)/` | Public document pages: `/verify/<token>` and `/quotation-approval/<token>`. |
| `src/app/internal/mail/dispatch` | The cron endpoint that retries failed emails (bearer secret). |
| `src/actions/` | Server Actions (form handlers). Every admin action goes through one guard; a test enforces it. |
| `src/server/` | Domain code: database, auth, money, numbering, finance, PDFs, mail, storage, settings, verification. |
| `src/server/pdf/` | A4 PDF renderers (`pdf-lib`) for invoices, quotations and receipts. |
| `src/content/` | Service taxonomy, localized copy, email event list, admin menu. |
| `src/middleware.ts`, `src/instrumentation.ts` | Admin gate (signed cookie) and the start-up configuration check. |
| `migrations/0001`–`0018` | Ordered SQL for PostgreSQL. This is the only way the schema changes. |
| `SUPABASE_MANUAL_SETUP.sql` | All migrations as one script for an empty database (generated). |
| `SUPABASE_VERIFICATION.sql` | Read-only post-setup checklist (PASS / FAIL / INFO). |
| `scripts/` | `apply-migrations.ts`, `manage-users.ts`, `build-manual-setup.ts`, `embed-pdf-assets.ts`, `gen-schema-types.ts`. |
| `tests/` | Vitest suites (`tests/http/` runs against a real server) and Playwright browser specs (`tests/e2e/`). |
| `public/static/` | Brand files, CSS and the two small browser scripts. |
| `docs/` | Original product brief and implementation notes (historical). |

Other references: `ARCHITECTURE.md`, `NUMBERING_POLICY.md`, `FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md`, `CMS_ADMIN_GUIDE.md`, `SEO_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md`.

## History

Version 1.x was a FastAPI (Python) application. It was rewritten in Next.js/React for 2.0.0. The Python code is preserved, unchanged, on the branch **`python-v1.0.0`**, and the state of `main` before the VORA delivery is preserved on **`backup/main-before-vora-20261029`**. The database schema is the same lineage: migrations `0001`–`0014` are byte-for-byte the ones the Python version used, `0015`–`0018` are new (column defaults, 64-bit money columns, the single admin role, template wording), and password hashes written by the Python version still verify.

## Brand and interaction rules

The site keeps the standard browser cursor (no custom cursors, pointer trails or pointer-driven tilt); motion respects `prefers-reduced-motion`. Logos, the A-icon watermark and design tokens are the supplied brand files in `public/static/assets/` and must not be redrawn. `ASSET_MANIFEST.csv` records which illustration sources were selected; the original full-size PNGs are no longer in the tree, only the optimised WebP files the site uses. The PNGs remain in Git history (commit `2e1122b`).

## Approved public company details

PT Satu Arah International · `info@voraworld.id` · Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810. No telephone or WhatsApp number is shown, and no public page links to the admin portal. The details are editable in Admin → Site Settings.
