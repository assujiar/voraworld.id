# Admin setup guide

How to create the first superadmin, configure the company, and run the finance workflow. The admin portal lives at `/admin/login`. It is not linked from the public site and is excluded from search engines.

## 1. Create the first superadmin

Accounts are created from a trusted machine, never over HTTP, and there is no default password. You need the database connection (see `SUPABASE_SETUP_GUIDE.md`) and the app's variables.

```bash
git clone https://github.com/voraworld/voraworld.id.git && cd voraworld.id
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export APP_ENV=production
export DATABASE_URL='postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@<SESSION_POOLER_HOST>:5432/postgres?sslmode=require'
export PUBLIC_BASE_URL='https://voraworld.id'
export SESSION_SECRET="$(openssl rand -hex 32)"    # any 32+ characters; the CLI does not sign sessions
python scripts/manage_users.py create you@voraworld.id --role superadmin
```

You are asked for the password twice (minimum 14 characters, never echoed or stored in plain text). For scripted use, pipe it in: `printf '%s' "$PASSWORD" | python scripts/manage_users.py create EMAIL --role superadmin --password-stdin`. The older `python scripts/create_admin.py EMAIL` still works and does the same.

Then sign in at `https://<your-domain>/admin/login`. Run `SUPABASE_VERIFICATION.sql` again: the "active superadmin accounts" row now reads `PASS`.

### Managing accounts later

```bash
python scripts/manage_users.py list
python scripts/manage_users.py create EMAIL --role finance        # superadmin, admin, editor, sales, finance, viewer
python scripts/manage_users.py set-role EMAIL editor
python scripts/manage_users.py reset-password EMAIL               # ends that user's existing sessions at once
python scripts/manage_users.py deactivate EMAIL                   # also ends their sessions; `activate` reverses it
```

Every change is written to the audit log. There is no self-service password reset by email and no multi-factor sign-in yet (see `RELEASE_READINESS.md`); use strong, unique passwords and a password manager.

### Sign-in protection

* Five failed attempts for one email, or thirty from one IP address, within 15 minutes lock further attempts out for the rest of the window (HTTP 429), even with the right password.
* Sessions last 8 hours, are tied to the account's current password (a reset signs the user out), and use `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Sign out is a POST with a CSRF token.
* Rotating `SESSION_SECRET` signs everyone out.

## 2. Roles

| Role | Content (articles, pages, media, FAQ, navigation) | CRM (leads) | Finance (customers, bank accounts, quotations, invoices, payments, receipts) | Settings (company, SMTP, SEO, coverage, audit log) |
| --- | :-: | :-: | :-: | :-: |
| `superadmin` | ✔ | ✔ | ✔ | ✔ |
| `admin` | ✔ | ✔ | ✔ | ✔ |
| `editor` | ✔ | | | |
| `sales` | | ✔ | | |
| `finance` | | | ✔ | |
| `viewer` | | | | |

Every admin route enforces this on the server, and a test enumerates the live route table to prove anonymous users get 401 and unprivileged users get 403. Every signed-in user can open the Overview.

## 3. First-time configuration checklist

Do these in order after the first sign-in.

1. **Site Settings** (`/admin/settings`). The approved details are pre-filled: *PT Satu Arah International*, `info@voraworld.id`, *Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810*. Add the company profile text, hours and social links. Paste the lawyer-approved **Privacy** and **Terms** HTML: until you do, those pages are empty and marked `noindex`. No telephone or WhatsApp field exists, and none is shown publicly.
2. **Bank Accounts** (`/admin/bank-accounts`). Add every company account (bank, number, holder, currency, branch, SWIFT), mark one default, and keep unused ones inactive. Each invoice snapshots the accounts you select, so later edits never alter issued invoices.
3. **SMTP & Email Rules** (`/admin/mail`).
   * Make sure `MAIL_ENCRYPTION_KEY` is set on the server first; the password cannot be saved without it.
   * Enter host, port, security (STARTTLS or SSL), username, password, from and reply-to address, and the administrator notification address; tick *enabled* and save.
   * Press **Send test email to the administrator address**. A success or the exact failure appears at the top of the page. Set up SPF, DKIM and DMARC for your sending domain before real customers are emailed.
   * **Every notification rule starts disabled.** Enable the ones you want: `lead_admin` (new inquiry to you), `lead_customer` (acknowledgement), `invoice_customer`, `payment_confirmed`, `receipt_customer`, `quotation_approval_request`, `quotation_approved_admin`, `lead_reply`. Edit the subject and HTML of any template in place.
   * The **Delivery outbox** lists every message with status, attempts and the last error. Failed sends retry automatically with growing back-off (up to five attempts, plus the daily cron); a failed message shows a **Retry** button, and **Process pending emails** sends what is due right now.
