# Admin setup guide

How to create the first admin, what the single `admin` role means, how to configure the company, and how to run the finance workflow. The admin portal lives at `/admin/login`. It is not linked from the public site and is excluded from search engines.

## 1. Create the first admin

Accounts are created from a trusted machine, never over HTTP, and there is no default password. You need the database connection (see `SUPABASE_SETUP_GUIDE.md`). The command reads only `DATABASE_URL` from the environment (not `.env.local`, so a production string is never picked up by accident).

```bash
git clone https://github.com/voraworld/voraworld.id.git && cd voraworld.id
npm ci
export DATABASE_URL='postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@<SESSION_POOLER_HOST>:5432/postgres?sslmode=require'
npm run users -- create you@voraworld.id
```

You are asked for the password twice (minimum 14 characters, never echoed and never stored in plain text). For scripted use, pipe it in: `printf '%s' "$PASSWORD" | npm run users -- create EMAIL --password-stdin`. The command prints no credential.

Then sign in at `https://<your-domain>/admin/login`. Run `SUPABASE_VERIFICATION.sql` again: the "active admin accounts" row now reads `PASS`, and the dashboard's setup checklist ticks "An administrator account exists".

### Managing accounts later

```bash
npm run users -- list
npm run users -- create EMAIL                 # another admin
npm run users -- reset-password EMAIL         # ends that account's existing sessions at once
npm run users -- deactivate EMAIL             # also ends its sessions; `activate` reverses it
```

There is no role option: every account is an `admin`. Each change is written to the audit log (with no actor, because it comes from the command line). There is no self-service password reset by email and no multi-factor sign-in yet (see `RELEASE_READINESS.md`); use strong, unique passwords and a password manager.

### Sign-in protection

* Five failed attempts for one email, or thirty from one IP address, within 15 minutes lock further attempts out for the rest of the window (the message is "Too many failed attempts. Try again later."), even with the right password. To lift a lock-out early, run in the Supabase SQL Editor: `DELETE FROM login_attempts WHERE email = 'you@voraworld.id';`
* Sessions last 8 hours, are tied to the account's current password and role (a reset, a role change or a deactivation signs the user out), and use `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Sign out is a POST.
* Rotating `SESSION_SECRET` signs everyone out.

## 2. One role: what it means

The portal has **one role, `admin`**, and it opens every menu. Whoever can sign in can do everything below. There is nothing to configure and no way to restrict a person to part of the portal.

| Category | What an admin can do there |
| --- | --- |
| **Sales** | Leads: pipeline, notes, assignee, follow-up date, CSV export, reply by email. |
| **Finance** | Customers, quotations, invoices, receipts, bank accounts; record **and confirm** payments, void documents, upload e-meterai stamped receipts, review customer-signed quotations. |
| **Website** | Pages & sections, articles, FAQs, media library, navigation, coverage, SEO and redirects. |
| **System** | Site settings (company details, legal pages), SMTP and email rules, audit log. |

**The consequence you must plan for: there is no separation of duties inside the system.** The person who records a payment can also confirm that the money has cleared, issue and void documents, change the bank accounts printed on new invoices, and change the SMTP settings. What protects you instead:

* **One account per person.** Never share a login: the audit log (`/admin/audit`) records which account did what.
* **Keep the number of accounts small** and deactivate people who leave the same day (`npm run users -- deactivate EMAIL`).
* **Confirm cleared funds only against the bank's own statement**, and review the audit log regularly, especially confirmations, voids, bank-account edits and settings changes.
* **Issued invoices keep a snapshot** of the bank details they were created with, so a later change of a bank account never alters an invoice that was already issued, but it does affect new ones.
* Treat the e-meterai upload as a review step you perform yourself: the software checks the file's structure and references, not the authenticity of the stamp.

**Accounts from the earlier multi-role version.** Only the role `admin` has access. Migration `0017` converts `superadmin` accounts to `admin` and leaves `editor`, `sales`, `finance` and `viewer` accounts untouched, so those can no longer use the portal. A fresh database created from this repository contains none of them. To give such a person access, run in the SQL Editor `UPDATE users SET role = 'admin' WHERE email = '...';` (the command line prints this statement when you try to `create` an existing email). If you later need separate roles, that is a code change (the check is `assertAdmin` in `src/server/auth/guard.ts` and the middleware), not a setting.

### The sidebar

The sidebar shows **Overview** plus four collapsible categories:

| Category | Pages |
| --- | --- |
| **Sales** | Leads |
| **Finance** | Customers, Quotations, Invoices, Receipts, Bank Accounts |
| **Website** | Pages & Sections, Articles, FAQs, Media Library, Navigation, Coverage, SEO & Redirects |
| **System** | Site Settings, SMTP & Email Rules, Audit Log |

The category containing the page you are on opens by itself; click a category title to open or close the others. On phones and small tablets the whole menu sits behind the **Menu** button.

## 3. First-time configuration checklist

The Overview page shows a **Setup checklist** with the same items, ticked automatically from what the server can see (it shows presence only, never a secret). Do these in order after the first sign-in.

