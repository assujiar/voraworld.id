# VORA QA report

**Date:** 29 October 2026 · **Scope:** the whole repository on branch `main` · **Verdict:** all automated checks pass locally on SQLite and on a PostgreSQL 16 database built only from the SQL migrations. Nothing has been run against a live Vercel, Supabase or SMTP account; those checks are listed in §6 and are yours to do.

## 1. Environment

Python 3.13, FastAPI/Starlette TestClient, SQLAlchemy 2, psycopg 3, PostgreSQL 16.15 (local, throw-away), Chromium (Playwright) for browser checks. All test data is synthetic (`*.invalid`, `*.example`).

## 2. Automated tests (commands and results)

```bash
pip install -r requirements-dev.txt

# SQLite (default; the 3 concurrency tests need PostgreSQL and skip themselves)
python -m pytest -o addopts="" -q
#   60 passed, 3 skipped

# PostgreSQL: the schema comes ONLY from migrations 0001-0014, the dev bootstrap is disabled
createdb vora_test
DATABASE_URL=postgresql://localhost/vora_test python scripts/apply_migrations.py --apply
VORA_TEST_DATABASE_URL=postgresql://localhost/vora_test python -m pytest -o addopts="" -q
#   63 passed, 0 skipped

python -m compileall -q vora scripts app tests          # clean
python scripts/build_manual_setup.py --check            # SUPABASE_MANUAL_SETUP.sql is current
psql vora_test -f SUPABASE_VERIFICATION.sql             # 17 PASS, 0 FAIL (2 WARN expected on plain Postgres: no storage schema; test accounts)
```

| Test module | Tests | What it proves |
| --- | :-: | --- |
| `test_e2e.py` | 3 | Public pages in both locales, RFQ/contact capture and persistence, admin sign-in, viewer restrictions, CMS publish/unpublish and sanitising, settings → public site, article/page snapshots and revisions, media upload, invoice maths (tax, withholding, discount), PDF and QR, pending → confirmed payment, partial payment, overpayment rejection, receipt void and reversal, SMTP outbox with fake transport, document numbering and quotation numbering with forced collisions. |
| `test_finance_extras.py` | 3 | Full settlement to *paid*; e-meterai: receipt withheld, upload validation (wrong type, wrong references, missing approval), one-shot upload, SHA-256 integrity and tamper detection (409), stamped receipt attached to the customer email; invoice says "PAYMENT REQUEST - NOT PROOF OF PAYMENT"; foreign-currency receipts always need stamp review. |
| `test_quotation_approval.py` | 2 | Quotation issue → approval email with PDF and private expiring link → customer upload → Finance review; invoice email; scheduler endpoint secret. |
| `test_detailed_documents.py`, `test_pdf_onepage.py` | 4 | Real PDF text: shipment metadata, customer tax ID, banks, ledger reconciliation, amount in words; **max five items per page**, quotation on one page, oversize content fails instead of clipping. |
| `test_public_site.py` | 13 | All 5 service groups and 9 sub-services render in EN and ID with no phone, WhatsApp or admin links; approved email and address; Indonesian translation present and English UI strings absent; SEO (canonical, hreflang, sitemap, JSON-LD, robots); security headers; standard cursor and no pointer tracking; reduced-motion support; official brand assets; admin mobile-menu regression. |
| `test_security.py` | 17 | Login throttling and audit; no user enumeration; sessions die on password change or deactivation; POST-only logout with CSRF; role matrix for 6 roles × 13 sections; **every `/admin` route (GET and POST, enumerated from the live route table) returns 401 to anonymous and 403 to a no-permission user**; CSRF on state-changing posts; token-gated internal endpoints; the grouped sidebar shows each role only the categories and links it can open. |
| `test_mail_admin.py`, `test_mail_seed.py` | 5 | SMTP test email, back-off to failed after 5 attempts, manual retry, permissions, dedupe; migration `0014` equals the code's template set. |
| `test_manage_users.py` | 2 | Account CLI: create, reset (ends sessions), role change, deactivate, audit, weak password rejected. |
| `test_deploy_compat.py` | 11 | Pooler-safe engine, Vercel guard, upload limit < 4.5 MB, `vercel.json` shape and cron, runtime requirements, contiguous migrations, `SUPABASE_MANUAL_SETUP.sql` current, `.env.example` covers every variable the code reads, Supabase header handling for both key formats. |
| `test_postgres_concurrency.py` | 3 | 16 parallel invoices get 16 unique, well-formed numbers; the database rejects duplicate numbers; 6 simultaneous confirmations of one payment produce exactly one success (303) and five 409s. PostgreSQL only. |

## 3. Browser checks (Chromium, real HTTP against the running app)

| Run | Matrix | Result |
| --- | --- | --- |
| Public site | EN and ID × 11 pages (home, about, services, a sub-service, project cargo, solutions, network, FAQ, insights, contact, RFQ) × widths 360, 390, 768, 1024, 1440, 1920 = **132 page loads** | 0 horizontal overflow, 0 broken images, 0 console errors, 0 failed or 4xx requests, exactly one `<h1>`, correct `lang`, standard cursor. Mobile menu opens in both languages. |
| Admin portal | Signed in; 22 pages × widths 390, 768, 1440 = **66 page loads**, then sign-out through the POST form at each width | 0 overflow, 0 console errors, 0 failed requests; session invalid after sign-out. |

