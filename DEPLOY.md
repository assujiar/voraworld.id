# Deployment & Review Guide (Vercel + Supabase)

> **Staging on Vercel + Supabase: follow `DEPLOY_STAGING.md` first.** It covers migration `0011` (Row Level Security), the migration runner and the hosting fixes added after this guide was written.

**Status: NEEDS_CONFIGURATION.** No Supabase project, Vercel account or domain was connected during this build. Deployment has not been attempted or certified. Do not treat localhost QA as cloud deployment QA.

## 1. Create the services

Create a private Supabase project and a **public** media storage bucket named `vora-media` (public read-only bucket for public website illustrations; never upload sensitive finance attachments). Keep the service-role key private and server-side. Obtain the direct PostgreSQL or Supabase transaction pooler connection URI and enforce TLS. A Vercel Python project can use `vercel.json` and `app/index.py`; configure project root to this repository.

## 2. Provision the database

Run `migrations/0001_initial_postgres.sql` **once against a new, empty database** in Supabase SQL Editor, or via `psql` using a privileged migration identity. Then apply `migrations/0002_contact_details.sql` once. This migration writes the owner-approved email and office address to the persistent `settings` table, without overwriting non-empty edits already made by an administrator. PostgreSQL UUID/serial handling is managed by SQLAlchemy's baseline schema. The SQL contains no credentials, sample customer data or demo users.

For subsequent schema changes, prepare a numbered migration and back up data first. `scripts/generate_migration.py` emits a **baseline only**: it is NOT an automated incremental migration engine. In production `create_all()` is disabled to prevent silent schema drift.

## 3. Environment variables

Configure these in Vercel for **Preview** first:

| Variable | Value or requirement |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Supabase PostgreSQL URI with TLS (`postgresql://...?...sslmode=require`) |
| `PUBLIC_BASE_URL` | HTTPS URL of the review/staging deployment; production URL after approval |
| `SESSION_SECRET` | Generate locally using `openssl rand -hex 32` |
| `SUPABASE_URL` | HTTPS Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret, **never** expose as `NEXT_PUBLIC_` or in client JS |
| `SUPABASE_STORAGE_BUCKET` | `vora-media` |

Keep SMTP, Google Analytics and other third-party provider credentials blank until you install/configure their services. Do not claim outgoing emails were sent just because an inquiry appears in the lead table.

**Security warning:** `PUBLIC_BASE_URL` is embedded inside invoice and receipt QR codes at PDF generation time. After moving from staging to production, set the final canonical URL before issuing real business documents; use a stable production domain so old links remain accessible.

## 4. Create the administrator (one time)

Run `scripts/create_admin.py` from a secure environment that can connect to the Supabase database, with the **production** secret and database URL already set. Do not run it by exposing an HTTP endpoint. It prompts for email and a strong password and never prints the password. Role additions/credential recovery currently require administrator-controlled command-line/DB maintenance (not admin UI).

## 5. Preview-only deployment

Deploy to a protected Vercel Preview deployment. Protect preview access using Vercel deployment protection, not only `/admin` sign-in. Verify that the public route and SSR metadata work, but **do not connect or publish the live corporate domain**. Restrict access to the preview if real contacts/customer details are being used.

## 6. Production approval checklist

1. Validate registration/name of **PT Satu Arah International** with the company owner and official registry. No claim of legal registration was verified here.
2. Review services and facts; confirm all operating regions and company communications before publishing.
3. Replace placeholder privacy/terms with lawyer-reviewed text, then publish in admin.
4. Configure production HTTPS base URL, Supabase database backups, storage retention, IAM/credential rotation and Vercel Preview protection.
5. Run all integration tests, manual production auth/RBAC tests, PDF/QR scans, browser QA (360,390,768,1024,1440,1920), automated Lighthouse and accessibility checks on actual staging domain.
6. Test backup/restore, rate limits, server logs and user account recovery.
7. Get owner approval. Only then map the public domain and remove deployment protection.

## 7. Backup and maintenance

Use Supabase scheduled PostgreSQL backups (plan-dependent), periodic encrypted `pg_dump`, and copy/retention policy for storage objects. Test restoration to a separate database periodically. Monitor Vercel logs (redact PII), errors, form traffic, invoices and failed authentication. Rotate service role, DB credentials, admin passwords and session key according to a documented operational policy. Session key rotation logs out existing sessions. Run schema changes as reviewed migrations.

## 8. Limitations

