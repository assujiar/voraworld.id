# Email Marketing & Broadcast

## What is installed

An admin-only `Email Broadcast` menu with manual contacts and CSV import (5,000 rows maximum per file), campaign drafts, rich-text and HTML source editing, server-sanitised preview, tag-filtered audience, scheduling in WIB, test email, pause/resume/cancel, delivery reporting and a separate, rate-limited queue. The SMTP configuration under **Admin > Email & Notifications** is reused. Marketing sending is **disabled by default**.

Contacts are not imported automatically from Leads or Customers. Newly created and imported contacts are `unverified` unless accompanied by a valid consent status and evidence. Suppressed and unsubscribed contacts are excluded from launch and checked again before SMTP sending. The email footer contains an unsubscribe link, and supported one-click clients can use the List-Unsubscribe header.

## Database migration (required before using the menu)

The migration is additive and does not modify the existing transactional email queue. Back up the Supabase database before applying it.

**Existing Supabase project:** use **one** of the following methods:

1. If the server has `DATABASE_URL` (Supabase direct connection or session pooler port 5432), from the updated repo run `npm run db:migrate` to preview pending migrations, then `npm run db:migrate -- --apply`. This creates the migration tracking record if the database was already managed through VORA's migration runner.
2. If migrations were previously managed manually and no `schema_migrations` record exists, examine the migration history before applying anything. Run **only** `migrations/0041_broadcast.sql` in Supabase SQL Editor if 0001–0040 are already present. Do **not** run `SUPABASE_MANUAL_SETUP.sql` against an existing database, and do not later run the migration runner blindly against a manually changed schema.

**A completely empty Supabase project:** `SUPABASE_MANUAL_SETUP.sql` is generated from all migrations, but will also set up all VORA tables. Never apply it to an existing project.

Post-migration checks in the SQL Editor:

```sql
SELECT id, enabled, max_per_hour FROM public.broadcast_settings;
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'broadcast_%' ORDER BY table_name;
SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'broadcast_%' ORDER BY proname;
```

Expected settings row: `id=1`, `enabled=false`, `max_per_hour=30`. There should be five broadcast tables and seven broadcast functions.

## GitHub Actions dispatcher (no Vercel paid cron needed)

The workflow `.github/workflows/broadcast-dispatch.yml` calls `https://voraworld.id/internal/broadcast/dispatch` roughly every ten minutes. GitHub-hosted scheduled workflow execution is **best-effort**, can be delayed, and requires Actions to be enabled for the repository. It can also be started manually using `workflow_dispatch`.

Set **one** GitHub Actions repository secret, in `assujiar/voraworld.id > Settings > Secrets and variables > Actions > New repository secret`:

- Name: `VORA_CRON_SECRET`
- Value: **exactly the existing `CRON_SECRET` value configured on the deployed VORA app in Vercel**. It must be at least 32 characters. Do not add this value to Git, documents, chat, or screenshots.

Keep SMTP `MAIL_ENCRYPTION_KEY` and the Supabase service-role secret on the server only. GitHub Actions needs only the cron secret. The workflow runs against the production domain and does not change the Vercel cron used for transactional emails.

To activate: apply the migration, verify production environment variables and SMTP, set the GitHub secret, navigate to **Admin > Email Broadcast**, and enable marketing delivery. Test sending to the admin email before launching a real campaign. An administrator can also manually dispatch a batch from this screen.

## Sending behavior and limits

The default **global** quota is 30 reserved SMTP attempts in any rolling 60-minute window, across all campaigns and workers. Each invocation reserves at most five messages. Attempts count toward the cap even if SMTP rejects a message. The cap can be set from 1 to 300 per hour but must not exceed the actual provider's contractual limits. There is no guarantee of exact start time: scheduling, queue availability, delivery retries, GitHub Actions latency, SMTP throughput, and rolling-window quota all affect timing.

SMTP failures retry automatically, up to four attempts with backoff. If a worker dies or fails to acknowledge SMTP acceptance, the delivery is marked **failed with an uncertain outcome** after the ten-minute claim lease: it is **not** automatically retried (to limit accidental duplicate sends). Reconcile with SMTP logs before considering manual resend.

`sent` means accepted by the SMTP transport, **not** guaranteed inbox arrival. There are no invented delivery, open-rate, or click-through metrics. Transactional mail continues using the original email outbox and schedule.

## CSV columns

`email` is mandatory. Optional columns: `company_name`, `pic_name`, `position`, `phone`, `country`, `business_category`, `tags`, `source`, `consent_status`, `consent_evidence`. Use comma-separated tags inside a **quoted CSV cell**. Valid consent statuses: `unverified` (default), `subscribed` (requires consent evidence of at least 8 characters), or `unsubscribed`. Existing email addresses are skipped on import and are never silently overwritten. Download a template from the admin page.

## Limitations

- Rich-text and HTML source use one underlying HTML state. Returning from source to rich text sanitises the source on the server first; unsupported tags, arbitrary CSS, scripts and unsafe URLs are dropped. Server sanitisation runs again before storing and sending. The preview is sandboxed.
- The sender reuses the existing SMTP account; a provider may throttle or suspend it for high-volume commercial email. Verify SPF, DKIM, DMARC, unsubscribe handling and marketing authorisation, and consider a dedicated reputable email delivery provider for higher throughput.
- For CSV import, files are uploaded through VORA's existing admin staging mechanism (private documents bucket). Files are removed after the action loads their bytes; import rows are inserted through an RPC in batches of 200.
- The launch captures currently opted-in contacts only. Contacts added later do not enter an already-launched campaign.
- Campaigns can be edited only in Draft state. Cancel/pause cannot stop a message already submitted to SMTP.
