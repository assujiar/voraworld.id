# VORA administrator handbook

Sign in at `/admin/login` with an account created using `npm run users -- create` (see `ADMIN_SETUP_GUIDE.md`). There is one role, `admin`, and it opens every menu. The sidebar groups the pages into **Sales**, **Finance**, **Website** and **System**.

## Public site and content (Website)

**Pages & Sections.** Create a page with a title, slug, language and SEO fields. Add sections and edit each one: heading, text, image, button label and link, kind (`editorial`, `hero`, `features`, `cta`, `media`, `faq`), layout (`split`, `stack`, `center`, `cards`) and background (`paper`, `white`, `ink`). Reorder with Up/Down, hide a section with *Visible*, or delete it. **Publish page** freezes the draft as a snapshot, and visitors only ever see the last published snapshot; a draft preview (`/en/preview/page/<id>`, never indexed) is available while you are signed in. Each publish keeps the previously published snapshot as a revision, and **Restore** brings an earlier one back (the restore is recorded too). The editor uses ordered controls, not drag-and-drop, and the five core service pages and the other built-in pages keep their copy in source control (`src/content/`) rather than in the admin; a CMS page published with the slug `home`, `about`, `services`, `solutions`, `network`, `insights` or `faq` adds its published sections to that built-in page (and is not a separate page).

**Articles.** The editor has a toolbar (bold, italic, underline, bullets, numbers, H2, H3, quote, link, image, undo, redo), a **HTML source** switch and a **Preview**. Save as draft, publish, unpublish, or restore an earlier revision (every save stores the previous state). The server sanitises the HTML with an allow-list (paragraphs, headings, lists, links, quotes, code, tables, figures and images; no scripts, iframes or inline styles; links and images must be https, `mailto:` or a same-site path), so what is rendered may differ from arbitrary HTML pasted into source mode. Article URLs are `/en/insights/<slug>` or `/id/insights/<slug>`; slugs must be unique. Do not publish material without approval.

**FAQs, Navigation, Coverage.** FAQ entries are one list shared by both languages. Navigation has header and footer links with a position (lower numbers first); remove one with Delete. Links into the admin portal are refused. Coverage: add only genuinely verified service regions; a region is public on the Network page only while it is marked active.

**SEO & Redirects.** Create 301 redirects from an old public path to a new one (both must be local paths). The page also links to the live `sitemap.xml` and `robots.txt`. Published routes and published articles are in the sitemap automatically.

**Site Settings.** Enter the legal issuer name, company profile text, public email and address, operating hours, social links, the approved privacy notice and terms (HTML), and optional GA4/GTM IDs. Save to publish immediately: these affect the public header, footer, contact page and Organization metadata, and the issuer block of the documents. Unknown values may safely stay blank. Never enter registration numbers or certificates unless verified. There is no telephone or WhatsApp setting by design.

