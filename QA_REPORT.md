# VORA QA report

**Date:** 29 October 2026 · **Scope:** the whole repository, Next.js / React / TypeScript version 2.0.0 · **Verdict:** every automated check passes locally: 221 unit and integration tests, 42 real-server HTTP tests and 17 browser tests (280 in all), a clean type check, a production build, and the operational smoke tests in §4–§5. Nothing has been run against a live Vercel, Supabase or SMTP account; those checks are listed in §7 and are yours to do.

## 1. Environment

Node.js 22.22, Next.js 15.5.28, React 19.1.10, TypeScript 5.9.3, PostgreSQL 16.15 (a local, throw-away server), Vitest 3.2.7, Playwright 1.64.1 driving Chromium 153, poppler (`pdftotext`, `pdftoppm`) for PDF cross-checks. All test data is synthetic (`*.invalid`, `*.example`).

## 2. Automated tests (commands and results)

```bash
export TEST_DATABASE_ADMIN_URL=postgresql://postgres@localhost:5432/postgres   # a server that may create databases
npx tsc --noEmit                      # clean
npm test                              # 18 files, 221 tests passed (about 30 s)
npm run test:http                     # next build, then 3 files, 42 tests passed against a real `next start`
npm run test:e2e                      # next build, then 17 browser tests passed in about 5 minutes (Chromium)
npm run build:setup-sql -- --check    # SUPABASE_MANUAL_SETUP.sql is current
```

Every unit-test file gets its own database cloned from a template that was built **only** from `migrations/0001`–`0018`; nothing relies on a development bootstrap. The HTTP and browser suites start a production-mode server on a fresh migrated database with a stand-in for Supabase Storage that enforces the rules the real service enforces (a `sb_secret_` key accepted in `apikey` only, never as a Bearer token; private buckets need the key; uploads never overwrite).

