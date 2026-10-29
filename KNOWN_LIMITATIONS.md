# Current limitations (honest release assessment)

This is a **substantial, executable source release, not a completed production acceptance** against the supplied master specification. Core database-driven features work in local tests, but the following acceptance gaps remain.

## BLOCKED / no cloud access

- A real Sites project/private Sites URL and connected Sites runtime were not available to this session. **No Sites staging preview was created.** This code uses FastAPI/Vercel + Supabase PostgreSQL adapter, not the requested Sites-native React runtime.
- No user-owned Vercel/Supabase/SMTP/analytics account credentials were connected. No production deployment, PostgreSQL migration smoke test, storage upload to Supabase or external provider check was performed.
- A sandbox Chrome policy blocked direct HTTP navigation to localhost; HTML was rendered with real Chromium using in-memory source for 38 screenshots. Screenshots therefore cannot be cited as proof of real live browser navigation.

## PARTIAL / development needed to meet full brief

- Page customizer: working CRUD, section reorder Up/Down, background/layout presets, draft/publish/preview/revision rollback; **not** drag-and-drop, fully reusable block composition, detailed media picker, navigation/footer live visual designer or comprehensive theme panel. Core service pages still have source-controlled descriptions.
- Article editor: working contenteditable rich-text, H2/H3, formatting, lists, link/image, undo/redo, HTML source, server sanitization and revisions; no complete professional table/callout/embed toolbar, scheduled publishing or multi-author workflow.
- Lead CRM: persisted capture/pipeline/activity/status filtering/export; no CSV import, bulk actions, attachment upload, duplicate merging, automation or notification sender.
- Finance: customers, multi-item invoices, adjustable tax and withholding, partial payments, receipts, PDF/QR, void receipt/payment and balance reconciliation. No full draft edit/delete workflow, refund/credit notes, issuance approval, bank reconciliation, invoice email delivery, receivable ageing scheduler or tax e-Faktur integration. Must review governance before issuing real business documents.
- Site settings: editable public contacts, profile, legal name, bank info and policy fields. No deep nested translations, editable page-level media cropping or full drag-and-drop public customizer.
- Security: signed server sessions, password hashing, CSRF, RBAC, server sanitizer and limited DB-backed spam throttling. No full IP/device rate limit/WAF configuration, password reset email flow, MFA, administrative user provisioning UI, independent pentest or load test.
- SEO: public SSR, basic metadata, canonical/hreflang, robots/sitemap and organization JSON-LD; schemas/OG assets/conversion tracking and full multilingual content coverage remain incomplete. No real Lighthouse performance scores.
- Asset optimization: real brand SVGs and selectively copied PNG assets are provided. No automated AVIF/responsive sizes/full optimization pipeline. Alpha is preserved.
- Localization: built-in main labels and service overview translated; some generic static copy, forms, FAQ and legal notices still use English in ID locale. English must not be assumed fully translated when selecting ID.
- Monitoring and backup are documented, not configured. Local test DB proves persistence per request, not cloud redeploy resilience.

## Business prerequisites before public release

Confirm the legal status and public disclosure of PT Satu Arah International, actual contact info, address, tax/business details, operational service scope, licenses, verified coverage, policy texts and finance document approval workflow. Tests use only `example.invalid` QA data. **Do not use QA screenshots as actual customers or operating metrics.**

## Numbering / quotation update · 2026-10-29
- New numbers are only generated after `0005_document_numbering.sql` is applied in production. Old issued references remain unchanged.
- New quotation module supports save, issue, void, downloadable PDF, and public verification token. **SMTP quotation dispatch and audit of actual SMTP delivery are not yet wired end to end**, so do not claim the quotation email workflow is production-ready.
- Random five-digit suffixes are unique within the full prefix; the suffix alone is not globally unique and provides no security guarantee.
- PostgreSQL migration, concurrent write/load tests, live domain verification and actual Supabase persistence have not been executed here.

## Additional limitations (release dated 2026-10-29)

- The customer quotation approval flow and invoice send button have been added to the source. They are locally tested, not cloud or real SMTP validated.
- A pre-payment billing receipt that later changes to official/partial paid status remains **NOT IMPLEMENTED**. The app issues a payment receipt only after actual bank credit has been confirmed, by design, to avoid depicting unpaid funds as received. A provisional collection notice should be designed and legally reviewed separately.
- E-meterai validity is not independently verified by this software. Manual approval and recorded provider reference are administrative checks, not proof of authenticity.
- PDF watermark + QR verify database record/status but do not cryptographically sign the PDF bytes. Avoid claiming the PDF is impossible to counterfeit.
- Document settings and the CMS are not comprehensive enough to be considered a turnkey, fully editable enterprise website against the master specification.
- Real Supabase migration, private storage, Vercel deployment, SMTP delivery and external scheduler remain untested, so this source is **staging-ready only**, not public production-approved.
