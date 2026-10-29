# Vercel setup guide

You do these steps in your own Vercel account. Nothing in this repository creates a project, sets a variable or deploys. Complete `SUPABASE_SETUP_GUIDE.md` first: you need its connection string, URL and key.

## What the repository already contains

| File | Purpose |
| --- | --- |
| `app/index.py` | The serverless entrypoint (`from vora.main import app`). Vercel detects it as a FastAPI app. |
| `vercel.json` | Function limits (30 s), files left out of the bundle, and one daily cron (see §5). No legacy `builds`/`routes`. |
| `requirements.txt` | Runtime dependencies only. Test tools live in `requirements-dev.txt` and are not installed on Vercel. |
| `.python-version` | `3.13`. |
| `.vercelignore` | Keeps the upload small (tests, docs, scripts). |

There is no build step. Leave **Build Command**, **Output Directory** and **Install Command** empty.

## 1. Import the project

1. Vercel → **Add New → Project** → import `voraworld/voraworld.id`.
2. **Framework Preset:** leave on auto-detect (FastAPI/Python) or choose *Other*. **Root Directory:** `.` (repository root).
3. Do not click Deploy yet. Add the environment variables first (§2), otherwise the first build starts without them. (If you already deployed, add them and redeploy.)

## 2. Environment variables

**Project → Settings → Environment Variables.** Add every row for **Production**, and again for **Preview** if you want protected preview deployments to work. Mark secrets as **Sensitive**.

| Variable | Value | Secret |
| --- | --- | --- |
| `APP_ENV` | `production` (**always**, previews included: the app refuses to start on Vercel otherwise) | |
| `DATABASE_URL` | Supabase **transaction pooler** URI, port 6543, ending `?sslmode=require` | yes |
| `PUBLIC_BASE_URL` | Final public origin, e.g. `https://voraworld.id` (https, no trailing slash) | |
| `SESSION_SECRET` | 32+ random characters: `openssl rand -hex 32` | yes |
| `SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (`sb_secret_…` or legacy `service_role`) | yes |
| `SUPABASE_STORAGE_BUCKET` | `vora-media` | |
| `SUPABASE_DOCUMENTS_BUCKET` | `vora-documents` | |
| `MAIL_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. **Back it up**; losing it makes the saved SMTP password unreadable. | yes |
| `CRON_SECRET` | 32+ random characters (`openssl rand -hex 32`) | yes |

Optional: `MAX_UPLOAD_BYTES` (defaults to 4,000,000 on Vercel; do not raise it above 4,500,000, which is Vercel's request-body limit) and `DB_NULL_POOL` (not needed on Vercel).

Why `PUBLIC_BASE_URL` matters: it is printed into the QR code of every invoice, receipt and quotation, and used in emails. **Set it to the permanent production domain before issuing any real document.** A QR code minted against a staging host keeps pointing there forever.

The application checks its configuration at start-up and fails loudly: `Production requires persistent PostgreSQL DATABASE_URL`, `Production requires HTTPS PUBLIC_BASE_URL…`, `SESSION_SECRET must contain >=32 random characters…`. A 500 on the very first request almost always means one of these variables is missing; read **Deployments → (deployment) → Runtime Logs**.

## 3. Region

**Settings → Functions → Function Region:** choose the region nearest your Supabase project (for Supabase Singapore, `sin1`). A function in the wrong continent makes every page several database round trips slower.

## 4. Protection, domain and first deploy

1. For a first look, deploy and keep **Settings → Deployment Protection** enabled so only your team can open the deployment URL. Disable it only when you decide to go public.
2. Production deploys come from the Production Branch (`main` by default). Every push to `main` therefore deploys to Production, so if you want an approval gate, change the Production Branch in **Settings → Git** or protect `main` on GitHub.
3. **Domains:** add `voraworld.id` and `www.voraworld.id` yourself when you are ready (and follow Vercel's DNS instructions). Nothing here does that for you.
4. After `PUBLIC_BASE_URL` points at the domain, redeploy so every function picks it up.

## 5. Scheduled email retry

`vercel.json` contains one cron: `GET /internal/mail/dispatch` once a day at 03:00 UTC. The endpoint requires `Authorization: Bearer <CRON_SECRET>`, which Vercel sends automatically when `CRON_SECRET` is defined, and answers 401 otherwise. Emails are also dispatched immediately after the action that queues them; the cron only retries what failed.

* Cron jobs run on the **Production** deployment only.
* The Hobby plan allows one run per day. On Pro you can raise the frequency by editing `schedule` (for example `"*/10 * * * *"`). Check Vercel's current plan limits first: a schedule your plan does not allow makes the deployment fail.
* **Settings → Cron Jobs** shows the job and lets you run it for a test.

## 6. Verify the deployment

Replace `HOST` with the deployment URL (use a browser first if protection is on).

```bash
curl -sI https://HOST/en/                   # 200, with Strict-Transport-Security and Content-Security-Policy
curl -s  https://HOST/robots.txt            # Disallow: /admin and /verify
curl -sI https://HOST/api/docs              # 404 (API docs are off in production)
curl -s -o /dev/null -w '%{http_code}\n' https://HOST/internal/mail/dispatch                                   # 401
curl -s -w '\n%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" https://HOST/internal/mail/dispatch      # {"sent":0,"failed":0} 200
```

Then sign in at `https://HOST/admin/login` with the account from `ADMIN_SETUP_GUIDE.md`. The `/admin` pages are intentionally not linked from the public site.

## 7. Limits to know

* Request **and** response bodies are capped at 4.5 MB. Uploads are limited to 4 MB on Vercel; a stamped receipt PDF larger than about 4.5 MB could be stored but not downloaded.
* The filesystem is read-only. All uploads go to Supabase Storage; nothing relies on local disk.
* Each cold start imports the whole app; the first request after idle can take a couple of seconds.
* Rollback: **Deployments → … → Instant Rollback** reverts code. Database migrations are forward-only, so never roll the code back past a migration that has already run without checking compatibility.

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| Build succeeds, every page 500 | Runtime logs; a missing/invalid variable from §2. |
| `Vercel deployments must set APP_ENV=production` | `APP_ENV` is missing or wrong in that environment (Production vs Preview). |
| Admin pages are empty | `DATABASE_URL` points at the wrong database/role (see the RLS note in the Supabase guide). |
| `prepared statement … does not exist` | Port 6543 with an older build; deploy the current code. |
| Image/PDF upload fails with 413 | File above 4 MB. |
| Image/PDF upload fails with 502/503 | `SUPABASE_URL` / key wrong, or the bucket does not exist. |
| QR codes point to a preview URL | `PUBLIC_BASE_URL` was set to a preview host when the document was created. |
