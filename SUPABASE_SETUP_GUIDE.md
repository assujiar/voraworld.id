# Supabase setup guide

You do these steps in your own Supabase account. The repository never contacts Supabase by itself, and nothing here has been run against a live Supabase project (see `RELEASE_READINESS.md` for what is verified locally and what still needs a live check).

What VORA uses from Supabase:

| Feature | How the app uses it |
| --- | --- |
| PostgreSQL | All data, through a server-side connection string (`DATABASE_URL`). |
| Storage | Two buckets, reached with the server-side secret key: `vora-media` (public) and `vora-documents` (private). |
| Auth / Realtime / Data API / Edge Functions | **Not used.** Admin sign-in is VORA's own (PBKDF2 passwords, signed cookies). |

## 1. Create a dedicated project

1. Dashboard → **New project**. Use a new project for VORA only; do not reuse a project that belongs to another application.
2. Pick the region closest to your users and to your Vercel function region (for Jakarta customers, Singapore `ap-southeast-1` is a sensible choice).
3. Set a long random database password and store it in your password manager. If it contains characters such as `@ : / ? # %`, URL-encode them when you place it in a connection string (for example `@` becomes `%40`). Letters and digits only is simplest.
4. Check your plan's limits before launch (automatic pausing of inactive projects, backup retention, storage and egress quotas).

## 2. Create the schema (once, on the empty database)

1. Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of `SUPABASE_MANUAL_SETUP.sql` and click **Run**. It creates every table (migrations `0001`–`0018`), enables Row Level Security, seeds the approved contact details and the eight email templates and rules (all rules start disabled), creates the two storage buckets and records the migration history in `schema_migrations`. It creates **no** users, customers or documents.
3. Open a new query, paste `SUPABASE_VERIFICATION.sql` and run it. **Every row must say `PASS`** (`INFO` rows are informational). The "active admin accounts" row reads `INFO` until you create the first admin in `ADMIN_SETUP_GUIDE.md`. Any `FAIL` means stop and fix before continuing.

`SUPABASE_MANUAL_SETUP.sql` is generated from the files in `migrations/` by `npm run build:setup-sql`, and a test fails if the two drift apart. Do not edit it by hand, and never run it again on a database that already holds data.

### Alternative: command line

From a trusted machine with Node.js 20.9 or newer, in a clone of the repository:

```bash
npm ci
export DATABASE_URL='postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@<SESSION_POOLER_HOST>:5432/postgres?sslmode=require'
npm run db:migrate                 # dry run: lists pending migrations and changes nothing
npm run db:migrate -- --apply      # applies them in order, each file in its own transaction
```

Use this route for **upgrades** as well: it applies only what is missing, records each file with its SHA-256 in `schema_migrations`, and refuses to touch a database it cannot account for. A database you set up by hand from the SQL files is recognised once you tell the runner what it already contains (for example `npm run db:migrate -- --baseline 0010`). The scripts read the process environment only, not `.env.local`, so a production connection string is never picked up by accident.

Use the *session pooler* (port 5432) or the direct connection for migrations and for `npm run users`. Use the *transaction pooler* (port 6543) only for the running application on Vercel.

## 3. Connection strings

Dashboard → **Connect** shows them with your project reference filled in. Copy the exact host from there.

| Used by | Connection | Port |
| --- | --- | --- |
| Vercel (`DATABASE_URL`) | Transaction pooler, `?sslmode=require` | 6543 |
| `npm run db:migrate` and `npm run users` | Session pooler (or direct if your network has IPv6) | 5432 |

The pooler user name is `postgres.<PROJECT_REF>`, not plain `postgres`. The application already disables prepared statements and keeps one connection per function instance, which the transaction pooler requires. If you see `prepared statement ... does not exist`, you are not running this code version.

`sslmode=require` encrypts the connection but, like `psql`, does not verify the server's certificate.

The role you connect with must be the table owner or bypass Row Level Security. Supabase's `postgres` role is both, and the tables are created by it. A different role would see empty tables.

## 4. API URL and secret key (for Storage)

Dashboard → **Project Settings → API** (or **API Keys**).

* `SUPABASE_URL` is the project URL, `https://<PROJECT_REF>.supabase.co`. In production it must be https.
* `SUPABASE_SERVICE_ROLE_KEY` is a **secret** server-side key. Both formats work: the newer `sb_secret_…` key and the legacy `service_role` JWT (starts with `eyJ`). Never use the *publishable/anon* key here, never put either key in browser code, and never commit it. The code sends `sb_secret_…` keys only in the `apikey` header, as Supabase requires.

## 5. Storage buckets

Migration `0013` creates them. Confirm in **Storage**:

| Bucket | Public | Contents |
| --- | --- | --- |
| `vora-media` | **Yes** | Images uploaded through Admin → Media Library (PNG, JPEG, WebP, AVIF; up to 7 MB, or 4 MB when hosted on Vercel). |
| `vora-documents` | **No, must stay private** | Stamped receipts and customer-signed quotation approvals (PDF). Served only through authenticated admin routes, and every read checks a stored SHA-256. |

If your account's SQL role cannot write to the `storage` schema, create both buckets by hand with the same names and visibility. No storage policies are needed: the server uses the secret key, which bypasses them, and no anonymous client is meant to write.

## 6. Create the first admin

Follow `ADMIN_SETUP_GUIDE.md` §1 (`npm run users -- create you@example.com`). Run `SUPABASE_VERIFICATION.sql` again afterwards.

## 7. Security checklist

* `SUPABASE_VERIFICATION.sql` reports Row Level Security on for every public table and no `anon`/`authenticated` grants. This is what stops the public API key from reading `users`, `leads` or `invoices`. Re-run it after any manual SQL change.
* **Any table you add later must also `ENABLE ROW LEVEL SECURITY`.** Migrations `0011` and `0012` are the pattern to copy; `0011` also revokes the default grants Supabase gives to `anon` and `authenticated` for objects created by the migrating role.
* The application does not use the Data API. If your dashboard lets you stop exposing the `public` schema through it, you may do so as extra defence; nothing in VORA depends on it.
* Keep the database password and secret key out of chat, tickets and Git. Rotate them if they leak: update the Vercel variables and redeploy.
* Turn on the automated backups your plan offers and test a restore into a separate project before launch. You can also take a dump from the session pooler: `pg_dump "$DATABASE_URL" -Fc -f vora.dump`.
* Keep a copy of `MAIL_ENCRYPTION_KEY` with your backups: a restored database is useless for email without the key that encrypted the SMTP password (you can enter the password again if the key is lost).

## 8. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `SUPABASE_VERIFICATION.sql` shows `email templates seeded` FAIL | A migration is missing: run `npm run db:migrate -- --apply`. |
| `money columns are 64-bit` FAIL | Migration `0016` is missing: run `npm run db:migrate -- --apply`. |
| Pages are empty or admin lists are empty after deploy | The connecting role does not bypass RLS (wrong user). |
| `password authentication failed` | Password not URL-encoded, or you used `postgres` instead of `postgres.<PROJECT_REF>` on a pooler. |
| `Invalid JWT` on uploads | A non-secret key was used, or the key was copied with extra characters. |
| Connection timeouts from your laptop | The direct host is IPv6-only on some plans; use the session pooler. |
| Uploads fail with "Storage not configured" (503) | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel. |
| Uploads fail with "Storage provider upload failed" (502) | Wrong key, or a bucket does not exist. |
| `Database already has VORA tables but no schema_migrations record` | You set the schema up by hand; run `npm run db:migrate -- --baseline NNNN` with the last migration it contains. |
