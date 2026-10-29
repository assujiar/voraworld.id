# VORA — Deployable Source / Acceptance Status

**Build date:** 29 October 2026. **Classification:** deployable source for **protected staging and integration testing**, **not approved for public production launch**.

This ZIP contains an executable Python FastAPI / SQLAlchemy SSR website, migrations for PostgreSQL, frontend resources, admin screens, document renderers, secure customer quotation approval workflow, custom SMTP outbox, and automated tests. A private Vercel staging URL and live Supabase / SMTP environments were **not** connected in this session; claims about real public deployment, mail delivery, or production suitability would be premature.

## Confirmed locally

- 5 top-level services and 9 sub-modes; corporate public pages, no public admin navigation, official VORA logo and brand colors; email `info@voraworld.id` and approved Gedung Nucira address; no telephone or WhatsApp fields in public UI.
- Protected admin, CMS articles/pages/settings, lead capture and pipeline, customers, multi-bank configuration with immutable invoice bank snapshots, payment confirmation and audit history.
- Numbering: `INV/RCP/QUO-VORA-C{10_HEX}-YYYYMM-{RANDOM5}`; RFQ/INQ use a stable `L{10_HEX}` lead code. Historical document numbers are preserved.
- Invoice branded monospace PDF: max **5** items per page; 5-item QA invoice is one page; 6-item QA invoice is two pages (5 + 1), with grand total, bank instructions and notes on the last page. Official icon A as watermark; QR verifies current document state.
- Receipt PDF generated only after Finance confirms funds cleared. Payment status updates, multi-part settlement and customer payment confirmation outbox. For receipts over IDR 5 million, final customer PDF is gated by manual e-meterai upload and review. No e-meterai API.
- Quotation issue and PDF: signature/stamp fields. Custom SMTP sends PDF with private expiring link; recipient uploads signed/stamped PDF for Finance's manual approval. Private storage (not public media), SHA-256 integrity check and audit history. Tokens are one-use and time-limited.
- Admin-controlled encrypted SMTP credentials, HTML email templates, individual trigger rules, outbox with failures/retries; optional secured scheduler endpoint `/internal/mail/dispatch`.

## Mandatory pre-launch work

1. Apply migrations **0001 through 0009, in order**, to a newly provisioned Supabase PostgreSQL database. Existing databases need an audited backup and only missing migrations.
2. Configure Vercel as a private/protected staging deployment, connect the real Supabase Postgres pooler, provision **public `vora-media`** and **private `vora-documents`** buckets, and configure all server-side environment secrets.
3. Create a superadmin from CLI (never a seeded production password). Configure banking, fiscal fields, real profile, legal/terms/privacy pages, SMTP and matching DNS (SPF/DKIM/DMARC) before allowing real customers.
4. Confirm test delivery through the actual SMTP server, verify the scheduler retries, test the payment confirmation and manual e-meterai sequence, and test private quotation approval upload on live Supabase storage.
5. Run production-like browser, performance, accessibility, authorization, PDF/QR and concurrent invoice-number issuance tests on staging. Verify receipts with legitimate signed e-meterai externally.
6. Resolve feature gaps in `KNOWN_LIMITATIONS.md` and obtain owner signoff before connecting the public domain.

## Known material gaps

- **Pre-payment “receipt for billing purposes” workflow is not implemented as a payment receipt.** The live code deliberately does **not** state funds were received until Finance explicitly confirms them. Use an invoice or a clearly labeled separate collection notice in the interim; review any proposed advance receipt + e-meterai practice with Indonesian finance/tax counsel before implementing.
- SMTP was unit/integration-tested using a substituted transport. Real SMTP was **not** connected and not exercised in the cloud.
- CMS, localization, imports, SEO, operational security, backups and production integration do not yet meet every item in `VORA_Sites_Master_Build_Prompt.md`. This is a significant delivery gap, not a formality.
- Document QR verifies the issuer's recorded document/status, not a government digital signature or a cryptographically signed PDF. A third party can modify a PDF's visual content and reuse its QR; use the stored official source and independent verification for high-value settlements.

Local tests: `python -m pytest -q` -> **7 passed**, and `python -m compileall -q vora` -> PASS. See `QA_REPORT.md` for full context. Sample PDFs under `qa_samples/` use **synthetic QA-only data** and must not be sent to customers.

## Revision: Detailed invoice and receipt (29 October 2026)

The finance PDF enhancement requires migration **0010** in addition to the prior 0001–0009 migrations. Automated local tests now report **9 passed**; QA samples are derived from fictitious testing records. Invoice allows a maximum of five item rows per page; a separate financial summary may be needed only when necessary to avoid cutting off unusually long metadata or bank terms. Receipt contains payment reconciliation, credited bank and Finance confirmation details when stored. **No live Supabase migration, SMTP transaction or canonical-PDF tamper comparison was performed.** See `FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md`.
