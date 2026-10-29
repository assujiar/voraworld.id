# VORA release readiness

**29 October 2026 · branch `main`**

## Status in one line

**The source code is complete, tested locally and ready for you to deploy. It has not been run on any cloud account, so it is not yet "launch approved".** Treat it as ready for a *protected* Vercel + Supabase deployment and the verification steps below, then go public only after the launch gates are ticked.

## What is verified (locally, with evidence in `QA_REPORT.md`)

| Area | Status | Evidence |
| --- | --- | --- |
| Public site: 5 service groups, 9 sub-services, About, Solutions, Network, Insights, FAQ, Contact, RFQ, Privacy/Terms | PASS | Rendered in EN and ID; 132 Chromium page loads at six widths with no overflow, broken image or console error. |
| English first, Indonesian localization | PASS for application text | Tests fail if core English UI strings appear on `/id/`. Service names and shipping terms (Air Import, FTL…) intentionally stay in industry English. Editor-written content is whatever language the editor writes (see gaps). |
| Brand, palette, standard cursor, motion | PASS | Official SVG/PNG assets and tokens only; no custom cursor, no pointer tracking, reduced-motion respected. |
| Approved company details; no phone, WhatsApp or admin links | PASS | Tests across all public pages in both languages. |
| Technical SEO | PASS for basics | Canonical, hreflang, sitemap, robots, JSON-LD, per-page titles/descriptions (localized). No Lighthouse score claimed. |
| Admin authentication and roles | PASS | PBKDF2, signed credential-bound sessions, CSRF, throttling; every admin route proven 401/403 for anonymous/unprivileged users. |
| CMS, leads, customers, audit, settings, navigation, SEO, media | PASS (functional) | End-to-end tests. See gaps for what the editors do not do. |
| SMTP, templates, rules, outbox, retry | PASS with a fake transport | Real queue, encryption, back-off, test email and retry run; the network socket is faked. |
| Quotation, invoice, receipt, payment, verification | PASS | Server-side `Decimal` maths in minor units; numbering `[INV/RCP/QUO]-VORA-<CODE>-YYYYMM-<RANDOM_5>` unique under 16-way concurrency; five items per page; QR and A-icon watermark; shipment metadata, tax, bank, reconciliation and audit data. |
| Payment control | PASS | Payments stay *pending* until Finance confirms cleared funds; only then do the invoice, receipt and customer email change. Double-confirm is blocked under concurrency. |
| Collection vs proof of payment | PASS | Invoice PDF states it is a payment request, not proof of payment; the receipt is issued only after confirmation. |
| E-meterai (manual) and private storage | PASS locally | Receipt withheld until a validated stamped PDF is uploaded; SHA-256 stored and rechecked on every read; tampering detected. |
| Customer quotation approval | PASS locally | Private expiring link, signed PDF upload, Finance review; upload alone never approves. |
| Database | PASS on PostgreSQL 16 | Migrations `0001`–`0014`, no model/schema drift, RLS on all tables, full suite green on a migrations-only database. |
| Deployment shape | PASS locally | `app/index.py` boots in production mode from a runtime-only virtualenv; env example and manual setup SQL kept in sync by tests. |

## What is NOT verified (launch gates for you)

1. A real Vercel deployment (cold start, region, protection, cron).
2. `SUPABASE_MANUAL_SETUP.sql` and `SUPABASE_VERIFICATION.sql` on your real Supabase project, real Storage reads/writes with your key, backups and a restore test.
3. Real SMTP delivery and DNS authentication (SPF/DKIM/DMARC); the five document/notification emails end to end.
4. A genuine e-meterai stamped PDF accepted by the upload checks.
5. Lighthouse / Web Vitals / accessibility audit on the production domain, and an independent penetration test.
6. Legal and factual content: Privacy and Terms text, service claims, coverage, company details sign-off (including confirming the legal name of **PT Satu Arah International** with the official registry).
7. WAF/bot protection for the public forms (currently honeypot + per-email throttle only).

## Known gaps in the product (honest list)

These are not defects in what exists; they are features the brief or the original spec could reasonably expect that are **not built**.

* **Visual page editor** is section-based (add, reorder with Up/Down, layout presets, draft/preview/publish/restore). It is not drag-and-drop, and the long-form copy of the five core service pages lives in `vora/content.py`, not in the admin.
* **Article editor**: rich text and raw HTML with sanitising and revisions; no tables/callouts/embeds toolbar, scheduled publishing or multi-author workflow. FAQ entries are not per-language; articles and pages carry a language each.
* **Admin UI is English only.** There is no user-management screen (use `scripts/manage_users.py`), no email-based password reset, and no multi-factor sign-in.
* **CRM**: no CSV import, bulk actions, attachments or duplicate merging.
* **Finance**: no credit notes, refunds, invoice approval chain, bank statement reconciliation, receivables ageing or e-Faktur integration. Draft invoices can be issued or voided but not deleted.
* **PDFs are not cryptographically signed.** The QR proves the issuer's record, not that a PDF's text is unaltered.
* **E-meterai** is manual by design; the software does not call a provider or judge a stamp's validity.
* Content-Security-Policy still allows inline scripts/styles (`'unsafe-inline'`) because the templates use them; there are no third-party origins.
* Public analytics fields (GA4, GTM IDs) are stored but only used if you add the tags yourself; no analytics is wired by default.

## Owner checklist, in order

1. Supabase: create the project → run `SUPABASE_MANUAL_SETUP.sql` → run `SUPABASE_VERIFICATION.sql` (all PASS) — `SUPABASE_SETUP_GUIDE.md`.
2. Vercel: import the repo → set variables → protected deploy — `VERCEL_SETUP_GUIDE.md`.
3. Create the first superadmin — `ADMIN_SETUP_GUIDE.md` §1.
4. Configure bank accounts, SMTP, rules, legal pages — `ADMIN_SETUP_GUIDE.md` §3. Send a test email.
5. Walk the finance flow with fictitious data on the protected deployment: quotation → approval → invoice → pending payment → confirm → receipt; try a receipt above IDR 5,000,000. Scan a QR.
6. Run the checks in `QA_REPORT.md` §6; fix anything that fails.
7. Set `PUBLIC_BASE_URL` to the permanent domain, remove deployment protection, attach the domain. **Do this before the first real document is issued.**

## Decision

* Deploy to a protected environment now: **ready.**
* Go public and issue real financial documents: **after the launch gates above are signed off.**