The Content-Security-Policy is active during these runs, so no page depends on a blocked script, style or font. Screenshots were reviewed by eye for the desktop hero, the mobile RFQ page, the Indonesian mobile menu and the invoice form; the A4 invoice was rendered to PNG and inspected (monospace layout, logo, A-icon watermark, QR, five rows, new payment-request statement).

## 4. PostgreSQL and migration checks

* Migrations `0001`–`0014` apply cleanly, in order, to an empty database, through both `scripts/apply_migrations.py` and `SUPABASE_MANUAL_SETUP.sql`; the runner recognises the manual setup as complete.
* ORM models and migrated schema match exactly (no missing table or column).
* Row Level Security on for all 33 public tables; simulated `anon` and `authenticated` roles get *permission denied* on `users` and `invoices`.
* The storage migration was exercised against simulated `storage.buckets` tables (new and old column layouts) and is idempotent. It was **not** run on a real Supabase project.
* The real entrypoint `app/index.py` boots in `APP_ENV=production` with `VERCEL=1` using a virtualenv that contains only `requirements.txt` (no test tools): public pages 200, `/api/docs` 404, HSTS and CSP present, cron endpoint 401 without and 200 with the bearer secret, admin sign-in reaches the dashboard.

## 5. Defects found and fixed during this pass

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Migrations never enabled Row Level Security: on Supabase the public anon key could read and write every table (users, leads, invoices…). | `0011_enable_rls.sql`; `0012`/`0013` follow the pattern; verification SQL checks it. |
| 2 | Production never seeded 5 of the 8 email templates/rules (only development ran `init_db`). Invoice and receipt emails could never be enabled. | `0014_seed_email_templates.sql` generated from the code, with a drift test; PostgreSQL tests now run with the bootstrap disabled so this class of bug cannot hide again. |
| 3 | New-style Supabase `sb_secret_…` keys were also sent as a Bearer token, which Supabase rejects ("Invalid JWT"). | One header helper; both key styles tested. |
| 4 | psycopg prepared statements break behind Supabase's transaction pooler; serverless instances kept idle pools. | `prepare_threshold=None`, `NullPool` on Vercel. |
| 5 | Upload limits (7/10 MB) exceeded Vercel's 4.5 MB request cap. | 4 MB on Vercel, `MAX_UPLOAD_BYTES` override, UI shows the real limit. |
| 6 | Admin menu unreachable at ≤780 px (menu closed by script, its toggle hidden). | Toggle shown; regression test and browser check. |
| 7 | Stray disclosure triangle in the mobile header. | CSS fix. |
| 8 | `GET /admin/<thing>/{id}` returned 404 before checking sign-in (lets anonymous visitors probe which IDs exist); two POSTs validated input before authorising. | Authenticate first; generic all-routes test added. |
| 9 | No login throttling; unknown-user timing differed; GET logout; sessions survived password change. | Throttle table (`0012`), dummy-hash verification, POST+CSRF logout, credential-bound sessions. |
| 10 | No Content-Security-Policy; static assets uncached on serverless. | Strict CSP (no third-party sources), `Cache-Control` on `/static`. |
| 11 | Indonesian pages still had English navigation, footer, About, use cases, forms, legal headings, SEO titles; public text referred to the "admin portal". | Translated; tests assert English UI strings are absent from `/id/`. |
| 12 | Invoice PDF did not state that it is not proof of payment. | Footer statement; receipt footer says it was issued after cleared funds. |
| 13 | A tampered stored receipt crashed the download route (500). | 409 with a clear message. |
| 14 | No way to test SMTP or retry a failed message by hand. | **Send test email** and per-message **Retry**. |
| 15 | `.env.example` listed variables the code never reads (`SMTP_*`, `GA4_MEASUREMENT_ID`) and missed others. | Rewritten; a test keeps it in sync with the code. |
| 16 | `vercel.json` used legacy `builds`/`routes`, which disable project settings. | Zero-config FastAPI entrypoint, bundle excludes, daily cron. |

## 6. Not tested here: needs your cloud accounts

These cannot be verified from a build machine. Treat each as a launch gate.

1. **Vercel**: an actual deployment, cold-start behaviour, function region, deployment protection, cron execution, logs.
2. **Supabase**: running `SUPABASE_MANUAL_SETUP.sql` and `SUPABASE_VERIFICATION.sql` on the real project (including the Storage section, which only a real project can answer), the pooler connection, real Storage uploads and reads for both buckets with your key format, backups and restore.
3. **SMTP**: delivery to a real mailbox with your provider, SPF/DKIM/DMARC, HTML rendering in mail clients, PDF attachments; the quotation, invoice, payment-confirmation and receipt emails end to end.
4. **E-meterai**: a genuine stamped PDF from your provider passing the upload checks (the software checks structure and references, not the stamp's authenticity).
5. **Performance and accessibility**: Lighthouse/Web Vitals on the production domain; an assistive-technology pass. No scores are claimed.
6. **Security**: an independent penetration test, WAF/bot protection in front of the public forms (the app has a honeypot and a per-email throttle only), and load testing.
7. **Content**: legal review of Privacy and Terms, factual review of every service statement, and owner approval of the company details.
