# VORA: deploying to Vercel + Supabase (https://voraworld.id)

The application is Next.js + React + TypeScript only. Sign-in is Supabase Auth, the database is reached through the Supabase Data API and
database functions, and files live in Supabase Storage. There is **no** `DATABASE_URL`, no `SESSION_SECRET`, no Python and no second backend.

Do the steps in order. Steps 1-4 are done once; step 5 onward is also what you repeat for a redeploy.

## 1. Supabase: database (SQL Editor)

* **New project:** paste `SUPABASE_MANUAL_SETUP.sql` and run it once.
* **Project that already has VORA tables (migrations 0001-0022 applied):** run these two files, in this order, one after the other:
  `migrations/0023_supabase_auth.sql`, then `migrations/0024_data_api.sql`.
* **Project that was set up with 0024 (and 0025) already:** run `migrations/0025_deliveries.sql` if it is not there yet, then `migrations/0026_commercial_workflow.sql` (Phase 3A: the customer is the commercial entity; lead optional; validated quotations; delivery notes and invoices linked to them; one email with two PDFs). Both are forward-only and safe to run once; each records itself in `schema_migrations`.
* After 0026, in *Admin > SMTP & Email Rules* switch on the rules the new workflow uses: `quotation_customer_approved_admin` (tells you the customer uploaded a signature), `quotation_validated_customer` (tells the customer the quotation is validated), and `invoice_customer` (the one email with the invoice and the pre-payment receipt). Every rule starts off.
* Then run `SUPABASE_VERIFICATION.sql`. Every line must say PASS (or INFO/WARN with a reason you accept). Any FAIL: stop and fix before continuing.

Run the SQL **before** you deploy: the new code calls the functions that 0024, 0025 and 0026 create. Without 0026 the customer, quotation, delivery and invoice pages fail on columns and functions that do not exist yet.

## 2. Supabase: Authentication

* *Authentication > Sign In / Providers > Email:* turn **off** "Allow new users to sign up". Administrators are created by you, nobody can register.
* *Authentication > URL Configuration:* Site URL `https://voraworld.id`; Redirect URLs: add `https://voraworld.id/**`.
* Recommended: *Project Settings > Authentication > SMTP Settings*: your own SMTP, so password-reset emails are not limited by Supabase's shared sender.

## 3. Supabase: the first administrator

1. *Authentication > Users > Add user > Create new user:* email and a password of 14+ characters, tick **Auto Confirm User**.
2. *SQL Editor:* `select public.promote_admin('that-email@company.com');`

More administrators: the same two steps. To remove access: `select public.deactivate_admin('email');` (effective on their next request).

## 4. Supabase: Storage

`vora-media` (public) and `vora-documents` (**private**) are created by the SQL in step 1. `SUPABASE_VERIFICATION.sql` checks both.

## 5. Vercel: project settings

Project `voraworld.id` (team VORAWORLD) > Settings:

* *Git:* repository `voraworld/voraworld.id`, **Production Branch `main`**.
* *General / Build:* Framework Preset **Next.js**, **Root Directory empty**, Build Command / Output Directory / Install Command left on default.
* *Deployment Protection:* **Vercel Authentication off for Production** (otherwise visitors are asked to log in to Vercel).

## 6. Vercel: environment variables (Production)

Required, three values (they already exist if the Supabase integration is connected; do not recreate them):

| Name | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable (or legacy anon) key |
| `SUPABASE_SECRET_KEY` | the secret (or legacy service_role) key. Server only; never in a `NEXT_PUBLIC_` variable |

Optional: `MAIL_ENCRYPTION_KEY` (`openssl rand -base64 32`, needed to save an SMTP password in the admin), `CRON_SECRET` (`openssl rand -hex 32`, protects the daily
mail retry). Leave `PUBLIC_BASE_URL` empty: in production it is `https://voraworld.id`.

No longer used, safe to delete **after** the site works: `DATABASE_URL`, `POSTGRES_URL*`, `SESSION_SECRET`, `SUPABASE_JWT_SECRET`.

`NEXT_PUBLIC_*` values are written into the build: after changing one, **redeploy**.

### Document trust (migration 0029): extra variables and one-time steps

Apply `migrations/0029_document_trust.sql` like the others (it is additive; nothing is applied for you). Then make VORA's issuance attestation key: `npx tsx scripts/provision-attestation-key.ts <key-id>`. It prints `VORA_ATTESTATION_KEY_ID` and `VORA_ATTESTATION_PRIVATE_KEY` (set both in Vercel, the second as **Sensitive**, never committed) and the SQL that registers the public key. Without the key the application still archives and fingerprints, and says on the verification page that no attestation was available. `PUBLIC_BASE_URL` must be `https://voraworld.id`: it is the passkey origin. Rotation, compromise and the post-deploy checks are in `DOCUMENT_TRUST.md` section 12.

## 7. Deploy

Merge to `main` (Vercel deploys by itself), or *Deployments > latest > Redeploy*.

## 8. Domain

*Settings > Domains:* add `voraworld.id` (and `www.voraworld.id`, redirecting to it). Create the DNS records Vercel shows at the domain's DNS host
(normally an `A` record `76.76.21.21` for the apex and a `CNAME` `cname.vercel-dns.com` for `www`). Wait for "Valid Configuration".

## 9. Check it works

```bash
curl -sI https://voraworld.id/en            # 200
curl -sI https://voraworld.id/admin/login   # 200
curl -sI https://voraworld.id/admin         # 307 to /admin/login
```

Open `/en` in a private window (no Vercel login), then sign in at `/admin/login` with the administrator from step 3.

## If something fails

| Symptom | Cause |
|---|---|
| Vercel asks visitors to log in | step 5, Deployment Protection |
| 500 on every page, log says `NEXT_PUBLIC_SUPABASE_URL ... is required` | step 6, a variable is missing; redeploy after adding |
| 500 on pages that read data, `permission denied` or `function ... does not exist` | step 1 was not run (0023 and 0024) |
| Login says "Invalid login details" for a good password | step 3.2 was not run (`promote_admin`), or the account is not confirmed |
| Reset email link opens an error | step 2, Redirect URLs |
| Document QR codes point at another host | `PUBLIC_BASE_URL` is set to something else; clear it |

Removing a signer needs `migrations/0030_signer_profile_removal.sql` (additive; run it in the Supabase SQL editor like 0029). Until it is applied, the Remove button answers that the migration is missing; nothing else depends on it.