| Test file | Tests | What it proves |
| --- | :-: | --- |
| `money.test.ts` | 10 | Exact decimal maths in minor units with half-up rounding; discount, tax and withholding on the net amount; amounts beyond 32 bits; invalid input rejected. |
| `dates.test.ts` | 5 | Business dates are Jakarta dates (the UTC/Jakarta day boundary, the new year), real calendar days only, due-date fallbacks. |
| `numbering.test.ts` | 10 | Format `KIND-VORA-OWNER-YYYYMM-RANDOM5`, the Jakarta month, permanent random owner codes under concurrent requests, 16 simultaneous allocations all unique, a forced collision is retried, an exhausted month fails explicitly, the database rejects duplicates. |
| `auth.test.ts` | 15 | Password hashing (including a hash written by the Python version), signed sessions, sessions that die on password change, role change and deactivation, 401 versus 403, throttling by email and by IP address, unknown accounts cost the same time, same-origin checks, cookie parsing. |
| `action-guards.test.ts` | 23 | The source of **every** Server Action is scanned (each starts with its guard, only the five visitor actions are public) and **every admin action is executed** as an anonymous visitor, as accounts with each other role value (`editor`, `sales`, `finance`, `viewer`, `superadmin`, `ADMIN`, blank), as a deactivated or stale session, with forged cookies and from other origins, with hostile and empty input. No table changes in any of those runs. |
| `form-names.test.ts` | 1 | No form control is named like a built-in property of `<form>` (`id`, `action`, `method`, `submit`...), the cause of the lost-button bug described in §6. |
| `admin-actions.test.ts` | 27 | Sign-in and sign-out, open-redirect protection, CMS (articles, pages, sections, revisions), FAQ, navigation, coverage, redirects, settings, media upload validation, leads including reply by email, SMTP administration. |
| `public-actions.test.ts` | 12 | Contact and RFQ forms: permanent lead code and reference, honeypot, four submissions per email per 15 minutes, truncation, cross-site posts refused, emails queued only when SMTP and the rule are on. |
| `finance.test.ts` | 32 | Customers, bank accounts (one preferred per currency), quotations, invoices (exact totals, numbering, bank snapshots), payments as claims, reserved balances, confirmation (exactly one of six simultaneous confirmations wins), e-meterai rules, receipt void and reversal, approval links (expiry, revocation, never beyond validity plus one day), upload inspection, document emails. |
| `finance-actions.test.ts` | 8 | The money flow through the real form actions, including the e-meterai route and the customer approval route; forms return the message **and** what was typed. |
| `pdf.test.ts` | 12 | Real PDF text (shipment data, tax, withholding, banks, reconciliation, amount in words), five items per page, ten items on one quotation page, overflow pages, foreign currency, stamped receipts returned as the stored file, characters the fonts cannot print, oversize content fails instead of clipping. |
| `mail.test.ts` | 16 | Template and rule parity with the migrations, AES-GCM secrets, address validation, de-duplication, back-off then `failed` after five attempts, two workers never send one message twice, expired leases re-claimed, ineligible attachments refused. |
| `users.test.ts` | 13 | The account command: create, duplicates, weak passwords, reset ends sessions, deactivate, no role option, legacy-role accounts explained, **and the program run as a real child process with a real pipe**. |
| `migrations.test.ts` | 4 | Contiguous numbering, RLS and seed data on a fresh database, template wording after `0018`, `src/server/schema.ts` matches the migrated database. |
| `manual-setup.test.ts` | 8 | `SUPABASE_MANUAL_SETUP.sql` is exactly what the builder produces, creates no demo data, gives the same schema as the migrations on an empty database, `SUPABASE_VERIFICATION.sql` passes there and flags an unprotected table, a missing seed and a 32-bit money column. |
| `deploy.test.ts` | 14 | `.env.example` documents every variable the code reads and nothing else, no real secret in it, `vercel.json` shape and cron, run times, exact dependency pins, no environment file or key tracked, no source file hidden from Git by `.gitignore`, no leftover Python. |
| `env.test.ts` | 7 | Start-up rules: PostgreSQL URL, https base URL in production, long random session secret, Vercel needs production mode, upload ceiling. |
| `setup-check.test.ts` | 4 | The dashboard checklist starts empty, turns green only when things are really done, rejects look-alikes, and never puts a configured value into its answer. |
| `tests/http/*` | 42 | A real server: five service groups and nine sub-services in both languages with no phone, WhatsApp or admin links; approved company details; Indonesian translation; canonical, hreflang, Open Graph and JSON-LD; sitemap and robots; redirects; security headers and caching; brand and cursor rules; the admin gate (every admin page redirects an anonymous visitor to sign-in with the wanted page remembered; every POST, a Server Action call included, and every other method gets 401; every non-admin role is refused everywhere); every menu entry is a live page; CSV export without formula injection; ids that are not real record numbers answer 404; QR verification pages; PDF downloads; the private approval link; the cron endpoint. |
| `tests/e2e/*` | 17 | See §3. |

## 3. Browser tests (Chromium, a production build, real Server Actions)

| Spec | Result |
| --- | --- |
| `audit.spec.ts`, public site | English and Indonesian × 11 pages × widths 360, 390, 768, 1024, 1440, 1920 = **132 page loads**: no horizontal overflow, no broken image, no console error, failed request or 4xx answer, exactly one `<h1>`, the right `lang`, the standard cursor. The mobile menu opens in both languages. |
| `audit.spec.ts`, admin portal | 25 pages × widths 390, 768, 1440 = **75 page loads** after a wrong password (one generic message, no session) and a real sign-in (an `HttpOnly`, `SameSite=Lax` cookie): no overflow, one `<h1>`, no broken image, no console error; the grouped menu shows Sales, Finance, Website, System; the mobile menu opens; sign-out ends the session. |
| `cms.spec.ts` | Every named button of the content portal: article draft, publish, unpublish and restore (sanitised HTML, no script runs on the public page); page sections added, saved, reordered, deleted, published and unpublished (Enter saves, never moves; drafts stay private); FAQ, navigation (a link into the admin portal is refused), coverage, redirects (they work for visitors), settings, media upload (a fake image is refused), a visitor's RFQ becoming a lead that is worked in the pipeline and exported as CSV, SMTP settings and the test email, sign-out. |
| `finance.spec.ts` | Customer, two bank accounts (one preferred), an invoice form that keeps everything typed when the server refuses, issue, a payment claim that leaves the balance alone, an over-claim refused, cleared funds above IDR 5,000,000 leading to a receipt that waits for its e-meterai, a fake PDF refused and a real one stored and released byte for byte, a second payment settling the invoice, a quotation with its private approval link (opened by a "customer" on a phone, a wrong file refused, the signed file uploaded), the manual review, QR pages for all three documents, eleven finance pages at phone width. No console error or failed request anywhere. |

