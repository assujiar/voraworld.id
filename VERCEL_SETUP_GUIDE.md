# Vercel setup guide

You do these steps in your own Vercel account. Nothing in this repository creates a project, sets a variable or deploys. Complete `SUPABASE_SETUP_GUIDE.md` first: you need its connection string, URL and key.

## What the repository already contains

| File | Purpose |
| --- | --- |
| `package.json` | `engines.node >= 20.9`; `npm run build` is `next build`. Vercel runs it by itself. |
| `vercel.json` | `framework: nextjs` and one daily cron (see §5). No legacy `builds`/`routes`, so project settings stay in charge. |
| `next.config.ts` | Security headers and Content-Security-Policy, `noindex` headers for private pages, the `/` → `/en` redirect. |
| `src/instrumentation.ts` | Checks the configuration when the server starts and refuses to run on an unsafe one (§2). |

Leave **Build Command**, **Output Directory** and **Install Command** on their defaults. There are no `NEXT_PUBLIC_*` variables: no setting is ever sent to the browser.

## 1. Import the project

1. Vercel → **Add New → Project** → import `voraworld/voraworld.id`.
2. **Framework Preset:** Next.js (detected from `vercel.json`). **Root Directory:** `.` (repository root). **Node.js Version** (in the project's Settings): the newest LTS offered; the code needs 20.9 or newer and was tested on 22.
3. Do not click Deploy yet. Add the environment variables first (§2), otherwise the first build starts without them. (If you already deployed, add them and redeploy.)
4. **Production Branch** is `main` by default, so every push to `main` deploys to Production. If you want an approval gate, change the Production Branch under **Settings → Git** or protect `main` on GitHub.

## 2. Environment variables

**Project → Settings → Environment Variables.** Mark secrets as **Sensitive**.

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
| `MAIL_ENCRYPTION_KEY` | 32 random bytes, base64: `openssl rand -base64 32`. **Back it up**; losing it makes the saved SMTP password unreadable (you would enter it again). | yes |
| `CRON_SECRET` | 32+ random characters: `openssl rand -hex 32` | yes |

Optional: `MAX_UPLOAD_BYTES` (defaults to 4,000,000 on Vercel; do not raise it above 4,500,000, which is Vercel's request-body limit) and `DB_POOL_MAX` (ignored on Vercel, which always uses one connection per function instance). `.env.example` lists every variable the code reads, with comments; a test keeps it complete.

**Production only, or a separate database for previews.** A Preview deployment that has the production `DATABASE_URL` works on live data, and every document it issues carries a QR code that points at the preview host. Either give previews no variables (they will simply refuse to start), or point them at a separate Supabase project with their own `SESSION_SECRET`, and keep **Deployment Protection** on for previews.

Why `PUBLIC_BASE_URL` matters: it is printed into the QR code of every invoice, receipt and quotation, and used in emails. **Set it to the permanent production domain before issuing any real document.** A QR code minted against a staging host keeps pointing there forever.

The application checks its configuration when the server starts and fails loudly, with a message in **Deployments → (deployment) → Runtime Logs**:

* `DATABASE_URL is required` / `DATABASE_URL must be a PostgreSQL URL`
* `Production requires an HTTPS PUBLIC_BASE_URL (it is printed into document QR codes)`
* `SESSION_SECRET must contain >=32 random characters in production` (a value starting with `replace-` is refused too)
* `Vercel deployments must run with APP_ENV=production (or leave APP_ENV unset)`

A 500 on the very first request almost always means one of these variables is missing or wrong.

## 3. Region

**Settings → Functions → Function Region:** choose the region nearest your Supabase project (for Supabase Singapore, `sin1`). Pages are rendered per request and each one reads the database, so a function in the wrong continent makes every page several round trips slower.

## 4. Protection, domain and first deploy

1. For a first look, deploy and keep **Settings → Deployment Protection** enabled so only your team can open the deployment URL. Disable it only when you decide to go public.
2. **Domains:** add `voraworld.id` and `www.voraworld.id` yourself when you are ready (and follow Vercel's DNS instructions). Nothing here does that for you.
3. Once `PUBLIC_BASE_URL` points at the domain, redeploy so every function picks it up.
4. Create the first admin (`ADMIN_SETUP_GUIDE.md` §1) before you try to sign in; there is no default account.

## 5. Scheduled email retry

`vercel.json` contains one cron: `GET /internal/mail/dispatch` once a day at 03:00 UTC. The endpoint requires the exact header `Authorization: Bearer <CRON_SECRET>`, which Vercel sends automatically when `CRON_SECRET` is defined, and answers 401 to everything else (also when the secret is shorter than 32 characters). Emails are also dispatched right after the response that queues them; the cron only retries what failed.

* Cron jobs run on the **Production** deployment only.
* The Hobby plan allows one run per day. On Pro you can raise the frequency by editing `schedule` (for example `"*/10 * * * *"`). Check Vercel's current plan limits first: a schedule your plan does not allow makes the deployment fail.
* **Settings → Cron Jobs** shows the job and lets you run it for a test. Admin → SMTP & Email Rules has **Process pending emails** for the same purpose.

## 6. Verify the deployment

Replace `HOST` with the deployment URL (use a browser first if protection is on).

```bash
curl -sI https://HOST/                      # 307 to /en
curl -sI https://HOST/en                    # 200, with Strict-Transport-Security and Content-Security-Policy
curl -s  https://HOST/robots.txt            # Disallow: /admin, /verify, /quotation-approval and the sitemap line
curl -sI https://HOST/admin                 # 307 to /admin/login, with X-Robots-Tag: noindex, nofollow
curl -s -o /dev/null -w '%{http_code}\n' https://HOST/internal/mail/dispatch                                   # 401
curl -s -w '\n%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" https://HOST/internal/mail/dispatch      # {"sent":0,"failed":0,"reason":"SMTP disabled"} then 200 (until SMTP is switched on)
```

Then sign in at `https://HOST/admin/login` with the account from `ADMIN_SETUP_GUIDE.md`. The `/admin` pages are intentionally not linked from the public site. The dashboard's **Setup checklist** tells you what is still missing.

## 7. Limits to know

* Request **and** response bodies are capped at 4.5 MB. Uploads are limited to 4 MB on Vercel (images 7 MB elsewhere); a stamped receipt PDF larger than about 4.5 MB could be stored but not downloaded.
* The filesystem is read-only. All uploads go to Supabase Storage; nothing relies on local disk.
* Each cold start loads the whole app; the first request after idle can take a couple of seconds.
* Rollback: **Deployments → … → Instant Rollback** reverts code. Database migrations are forward-only, so never roll the code back past a migration that has already run without checking compatibility.

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| Build succeeds, every page 500 | Runtime logs; a missing or invalid variable from §2. |
| `Vercel deployments must run with APP_ENV=production` | `APP_ENV` is wrong in that environment (Production vs Preview). |
| Admin pages are empty | `DATABASE_URL` points at the wrong database or role (see the RLS note in the Supabase guide). |
| `prepared statement … does not exist` | You are not running this code version, or `DATABASE_URL` is not the pooler URL the code was built for; redeploy the current code. |
| Sign-in says "Too many failed attempts. Try again later." | Five failures for an email, or thirty from one IP address, within 15 minutes; wait it out (`ADMIN_SETUP_GUIDE.md` §1 shows how to clear it). |
| Image/PDF upload fails with 413 | File above the upload ceiling (4 MB on Vercel). |
| Image/PDF upload fails with 502/503 | `SUPABASE_URL` / key wrong, or the bucket does not exist. |
| QR codes point to a preview URL | `PUBLIC_BASE_URL` was set to a preview host when the document was created. Issue the document again from the production deployment. |