4. **Navigation**, **FAQs**, **Coverage**, **SEO & Redirects** (`/admin/navigation`, `/faq`, `/coverage`, `/seo`). A coverage region appears on the public Network page only while it is marked active, so add regions only after operations has confirmed them. Header links to `/admin` are rejected.
5. **Articles** and **Pages & Sections**. Articles have a rich-text editor and a raw HTML mode; HTML is sanitised on the server, saved as a revision, and goes live only when you publish. Pages are drafted section by section, previewed, then published as a snapshot; earlier revisions can be restored.
6. **Media Library**. Upload PNG, JPEG, WebP or AVIF with alt text (limit 7 MB, 4 MB on Vercel). Files go to the public bucket.

## 4. Finance workflow

All amounts are calculated on the server in integer minor units with `Decimal`; the browser never supplies a total.

1. **Customer** → create it. A permanent, random owner code (for example `C82960F570E`) is assigned once and never derived from the name.
2. **Quotation** → create, then *issue*. Numbers follow `QUO-VORA-<OWNER_CODE>-<YYYYMM>-<RANDOM_5>`.
3. **Customer approval** (optional) → *Request approval*. The customer receives the PDF and a private, expiring link, signs and stamps it, and uploads the PDF. The upload alone approves nothing: Finance opens it (stored privately, SHA-256 recorded), then approves or rejects it.
4. **Invoice** → create (up to five line items fit per page; more flow onto further pages), choose one or more bank accounts, add shipment details (service mode, origin, destination, B/L or AWB), tax and withholding percentages. *Issue* it, then *send to customer* if the rule is enabled. Numbers follow `INV-VORA-<OWNER_CODE>-<YYYYMM>-<RANDOM_5>`. **The invoice PDF states that it is a payment request and not proof of payment.**
5. **Payment** → *record payment* when the customer says they paid. It is saved as **pending confirmation**: the invoice balance does not change, no receipt exists and nothing is emailed. You can cancel a pending record.
6. **Confirm cleared funds** → only after the money has actually arrived in the company bank account, tick the confirmation and confirm. Now, atomically: the payment becomes recorded, the invoice moves to *partially paid* or *paid*, an `RCP-VORA-…` receipt is created with its QR verification, and the `payment_confirmed` and `receipt_customer` emails are queued.
7. **E-meterai** → a receipt for more than IDR 5,000,000, or in any foreign currency, is withheld (`pending e-meterai`). Download the draft, apply an authentic e-meterai through an authorised provider **outside** this system, then upload the stamped PDF with the provider reference. The system checks that the file is a readable, unencrypted PDF that still contains the receipt and invoice numbers and no active content, stores it privately, records its SHA-256, and only then releases it to the customer. The software does not verify the stamp itself; that review is yours.
8. **Verification** → the QR on each document opens `/verify/<token>`, which shows only type, reference, issuer, date and current status (authentic, void, pending e-meterai, paid, partially paid). A QR proves the issuer's record, not that a PDF is unaltered: for high-value settlements compare against your own records.
9. **Void** → voiding a receipt reverses its payment and recalculates the invoice; voiding a document revokes its verification link.

Document references and owner codes are permanent. Never edit them in the database.

## 5. Routine operations

* **Audit log** (`/admin/audit`): sign-ins, creations, status changes, confirmations, stamp uploads, retries, user changes.
* **Leads** (`/admin/leads`): status pipeline, notes, assignee, follow-up date, CSV export.
* **Back up** the database before every schema change, and keep a copy of `MAIL_ENCRYPTION_KEY`.
* **Upgrading the database**: `python scripts/apply_migrations.py` (dry run) then `--apply`; never re-run `SUPABASE_MANUAL_SETUP.sql` on a database that has data.
