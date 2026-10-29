# VORA technical architecture

- **UI:** server-rendered HTML via FastAPI + Jinja2, progressive enhancement with minimal browser JS, mobile-first CSS. Public content appears in actual HTML response for search crawlers, not empty client shells.
- **Application:** `vora/main.py` maps HTTP endpoints and performs authentication/authorization for mutating routes; view templates are in `vora/templates`.
- **Persistence:** SQLAlchemy 2 models, development SQLite, production PostgreSQL (Supabase); session scoped to each HTTP request/operation. Native FK/indexes and dedicated counter rows.
- **Credentials:** PBKDF2-HMAC-SHA256 password derivation with random salt and 310,000 rounds; signed time-limited HttpOnly session cookies, SameSite=Lax, Secure on production; DB-enforced user role lookup on each request.
- **Authorization:** server-side roles: `superadmin`, `admin`, `editor`, `sales`, `finance`, `viewer`. Permissions grouped as content, CRM, finance and settings. Public mutation is restricted to RFQ/contact forms.
- **CSRF:** signed, time-limited double-submit cookie and form token on POST actions; SameSite cookie. Forms include a bot honeypot and DB-backed email rate-limit. Consider adding IP-level rate limiting/WAF in production.
- **CMS:** `articles` (HTML sanitized on server), `pages`, `sections`, published snapshot JSON for pages, `revisions` for page/article restore; `settings` for contacts/policies; `navigation_items` for menus; verified regions from `coverage`.
- **Finance:** `customers`, `invoices`, `invoice_items`, `payments`, `receipts`, counter table. All invoice calculations use Python `Decimal` + integer minor units; no floating point currency maths. PostgreSQL row/advisory locks guard invoice sequence and concurrent payment writes.
- **Documents:** ReportLab printable A4 PDF and official logo image rasterized from the unchanged SVG asset; QR contains `/verify/<random token>` URL, not QRIS. Document status/query uses token SHA-256 lookup. Revocation on void.
- **Storage:** local `/uploads` for development only. Production uploads to configured Supabase Storage bucket via server-only credentials. Media metadata is stored in SQL; binary content not in SQL.
- **SEO:** public SSR, title/description, canonicals, hreflang alternates, OG/Twitter tags, Organization JSON-LD, dynamic sitemap, robots noindex/disallow on admin/verify. More sophisticated schemas and per-locale CMS copy require completion.
- **Deploy:** Vercel Python adapter (`app/index.py`, `vercel.json`) + Supabase. This choice reflects the owner's Vercel/Supabase preference. It is NOT a native Sites project and no cloud deployment has been attempted in this session.

## Data flow

Public form → CSRF and schema validation → SQL `leads` row → admin pipeline update → activity/audit. Article edit → sanitizer → SQL draft/article revision → explicit publish → localized public SSR route and sitemap. Admin finance → create customer → transactional invoice number + line item calculations → invoice PDF and random verification token → partial payment → recalculated outstanding → receipt & PDF → public minimum-data verification. Owner actions are audited.

## Trade-offs

This source prioritizes a small, understandable Python application with real persistence rather than a nonfunctioning React façade. It is portable to Vercel, but it does not satisfy the user's original requirement of a **Sites-native runtime**. That incompatibility is explicit and requires a separate Sites project/connection if Sites output is mandatory.
