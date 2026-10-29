# VORA release readiness

**29 October 2026 · version 2.0.0 (Next.js / React / TypeScript) · branch `main`**

## Status in one line

**The source code is complete, tested locally and ready for you to deploy. It has not been run on any cloud account, so it is not yet "launch approved".** Treat it as ready for a *protected* Vercel + Supabase deployment and the verification steps below, then go public only after the launch gates are ticked.

**One decision to make before anyone signs in:** the portal has a single role, `admin`, which opens every menu. Whoever holds an account can record *and* confirm a payment, void documents and change settings. Decide who gets an account and how you review the audit log (`ADMIN_SETUP_GUIDE.md` §2).

## What is verified (locally, with evidence in `QA_REPORT.md`)

| Area | Status | Evidence |
| --- | --- | --- |
| Public site: 5 service groups, 9 sub-services, About, Solutions, Network, Insights, FAQ, Contact, RFQ, Privacy/Terms | PASS | Rendered in English and Indonesian; 132 Chromium page loads at six widths with no overflow, broken image, console error or failed request. |
| English first, Indonesian localization | PASS for application text | Tests fail if core English UI strings appear on `/id`. Service names and shipping terms (Air Import, FTL...) intentionally stay in industry English. Editor-written content is whatever language the editor writes (see gaps). |
| Brand, palette, standard cursor, motion | PASS | Official SVG/PNG assets and tokens only; no custom cursor, no pointer tracking, reduced motion respected (HTTP and browser tests). |
| Approved company details; no phone, WhatsApp or admin links | PASS | Tests across all public pages in both languages. |
| Technical SEO | PASS for basics | Canonical, hreflang, sitemap, robots, JSON-LD, per-page titles and descriptions (localized). No Lighthouse score claimed. |
| Admin authentication and the single role | PASS | PBKDF2, signed credential-bound sessions, same-origin checks, throttling; every Server Action executed as an anonymous visitor, as every other role value, as a stale or forged session and from another origin changes nothing; every admin page and POST gated on a real server. |
| CMS, leads, customers, audit, settings, navigation, SEO, media | PASS (functional) | Action tests plus a browser run that clicks every named button. See the gaps for what the editors do not do. |
| SMTP, templates, rules, outbox, retry | PASS with a fake transport | Real queue, encryption, back-off, atomic claiming, test email and retry run; the network socket is faked. |
| Quotation, invoice, receipt, payment, verification | PASS | Exact decimal maths in minor units with 64-bit columns; numbering `[INV/RCP/QUO]-VORA-<CODE>-YYYYMM-<RANDOM_5>` unique under 16-way concurrency; five items per page; QR and A-icon watermark; shipment metadata, tax, bank snapshots, reconciliation and audit data. |
| Payment control | PASS | Payments stay *pending* until Finance confirms cleared funds; only then do the invoice, receipt and customer email change. Exactly one of six simultaneous confirmations wins. |
| Collection vs proof of payment | PASS | The invoice PDF states it is a payment request, not proof of payment; the receipt is issued only after confirmation. |
| E-meterai (manual) and private storage | PASS locally | Receipt withheld until a validated stamped PDF is uploaded; SHA-256 stored and rechecked on every read; tampering refused. Tested against a stand-in for Supabase Storage. |
| Customer quotation approval | PASS locally | Private expiring link, signed PDF upload, Finance review; the upload alone never approves. |
| Database | PASS on PostgreSQL 16 | Migrations `0001`–`0018` from an empty database by the runner and by `SUPABASE_MANUAL_SETUP.sql`; `SUPABASE_VERIFICATION.sql` passes on both; RLS on every table; typed schema matches. |
| Production start-up | PASS locally | A production server boots with a valid configuration and answers 500 on every request, naming the cause, when the configuration is unsafe. |
| Owner tooling | PASS locally | `npm run users` and `npm run db:migrate` run for real, including the hidden password prompt in a pseudo-terminal. |
| Deployment shape | PASS locally | `vercel.json`, `.env.example`, exact dependency pins and the setup SQL are kept in sync with the code by tests. |

