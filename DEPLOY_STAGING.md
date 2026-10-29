# Staging deployment: Vercel + Supabase

**Status: prepared, not deployed.** Nothing here has been run against a real Vercel or Supabase account. The code was verified locally against PostgreSQL 16 (all migrations applied, ORM/schema drift check, production-mode smoke test, 15 tests). Do not attach the live domain, and do not merge to `main`, until the owner approves.

This supersedes the "Preview-only deployment" parts of `DEPLOY.md`; read that file for the full product caveats.

## What changed for hosting compatibility

| Area | Change |
| --- | --- |
| `vercel.json` | Removed legacy `builds`/`routes` (they disable Project Settings). Zero-config FastAPI entrypoint `app/index.py`; test/QA/docs/original PNG sources excluded from the bundle. |
| Python | `.python-version` = 3.13 (the version the suite was run on). |
| Dependencies | `requirements.txt` is runtime-only; `pytest`/`httpx` moved to `requirements-dev.txt`. |
| Database | Prepared statements disabled (`prepare_threshold=None`) so the Supabase transaction pooler (port 6543) works; `NullPool` on Vercel. |
| Uploads | On Vercel the upload limit is 4 MB (platform body limit is 4.5 MB). Override with `MAX_UPLOAD_BYTES`. |
| Guard | App refuses to start on Vercel unless `APP_ENV=production` (read-only filesystem, no SQLite). |
| Supabase security | Migration `0011_enable_rls.sql`: RLS on every public table and no anon/authenticated grants. The app uses a server-side Postgres connection, so the Data API needs no access. Without it the anon key can read `users`, `leads`, `invoices`. |
| Migrations | `scripts/apply_migrations.py`: ordered, recorded, dry-run by default. |

## Steps (each needs the owner's account; none was done for you)

1. **Supabase**: create a *new* project for VORA staging (the existing `cargogrid.app` project is unrelated; do not reuse it). Create storage buckets `vora-media` (public) and `vora-documents` (**private**).
2. **Migrate** from a trusted machine, using the *Session pooler or direct* connection string (DDL is safer there than on port 6543):
   ```bash
   pip install -r requirements.txt
   export DATABASE_URL='postgresql://postgres.<ref>:<URL-ENCODED-PASSWORD>@<host>:5432/postgres?sslmode=require'
   python scripts/apply_migrations.py            # dry run
   python scripts/apply_migrations.py --apply    # applies 0001-0011
   ```
   The connecting role must bypass RLS (Supabase's `postgres` role does). Otherwise the app would silently see empty tables.
3. **Admin user** (one time, same shell): `python scripts/create_admin.py`.
4. **Vercel**: import this repo, branch `staging` as the Preview branch, keep the project **private** (Deployment Protection on, *Standard Protection* or stronger) and do not add the production domain. Framework preset: FastAPI/Python, root directory `.`.
5. **Environment variables** (Preview scope only; secrets as Sensitive):

   | Variable | Value |
   | --- | --- |
   | `APP_ENV` | `production` (this is the app's hardened mode, not the live site) |
   | `DATABASE_URL` | Transaction pooler URI, port 6543, `?sslmode=require` |
   | `PUBLIC_BASE_URL` | The stable staging URL, e.g. a branch alias. It is baked into QR codes. |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From the new project; server-side only |
   | `SUPABASE_STORAGE_BUCKET`, `SUPABASE_DOCUMENTS_BUCKET` | `vora-media`, `vora-documents` |
   | `MAIL_ENCRYPTION_KEY` | Fernet key (see `.env.example`); back it up |
   | `CRON_SECRET` | 32+ random chars (Vercel Cron sends it as `Authorization: Bearer`) |

6. **Verify** on the protected staging URL: `/en/`, `/id/`, `/admin/login`, create a test lead, issue a test quotation/invoice and scan its QR. Check `/robots.txt`.

## Known hosting limits

- Request bodies over 4.5 MB are rejected by Vercel, and so are responses over 4.5 MB. Large e-meterai PDFs may upload but not download.
- Do not set `DATABASE_URL` to SQLite or leave `APP_ENV` unset on Vercel.
- Vercel Cron frequency depends on the plan; `/internal/mail/dispatch` is unscheduled until you configure it.
- Preview URLs change per deployment; use a stable alias for `PUBLIC_BASE_URL` or earlier QR codes will point at dead hosts.