This release is **not a complete implementation of every item in `MASTER_SPEC.md`**. See `KNOWN_LIMITATIONS.md`. The most consequential gaps are a missing private Sites preview, unverified Vercel/Supabase connectivity, incomplete advanced CMS/editor/finance workflows, and no provider-backed transactional mail. Do not publish as fully accepted until these are resolved.

## New reference numbers / quotations (29 Oct 2026 update)

Before deploying this revision to an **existing** database, back up Supabase PostgreSQL and run `migrations/0005_document_numbering.sql` after `0004_receipt_emeterai.sql`. The migration adds `public_code` to `customers` and `leads`, `reference` to `leads`, and `quotations` / `quotation_items` tables. Do not execute new application code against a schema without migration 0005.

Use `NUMBERING_POLICY.md` for exact formats and collision controls. Legacy issued document identifiers must be preserved. Staging test workflow: create lead -> create customer -> create quote -> issue / verify -> create invoice -> record payment / receipt -> verify; confirm stable owner code and random five-digit suffixes. Quotation SMTP sending is not yet production-verified.

## 9. 29 Oct 2026 finance and quotation-approval release (migration 0009)

**Apply ALL migrations 0001–0009 on a fresh database, in numeric order.** Existing projects must be backed up and have their migration history checked; do not blindly rerun schema modifications. Migrations 0003–0008 add SMTP, e-meterai metadata, unified numbering, multi-bank statements, commercial fields and confirmed-payment audit fields. **0009 adds `quotation_approvals` and the approval-related email templates/rules.**

Create two Supabase Storage buckets:
- `vora-media`: public read-only assets intended for public web pages.
- `vora-documents`: **PRIVATE**, never turn on public access. Stores manually stamped receipts and signed customer quotation approvals. `SUPABASE_SERVICE_ROLE_KEY` must exist only as a server secret.

Required additional Vercel server environment variables:

```text
MAIL_ENCRYPTION_KEY=<cryptography.Fernet generated base64 key>
SUPABASE_DOCUMENTS_BUCKET=vora-documents
CRON_SECRET=<32+ random characters, optional for retry scheduler>
```

Generate `MAIL_ENCRYPTION_KEY` once with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Back it up securely: rotation without migration can make previously saved SMTP passwords unreadable. Never put it in frontend HTML or GitHub. In `/admin/mail`, configure the actual SMTP host, port, credentials, from/reply-to, templates and enable the appropriate event rules. Until a rule is enabled, the app deliberately does not send that class of email.

`POST /admin/quotations/{id}/request-approval` requires an issued quotation and the `quotation_approval_request` SMTP rule. Once created, the email outbox includes a PDF and a private 14-day-or-validity-limited approval link. The customer submits a PDF retaining the quotation number. Finance inspects the signature/stamp and approves or rejects in the quotation detail page. Upload alone does **not** mark the quotation approved.

For reliable retries, configure an external scheduler to GET `/internal/mail/dispatch` with `Authorization: Bearer <CRON_SECRET>` over HTTPS. The endpoint refuses unconfigured or incorrect secrets. Real delivery needs to be tested on staging. If using Vercel Cron, check the available frequency and per-plan quotas; don't assume an hourly schedule is supported on all plans.

After Finance explicitly confirms effective bank credit, `payment_confirmed` and any eligible `receipt_customer` emails are queued according to enabled rules. For receipts requiring e-meterai, the receipt PDF is withheld until authorized Finance uploads the manually stamped PDF. The booking receipt is **not** issued before bank confirmation in this release.

**Review release only. Do not remove staging protection or publish `voraworld.id` until owner approval and live integration tests.**

## 10. Detailed branded financial document revision (migration 0010)

**Before running this code on an existing Supabase deployment:** back up PostgreSQL, confirm applied migration history through `0009`, then execute `migrations/0010_detailed_commercial_documents.sql`. New installations apply **all migrations `0001` to `0010` in numeric order**. Never overwrite financial rows or regenerate already-issued document IDs as part of a visual-template change.

The invoice editor includes optional Service Mode, Origin, Destination, and B/L/AWB Transport Reference fields, all persisted server-side. The document renderer reads these fields, customer tax ID, due date, selected-bank snapshots, actual calculated tax/withholding and current confirmed invoice balance. Blank fields remain absent rather than guessed. Receipts now show linked-invoice reconciliation and Finance confirmation audit data where present.

Run `python -m pytest -q` and render sample PDFs before first production use. For a successful hosted-stage test, issue an invoice with 5 items and a receipt based on a confirmed payment, test a fake/modified PDF against your authoritative records, and verify the manual official e-meterai process when required. The generated PDF's visual density or QR code alone is **not** proof that all document text has not been altered by a third party.
