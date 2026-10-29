# Deployment

This file is a pointer. The step-by-step guides are:

1. `SUPABASE_SETUP_GUIDE.md`: database, storage, connection strings, keys, security checklist.
2. `VERCEL_SETUP_GUIDE.md`: project, environment variables, region, cron, verification.
3. `ADMIN_SETUP_GUIDE.md`: first superadmin, roles, company configuration, finance workflow.

Reference files: `.env.example` (every variable), `SUPABASE_MANUAL_SETUP.sql`, `SUPABASE_VERIFICATION.sql`, `migrations/`.

Key rules that are easy to miss:

* Always run Vercel with `APP_ENV=production`, including preview deployments.
* `PUBLIC_BASE_URL` is printed into document QR codes. Set the permanent production domain before issuing real invoices, receipts or quotations.
* Apply database changes only through the numbered migrations (`python scripts/apply_migrations.py`). Production never creates tables automatically.
* Take a backup before every migration.