## What is NOT verified (launch gates for you)

1. A real Vercel deployment (cold start, region, protection, cron).
2. `SUPABASE_MANUAL_SETUP.sql` and `SUPABASE_VERIFICATION.sql` on your real Supabase project (including the Storage section), the transaction-pooler connection, real Storage reads and writes with your key, backups and a restore test.
3. Real SMTP delivery and DNS authentication (SPF/DKIM/DMARC); the document and notification emails end to end, and how they render in mail clients.
4. A genuine e-meterai stamped PDF, and a customer-signed quotation, accepted by the upload checks. The checks read the PDF's text layer for the document numbers: a provider or scanner that outputs image-only pages would be refused.
5. Lighthouse, Web Vitals and accessibility audits on the production domain, and an independent penetration test.
6. Legal and factual content: Privacy and Terms text, service claims, coverage, Indonesian wording, company details sign-off (including confirming the legal name of **PT Satu Arah International** with the official registry).
7. WAF or bot protection for the public forms (currently honeypot plus a per-email throttle only).

## Known gaps in the product (honest list)

These are not defects in what exists; they are features the brief or the original spec could reasonably expect that are **not built**.

* **Single role.** No separation of duties, no read-only or content-only accounts. Adding roles is a code change.
* **Visual page editor** is section-based (add, reorder with Up/Down, layout presets, draft, preview, publish, restore). It is not drag-and-drop, and the long-form copy of the built-in pages lives in `src/content/`, not in the admin.
* **Article editor**: rich text and raw HTML with sanitising and revisions; no tables, callouts or embeds toolbar, scheduled publishing or multi-author workflow. FAQ entries are not per language; articles and pages carry a language each.
* **Admin UI is English only.** There is no user-management screen (use `npm run users`), no email-based password reset, and no multi-factor sign-in.
* **CRM**: no CSV import, bulk actions, attachments or duplicate merging.
* **Finance**: no credit notes, refunds, invoice approval chain, bank statement reconciliation, receivables ageing or e-Faktur integration. Invoices and quotations cannot be edited once created: void and create again. Drafts can be issued or voided but not deleted.
* **PDFs are not cryptographically signed.** The QR proves the issuer's record, not that a PDF's text is unaltered. The standard PDF fonts print only Latin characters (others appear as `?`).
* **E-meterai** is manual by design; the software does not call a provider or judge a stamp's validity.
* The **Content-Security-Policy** still allows inline scripts and styles (`'unsafe-inline'`) because Next.js needs them; there are no third-party origins.
* **Database connection** with `sslmode=require` is encrypted but the server certificate is not verified.
* Public pages are rendered on every request (no static caching), so latency follows the database region; add caching if traffic requires it.
* Public analytics fields (GA4, GTM IDs) are stored but nothing is injected into pages; no analytics is wired.

## Owner checklist, in order

1. Supabase: create the project → run `SUPABASE_MANUAL_SETUP.sql` → run `SUPABASE_VERIFICATION.sql` (all PASS) — `SUPABASE_SETUP_GUIDE.md`.
2. Vercel: import the repo → set variables (`APP_ENV=production` always) → protected deploy — `VERCEL_SETUP_GUIDE.md`.
3. Create the first admin with `npm run users -- create` — `ADMIN_SETUP_GUIDE.md` §1.
4. Configure bank accounts, SMTP, rules, legal pages — `ADMIN_SETUP_GUIDE.md` §3 (the dashboard checklist ticks off what is done). Send a test email.
5. Walk the finance flow with fictitious data on the protected deployment: quotation → approval → invoice → pending payment → confirm → receipt; try a receipt above IDR 5,000,000 with a real e-meterai file and a real signed quotation. Scan a QR.
6. Run the checks in `QA_REPORT.md` §7; fix anything that fails.
7. Set `PUBLIC_BASE_URL` to the permanent domain, remove deployment protection, attach the domain. **Do this before the first real document is issued.**

## Decision

* Deploy to a protected environment now: **ready.**
* Go public and issue real financial documents: **after the launch gates above are signed off.**