PDF layouts were also rendered to PNG with poppler and inspected by eye during development (invoice with five and with ten items, quotation, receipt, the e-meterai pending page): monospace layout, logo, A watermark, QR, five rows per page, the payment-request statement.

## 4. Database and migration checks

* Migrations `0001`–`0018` apply cleanly, in order, to an empty database through `npm run db:migrate -- --apply` and through `SUPABASE_MANUAL_SETUP.sql` run with `psql` (zero errors). The runner then reports "Nothing to apply: the database is up to date" for both.
* `SUPABASE_VERIFICATION.sql` on the database built by the runner: 19 PASS, 2 INFO and 2 WARN (no `storage` schema on a plain PostgreSQL; the two smoke accounts use `example.invalid`). On the database built by the manual script, which has no accounts yet: 18 PASS, 3 INFO and 1 WARN (storage). The checks include Row Level Security on every public table, no `anon`/`authenticated` grants, 64-bit money columns, unique document numbers, 18 recorded migrations, the approved contact details, and eight email templates and rules seeded (all rules disabled).
* `src/server/schema.ts` (typed rows) matches the migrated database exactly; a test fails otherwise.
* The storage migration is written to do nothing on plain PostgreSQL and was **not** run on a real Supabase project.

## 5. Operational smoke tests

| Check | Result |
| --- | --- |
| `npm run users -- create` with a piped password (with and without a trailing newline), through `npm`, and in a pseudo-terminal with the hidden two-time prompt | Works; the password is never echoed or printed. A duplicate email, a weak password, a missing terminal, an unknown `--role` option and an unknown account are each refused with a clear message and exit code 2. `reset-password`, `deactivate`, `activate` and `list` work; the audit rows exist and contain no password or hash. |
| Production server started with a valid configuration | `/robots.txt` and `/en` answer 200. A loopback `http://` base URL is accepted off Vercel. |
| Production server started with a missing `DATABASE_URL`, a non-PostgreSQL URL, an `http://` base URL on a real host, a placeholder or short `SESSION_SECRET`, or the Vercel flag with `APP_ENV=development` | Every request answers 500 and the log names the cause (for example "SESSION_SECRET must contain >=32 random characters in production"). |
| Secret scan of the repository | Only synthetic test keys and the documented local placeholders; no real secret, key or connection string. |

## 6. Defects found and fixed during the rewrite

