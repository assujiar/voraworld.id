# VORA technical architecture

- **UI:** server-rendered HTML via FastAPI + Jinja2, progressive enhancement with minimal browser JS, mobile-first CSS. Public content appears in actual HTML response for search crawlers, not empty client shells.
- **Application:** `vora/main.py` maps HTTP endpoints and performs authentication/authorization for mutating routes; view templates are in `vora/templates`.
- **Persistence:** SQLAlchemy 2 models, development SQLite, production PostgreSQL (Supabase); session scoped to each HTTP request/operation. Native FK/indexes and dedicated counter rows.
- **Credentials:** PBKDF2-HMAC-SHA256 password derivation with random salt and 310,000 rounds; signed time-limited HttpOnly session cookies, SameSite=Lax, Secure on production, bound to a fingerprint of the stored credential (a password reset or deactivation ends the session); DB-enforced user role lookup on each request; failed sign-ins are recorded in `login_attempts` and throttled per email and per IP; POST-only logout with CSRF.
- **Authorization:** server-side roles: `superadmin`, `admin`, `editor`, `sales`, `finance`, `viewer`. Permissions grouped as content, CRM, finance and settings. Public mutation is restricted to RFQ/contact forms.
- **CSRF:** signed, time-limited double-submit cookie and form token on POST actions; SameSite cookie. Forms include a bot honeypot and DB-backed email rate-limit. Add a WAF or bot protection in front of the public forms in production. Responses carry a strict Content-Security-Policy (no third-party origins), `X-Frame-Options: DENY`, HSTS in production and `nosniff`.
- **CMS:** `articles` (HTML sanitized on server), `pages`, `sections`, published snapshot JSON for pages, `revisions` for page/article restore; `settings` for contacts/policies; `navigation_items` for menus; verified regions from `coverage`.
- **Finance:** `customers`, `invoices`, `invoice_items`, `payments`, `receipts`, counter table. All invoice calculations use Python `Decimal` + integer minor units; no floating point currency maths. PostgreSQL row/advisory locks guard invoice sequence and concurrent payment writes.
- **Documents:** ReportLab printable A4 PDF and official logo image rasterized from the unchanged SVG asset; QR contains `/verify/<random token>` URL, not QRIS. Document status/query uses token SHA-256 lookup. Revocation on void.
- **Storage:** local `/uploads` and `./protected` (override with `VORA_LOCAL_PRIVATE_DIR`) for development only. Production uses Supabase Storage through the server-side secret key: public bucket `vora-media`, private bucket `vora-documents` (stamped receipts, signed quotation approvals, SHA-256 rechecked on read). Media metadata is stored in SQL; binary content is not.
- **SEO:** public SSR, title/description, canonicals, hreflang alternates, OG/Twitter tags, Organization JSON-LD, dynamic sitemap, robots noindex/disallow on admin/verify. More sophisticated schemas and per-locale CMS copy require completion.
- **Deploy:** Vercel Python function (`app/index.py`, `vercel.json`, 4.5 MB body limit, read-only filesystem) + Supabase (transaction pooler; prepared statements disabled; no in-process pool). Row Level Security is enabled on every table because the Supabase Data API is not used. See `VERCEL_SETUP_GUIDE.md` and `SUPABASE_SETUP_GUIDE.md`.
- **Email:** admin-configured SMTP with a Fernet-encrypted password; templates and rules in SQL (seeded by migration `0014`); every message goes through a DB outbox with de-duplication, back-off and manual retry; a daily Vercel cron retries what failed.

## Data flow

Public form → CSRF and schema validation → SQL `leads` row → admin pipeline update → activity/audit. Article edit → sanitizer → SQL draft/article revision → explicit publish → localized public SSR route and sitemap. Admin finance → create customer → transactional invoice number + line item calculations → invoice PDF and random verification token → partial payment → recalculated outstanding → receipt & PDF → public minimum-data verification. Owner actions are audited.

## Trade-offs

A small, understandable Python application with real persistence, chosen over a client-rendered front end so that content is in the HTML for search engines and the attack surface stays small. Long-form copy for the five core service pages is source-controlled (`vora/content.py`); everything else is editable in the admin. The schema is managed only by numbered SQL migrations in production: there is no ORM auto-migration.