1. **Site Settings** (`/admin/settings`). The approved details are pre-filled: *PT Satu Arah International*, `info@voraworld.id`, *Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810*. Add the company profile text, hours and social links. Paste the lawyer-approved **Privacy** and **Terms** HTML: until you do, those pages are empty, marked `noindex` and left out of the sitemap. No telephone or WhatsApp field exists, and none is shown publicly.
2. **Bank Accounts** (`/admin/bank-accounts`). Add every company account (bank, number, holder, currency, branch, SWIFT), mark one default per currency, and keep unused ones inactive. Each invoice snapshots the accounts you select, so later edits never alter issued invoices.
3. **SMTP & Email Rules** (`/admin/mail`).
   * Make sure `MAIL_ENCRYPTION_KEY` is set on the server first; the password cannot be saved without it.
   * Enter host, port, security (STARTTLS or SSL/TLS), username, password, from and reply-to address, and the administrator notification address; tick *Enable SMTP delivery* and save.
   * Press **Send test email to the administrator address**. A success or the exact failure appears at the top of the page. Set up SPF, DKIM and DMARC for your sending domain before real customers are emailed.
   * **Every notification rule starts disabled.** Enable the ones you want: `lead_admin` (new inquiry to you), `lead_customer` (acknowledgement), `lead_reply` (your replies from the lead page), `invoice_customer`, `payment_confirmed`, `receipt_customer`, `quotation_approval_request`, `quotation_approved_admin`. Edit the subject and HTML of any template in place.
   * The **Delivery outbox** lists every message with status, attempts and the last error. Failed sends retry automatically with growing back-off (up to five attempts, plus the daily cron); a failed message shows a **Retry** button, and **Process pending emails** sends what is due right now.
4. **Navigation**, **FAQs**, **Coverage**, **SEO & Redirects** (`/admin/navigation`, `/faq`, `/coverage`, `/seo`). A coverage region appears on the public Network page only while it is marked active, so add regions only after operations has confirmed them. Navigation links that point into the admin portal (`/admin…`, `/en/admin…`, `/id/admin…`) are rejected, and are never rendered even if one is already stored.
5. **Articles** and **Pages & Sections** (see `CMS_ADMIN_GUIDE.md`). HTML is sanitised on the server, saved as a revision, and goes live only when you publish.
6. **Media Library**. Upload PNG, JPEG, WebP or AVIF with alt text (limit 7 MB, 4 MB on Vercel). Files go to the public bucket.

## 4. Finance workflow

All amounts are calculated on the server in integer minor units with exact decimal arithmetic; the browser never supplies a total.

1. **Customer** → create it. A permanent, random owner code (for example `C82960F570E`) is assigned once and never derived from the name.
2. **Quotation** → create, then *issue*. Numbers follow `QUO-VORA-<OWNER_CODE>-<YYYYMM>-<RANDOM_5>`.
3. **Customer approval** (optional) → *Send quotation for customer approval*. The customer receives the PDF and a private, expiring link (14 days, never beyond the day after the quotation's validity), signs and stamps it, and uploads the PDF. The upload alone approves nothing: you open it (stored privately, SHA-256 recorded), then approve or reject it.
4. **Invoice** → create (up to five line items fit per page; more flow onto further pages), choose one or more bank accounts, add shipment details (service mode, origin, destination, B/L or AWB), tax and withholding percentages. *Issue* it, then *send to customer* if the rule is enabled. Numbers follow `INV-VORA-<OWNER_CODE>-<YYYYMM>-<RANDOM_5>`. **The invoice PDF states that it is a payment request and not proof of payment.**
5. **Payment** → *record payment* when the customer says they paid. It is saved as **pending confirmation**: the invoice balance does not change, no receipt exists and nothing is emailed. You can cancel a pending record.
6. **Confirm cleared funds** → only after the money has actually arrived in the company bank account, tick the confirmation and confirm. Now, atomically: the payment becomes recorded, the invoice moves to *partially paid* or *paid*, an `RCP-VORA-…` receipt is created with its QR verification, and the `payment_confirmed` and `receipt_customer` emails are queued. If two people press confirm at the same moment, exactly one succeeds.
7. **E-meterai** → a receipt for more than IDR 5,000,000, or in any foreign currency, is withheld (`pending e-meterai`). Download the draft, apply an authentic e-meterai through an authorised provider **outside** this system, then upload the stamped PDF with the provider reference. The system checks that the file is a readable PDF that still contains the receipt and invoice numbers and no active content, stores it privately, records its SHA-256, and only then releases it to the customer. The software does not verify the stamp itself; that review is yours.
8. **Verification** → the QR on each document opens `/verify/<token>`, which shows only type, reference, issuer, date and current status (AUTHENTIC, VOID, PENDING E-METERAI, or DRAFT; for an invoice also AWAITING PAYMENT, PARTIALLY PAID or OFFICIALLY PAID). Customer and amounts are never shown. A QR proves the issuer's record, not that a PDF is unaltered: for high-value settlements compare against your own records.
9. **Void** → voiding a receipt reverses its payment and recalculates the invoice; voiding a document revokes its verification link; voiding an invoice cancels its open payment claims.

Document references and owner codes are permanent. Never edit them in the database.

## 5. Routine operations

* **Audit log** (`/admin/audit`): sign-ins, creations, status changes, confirmations, stamp uploads, retries, account changes made with the command line.
* **Leads** (`/admin/leads`): status pipeline, notes, assignee, follow-up date, CSV export, **Reply by email** (needs SMTP on and the `lead_reply` rule enabled; the reply is kept on the lead's timeline).
* **Back up** the database before every schema change, and keep a copy of `MAIL_ENCRYPTION_KEY`.
* **Upgrading the database**: `npm run db:migrate` (dry run) then `npm run db:migrate -- --apply`; never re-run `SUPABASE_MANUAL_SETUP.sql` on a database that has data.