**Media Library.** Upload PNG, JPEG, WebP or AVIF (the file's bytes are checked, not its name) with real alt text (limit 7 MB, 4 MB on Vercel). Copy the resulting URL into a section image or an article. Production needs Supabase Storage configured; SVG uploads and image editing are not offered.

## Leads (Sales)

The Contact and Request-a-Quote forms save directly to the database; each lead gets a reference such as `INQ-VORA-L…` or `RFQ-VORA-L…`. The Leads page offers search and a status filter, a detail view, status (`new`, `contacted`, `qualified`, `quotation_sent`, `negotiation`, `won`, `lost`, `archived`), priority, assignee, follow-up date, an internal note timeline, **Reply by email** and a CSV export. A reply needs SMTP switched on and the `lead_reply` rule enabled; it is kept on the lead's timeline and moves a *new* lead to *contacted*. Not offered: CSV import, bulk actions, attachments, duplicate merging.

## Finance

Customers, bank accounts, quotations, invoices, payments and receipts are described step by step in `ADMIN_SETUP_GUIDE.md` §4, and the design and security notes are in `FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md`. In short:

1. Create a customer (billing contact, optional tax ID, currency, payment terms).
2. Create an invoice: choose the customer, dates, tax and withholding percentages, a discount, bank accounts and the items, one per line as `Description | quantity | unit price | unit`. The totals are calculated and shown before you save. *Issue* it when confirmed; each issued PDF carries a random verification QR.
3. *Record payment* when the customer says they paid; it stays **pending confirmation**. *Confirm cleared funds* only after the bank shows the money. The system rejects an overpayment and recalculates the balance; confirming creates the receipt with its PDF and QR.
4. To reverse a payment, void its receipt: the payment is voided, the receipt's verification link is revoked and the invoice balance is recalculated. This is audited.
5. Public `/verify/<token>` shows only document type, number, issuer, date and status. The QR is **not** QRIS, a certified electronic signature or a tax invoice, and an invoice here is **not** an Indonesian e-Faktur.

Amounts follow the invoice currency. Tax is a percentage you enter, not a hard-coded VAT interpretation. Invoice editing after issue, refund credits and richer finance approvals are not offered, so confirm your business controls before operational use.

## Access control

One role, `admin`, can open everything, including recording and confirming payments, voiding documents, changing bank accounts and settings, and reading the audit log. There is no separation of duties inside the system; use one account per person, keep the number of accounts small, and review `/admin/audit`. Accounts are created and managed with `npm run users` (there is no user-management page). See `ADMIN_SETUP_GUIDE.md` §2.

## Content governance

The English and Indonesian core pages have built-in language routes. New CMS articles and pages are created for one language at a time, and `hreflang` alternates are generated from the paths, so for truly bilingual content publish both language versions and review untranslated screens before making the site public.

### Customer, lead and document reference codes

Codes appear in Customers and Leads; they are assigned once and cannot be edited in routine forms. New invoices and receipts inherit the customer code. A quotation is prepared for an existing customer and uses `QUO-VORA-[CODE]-YYYYMM-[5 RANDOM DIGITS]`. Draft, issue and void preserve the same number; a void number is never reused. See `NUMBERING_POLICY.md`. Document numbers are identifiers, not secrets: the QR verification token is what proves a document.

## Quotation customer approval and direct invoice email

1. Configure `/admin/mail`: enable custom SMTP and the email rules you need (`quotation_approval_request`, `quotation_approved_admin`, `invoice_customer`, `payment_confirmed`, `receipt_customer`, `lead_admin`, `lead_customer`, `lead_reply`). Save approved HTML templates. A server-owned `MAIL_ENCRYPTION_KEY` is needed to save the SMTP password.
2. Create and issue the quotation. On its detail page choose **Send quotation for customer approval**. The system creates a one-use private link (valid 14 days, never beyond the day after the quotation's validity) and queues the quotation PDF to the recipient. Check the delivery outbox; `queued` does not mean delivered.
3. The customer opens the link, downloads the PDF, signs and applies the company stamp, then uploads the complete signed PDF and names the authorised signatory.
4. You open the signed file from the quotation page and inspect it. **Approve** requires an explicit checkbox confirming you reviewed the signature and stamp. Until then the quotation stays `awaiting approval` and the uploaded file is unverified; approving also queues the `quotation_approved_admin` notice.
5. To send an issued invoice PDF, open the invoice and choose **Email invoice PDF to customer**. The rule and SMTP must be enabled first. Outstanding amounts change only when the incoming payment is confirmed as cleared, never because an email was sent.
6. For a confirmed payment above IDR 5,000,000, or in a foreign currency, the receipt is marked pending e-meterai and must be stamped through an official external mechanism and uploaded before it is delivered. The app never generates an e-meterai itself.

Quotation approval links are not visible in site navigation, are `noindex` and expire. Never send signed customer PDFs as public media assets.
