# Deployment

This file is a pointer. The step-by-step guides are:

1. `SUPABASE_SETUP_GUIDE.md`: database, storage, connection strings, keys, security checklist.
2. `VERCEL_SETUP_GUIDE.md`: project, environment variables, region, cron, verification.
3. `ADMIN_SETUP_GUIDE.md`: first admin, the single role, company configuration, finance workflow.

Reference files: `.env.example` (every variable), `SUPABASE_MANUAL_SETUP.sql`, `SUPABASE_VERIFICATION.sql`, `migrations/`, `vercel.json`.

Key rules that are easy to miss:

* Always run Vercel with `APP_ENV=production`, including preview deployments. The server refuses to start on Vercel otherwise.
* `PUBLIC_BASE_URL` is printed into document QR codes. Set the permanent production domain (https) before issuing real invoices, receipts or quotations.
* Apply database changes only through the numbered migrations (`npm run db:migrate -- --apply`) or, for a brand-new project, `SUPABASE_MANUAL_SETUP.sql`. The application never creates or alters tables.
* Take a backup before every migration, and keep a copy of `MAIL_ENCRYPTION_KEY`.
* Every push to the Production Branch (`main` by default) triggers a production deployment on Vercel once the project is connected to this repository. Configure the project (variables, region, protection, domain) before connecting it, or change the Production Branch first.
* Create the first admin with `npm run users -- create EMAIL` from a trusted machine; there is no default account.