| # | Defect | Fix |
| --- | --- | --- |
| 1 | A form control named `id` made `form.id` return the control, so React dropped the clicked submit button: Publish, Issue and Void silently lost their `action`. Found only by driving a real browser. | The hidden record field is `name="record"` everywhere; `form-names.test.ts` forbids such names; the browser specs click every named button. |
| 2 | `/admin/../../evil` was accepted as the page to open after sign-in. | A strict pattern, no `..`, no `//`. |
| 3 | Hostile input broke pages and queries: integers beyond 32 bits, NUL bytes (PostgreSQL text cannot hold them), 50,000-character fields, record ids such as `99999999999`. | Integers clamped, NUL stripped, lengths bounded, `routeId()` answers 404; every admin action is executed with such input by `action-guards.test.ts`. |
| 4 | A file that merely starts with `%PDF-` made the PDF parser throw (a 500). | Any failure while reading the structure is "Invalid or damaged PDF". |
| 5 | The cron endpoint accepted the bare secret without `Bearer `. | The header must be exactly `Bearer <secret>`. |
| 6 | An approval link lost its `href` when `PUBLIC_BASE_URL` was `http://` (the sanitiser allows https and mailto only). | Production requires an https base URL; tests and browser runs use an https origin. |
| 7 | Email templates seeded by `0008`/`0009` had older wording than the code, and `0014` could not update them. | Migration `0018`, changing only rows an admin has not edited; a parity test. |
| 8 | A failure of private storage in production answered 500. | `StorageError` is an `ActionError`: forms show it, file routes answer 502/503. |
| 9 | The start-up configuration check existed but was never called. | `src/instrumentation.ts`; verified by booting real servers with bad configuration (§5). |
| 10 | The Python ORM applied column defaults on the client; the database had none, so a plain SQL insert failed. | Migration `0015`. |
| 11 | Money columns were 32-bit: one invoice above IDR 2.1 billion would not save. | Migration `0016`; the verification SQL checks it. |
| 12 | A password piped into `npm run users -- … --password-stdin` arrived empty (closing the reader fired its "close" handler first). | Fixed, with a test that runs the program as a child process on a pipe. |
| 13 | A malformed percent-escape in an unrelated cookie turned a PDF download into a 500. | Safe cookie decoding. |
| 14 | A lead logged shortly after midnight in Jakarta got the previous month in its reference; the portal showed times in UTC. | Business dates are Jakarta dates everywhere; the portal, receipts, verification pages and articles show the Jakarta day. |
| 15 | `users create` on an email left over from the multi-role version gave a misleading message, and `reset-password` on it succeeded while the account stayed locked out. | Both now explain the role problem and print the one `UPDATE` that fixes it; the comment in migration `0017` was corrected. |
| 16 | `unpdf` produced a webpack warning (`import.meta`). | `serverExternalPackages: ['unpdf']`. |
| 17 | The admin checkbox rendered oversized and the rich-text surface too narrow; the setup checklist wrongly required a legal name that is not seeded. | CSS and checklist corrected. |
| 18 | `npm run test:e2e` existed without a configuration or any spec. | The browser suite in `tests/e2e/`. |
| 19 | `npm run db:migrate` said "Dry run only" even when nothing was pending. | It now says the database is up to date. |
| 20 | `.gitignore` listed `coverage/`, which also matched the admin page `src/app/(admin)/admin/(shell)/coverage/`: the page was never committed, so a fresh clone had a dead "Coverage" menu link (404) while every test passed in the developer's working tree. Found by running the whole suite on a fresh clone of the pushed branch. | The pattern is anchored (`/coverage/`), the page is tracked, and `deploy.test.ts` fails if `.gitignore` hides anything under `src`, `scripts`, `migrations`, `tests` or `public`. |

## 7. Not tested here: needs your cloud accounts

These cannot be verified from a build machine. Treat each as a launch gate.

1. **Vercel**: an actual deployment, cold-start behaviour, function region, deployment protection, cron execution, logs.
2. **Supabase**: running `SUPABASE_MANUAL_SETUP.sql` in the SQL Editor (a long script with its own transactions) and `SUPABASE_VERIFICATION.sql` on the real project, including the Storage section, the pooler connection with prepared statements disabled, real Storage uploads and reads for both buckets with your key format, backups and a restore.
3. **SMTP**: delivery to a real mailbox with your provider, SPF/DKIM/DMARC, how the HTML renders in mail clients, PDF attachments; the quotation, invoice, payment-confirmation and receipt emails end to end.
4. **E-meterai and signed PDFs**: a genuine stamped PDF from your provider passing the upload checks. The checks read the PDF's text layer for the document numbers, so a provider (or a customer's scanner) that returns image-only pages would be refused. The software checks structure and references, not the authenticity of a stamp or signature.
5. **Performance and accessibility**: Lighthouse and Web Vitals on the production domain; a screen-reader pass. No scores are claimed. Pages are rendered per request, so latency depends on the database region.
6. **Security**: an independent penetration test, WAF/bot protection in front of the public forms (the app has a honeypot and a per-email throttle only), and load testing.
7. **Content**: legal review of Privacy and Terms, factual review of every service statement and of the Indonesian wording, and owner approval of the company details.
