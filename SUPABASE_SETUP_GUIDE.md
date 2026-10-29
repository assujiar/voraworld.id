# Supabase setup guide

You do these steps in your own Supabase account. The repository never contacts Supabase by itself, and nothing here has been run against a live Supabase project (see `RELEASE_READINESS.md` for what is verified locally and what still needs a live check).

What VORA uses from Supabase:

| Feature | How the app uses it |
| --- | --- |
| PostgreSQL | All data, through a server-side connection string (`DATABASE_URL`). |
| Storage | Two buckets, reached with the server-side secret key: `vora-media` (public) and `vora-documents` (private). |
| Auth / Realtime / Data API / Edge Functions | **Not used.** Admin sign-in is VORA's own (PBKDF2, signed cookies). |

## 1. Create a dedicated project

1. Dashboard → **New project**. Use a new project for VORA only; do not reuse a project that belongs to another application.
2. Pick the region closest to your users and to your Vercel function region (for Jakarta customers, Singapore `ap-southeast-1` is a sensible choice).
3. Set a long random database password and store it in your password manager. If it contains characters such as `@ : / ? # %`, URL-encode them when you place it in a connection string (for example `@` becomes `%40`). Letters and digits only is simplest.

## 2. Create the schema (once, on the empty database)

1. Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of `SUPABASE_MANUAL_SETUP.sql` and click **Run**. It creates every table (migrations `0001`–`0014`), enables Row Level Security, seeds the approved contact details and the email templates, creates the two storage buckets and records the migration history.
3. Open a new query, paste `SUPABASE_VERIFICATION.sql` and run it. **Every row must say `PASS`** (`INFO` rows are informational). The superadmin row reads `INFO` until you create the first admin in `ADMIN_SETUP_GUIDE.md`. Any `FAIL` means stop and fix before continuing.

`SUPABASE_MANUAL_SETUP.sql` is generated from the files in `migrations/` by `python scripts/build_manual_setup.py`, and a test fails if the two drift apart. Do not edit it by hand.

### Alternative: command line

From a trusted machine with Python 3.13:

```bash
pip install -r requirements.txt
export DATABASE_URL='postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@<SESSION_POOLER_HOST>:5432/postgres?sslmode=require'
python scripts/apply_migrations.py            # dry run: lists pending migrations
python scripts/apply_migrations.py --apply    # applies them in order, each in its own transaction
```

Use this route for **upgrades** as well: it applies only what is missing and refuses to touch a database it cannot account for. A database you set up by hand from the SQL files is recognised once you tell the runner what it already contains (for example `--baseline 0010`).

Use the *session pooler* (port 5432) or the direct connection for migrations and for the admin CLI. Use the *transaction pooler* (port 6543) only for the running application.

## 3. Connection strings

Dashboard → **Connect** shows them with your project reference filled in.

| Used by | Connection | Port |
| --- | --- | --- |
| Vercel (`DATABASE_URL`) | Transaction pooler, `?sslmode=require` | 6543 |
| Migrations and `scripts/manage_users.py` | Session pooler (or direct if your network has IPv6) | 5432 |

The pooler user name is `postgres.<PROJECT_REF>`, not plain `postgres`. The application already disables prepared statements and connection pooling inside serverless instances, which the transaction pooler requires. If you see `prepared statement ... does not exist` you are almost certainly not running this code version.

The role you connect with must bypass Row Level Security, which Supabase's `postgres` role does. A role that does not would see empty tables.

## 4. API URL and secret key (for Storage)

Dashboard → **Project Settings → API** (or **API Keys**).

* `SUPABASE_URL` is the project URL, `https://<PROJECT_REF>.supabase.co`.
* `SUPABASE_SERVICE_ROLE_KEY` is a **secret** server-side key. Both formats work: the legacy `service_role` JWT (starts with `eyJ`) and the newer `sb_secret_…` key. Never use the *publishable/anon* key here, never put either key in browser code, and never commit it. The code sends `sb_secret_…` keys only in the `apikey` header, as Supabase requires.

## 5. Storage buckets

Migration `0013` creates them. Confirm in **Storage**:

| Bucket | Public | Contents |
| --- | --- | --- |
| `vora-media` | **Yes** | Images uploaded through Admin → Media Library (PNG, JPEG, WebP, AVIF; up to 7 MB, or 4 MB when hosted on Vercel). |
| `vora-documents` | **No, must stay private** | Stamped receipts and customer-signed quotation approvals (PDF). Served only through authenticated admin routes, and every read checks a stored SHA-256. |

If your account's SQL role cannot write to the `storage` schema, create both buckets by hand with the same names and visibility. No storage policies are needed: the server uses the secret key, which bypasses them, and no anonymous client is meant to write.

## 6. Security checklist

* `SUPABASE_VERIFICATION.sql` reports Row Level Security on for every public table and no `anon`/`authenticated` grants. This is what stops the public API key from reading `users`, `leads` or `invoices`. Re-run it after any manual SQL change.
* **Any table you add later must also `ENABLE ROW LEVEL SECURITY`.** Migration `0012` is the pattern to copy.
* The application does not use the Data API. If your dashboard lets you stop exposing the `public` schema through it, you may do so as extra defence; nothing in VORA depends on it.
* Keep the database password and secret key out of chat, tickets and Git. Rotate them if they leak: update the Vercel variables and redeploy.
* Turn on the automated backups your plan offers and test a restore into a separate project before launch. You can also take a dump with `pg_dump "$DATABASE_URL_SESSION" -Fc -f vora.dump` from the session pooler.

## 7. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `SUPABASE_VERIFICATION.sql` shows `email templates seeded` FAIL | Migration `0014` is missing: run `python scripts/apply_migrations.py --apply`. |
| Pages are empty or admin lists are empty after deploy | The connecting role does not bypass RLS (wrong user). |
| `password authentication failed` | Password not URL-encoded, or you used `postgres` instead of `postgres.<PROJECT_REF>` on a pooler. |
| `Invalid JWT` on uploads | A non-secret key was used, or an old build sent `sb_secret_…` as a Bearer token. Use the current code. |
| Connection timeouts from your laptop | The direct host is IPv6-only on some plans; use the session pooler. |
| `Storage not configured` (503) | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel. |
