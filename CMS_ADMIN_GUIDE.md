# VORA administrator handbook

Sign in at `/admin/login` with an account created using `scripts/manage_users.py` (see `ADMIN_SETUP_GUIDE.md`).

## Public site and content

`Pages & Sections`: Create a page with title, slug, language and SEO. Add sections, edit heading/text/image/CTA, select background and editorial layout, reorder with Up/Down, toggle visibility, and use **Publish page**. Until published, visitor routes use the last published snapshot. A draft preview is available to authenticated editors. Revision history can restore previous published snapshots. The page editor currently uses ordered controls rather than drag-and-drop and does not offer a full global theme studio.

`Articles`: Create rich-text content, use heading/list/link/image toolbar, toggle **HTML source**, save draft, preview, publish, unpublish or restore a revision. Unsafe markup is filtered on the server, so the rendered article may not exactly match arbitrary HTML pasted into source mode. Article URLs are `/en/insights/<slug>` or `/id/insights/<slug>`. Do not publish material without approval. Use unique slugs.

`FAQs`, `Navigation`, `Coverage`: Add and update FAQ entries, header/footer links, and only genuinely verified service regions. Unverified regions should remain unpublished. Core service-page copy is conservative, but is presently maintained in `vora/content.py`, NOT fully editable in admin.

`Site Settings`: Enter legal issuer name, company profile, approved phone, email, address, contact hours, social links, bank account details, privacy and terms. Save to publish immediately; these changes affect public header/footer/contact/Organization metadata and invoices where used. Any unknown values may safely remain blank. Never enter registration numbers or certificates unless verified.

`Media Library`: Upload images (PNG/JPEG/WebP/AVIF, max 7 MB, 4 MB on Vercel), supply real alt text, and copy media URLs into page section images. Production needs configured Supabase Storage. SVG upload and automatic crop/replacement workflows are not enabled in this version.

## Leads

Contact and RFQ forms save directly to SQL. The Leads screen offers search/status filter, detail, pipeline status, priority, assignee, follow-up date, internal activity and CSV export. No fake email notices are generated. Lead CSV import, bulk actions, file attachments and duplicate merging remain unimplemented.

## Invoices and receipts

1. Create a customer with billing contact, optional tax ID, currency and payment terms.
2. Create a draft invoice by choosing customer, dates, adjustable tax/withholding percentages and discount. Enter invoice items, one per line, using `Description | quantity | unit price | unit`.
3. Preview totals and verify them. Issue the invoice when confirmed. Each issued PDF includes a random verification QR link.
4. Record actual payment, including partial amounts and reference. System rejects an overpayment, recalculates outstanding, and automatically creates a receipt with PDF/QR.
5. When reversing a payment, void its receipt. The recorded payment becomes void, the receipt token is revoked, and invoice outstanding is recalculated. This action is audited.
6. Public `/verify/<token>` displays ONLY document type, number, issuer, date and status. The QR is **not** QRIS, a certified electronic signature or a tax invoice.

Amounts are based on invoice currency. Tax is configurable, not a hardcoded VAT interpretation. **An invoice is not an Indonesian e-Faktur**. Invoice editing, document emails, refund credits and richer finance approval controls remain limited/absent, so confirm business controls before operational use.

## Access control

`superadmin` all; `admin` content/CRM/finance/settings; `editor` content; `sales` CRM; `finance` finance; `viewer` dashboard/read-only. Role checks apply on the server for administration paths. User creation/recovery and role management use administrator-controlled CLI/database operations, not a built-in user administration panel.

## Content governance

The English/Indonesian core pages have built-in language routes. New CMS article/page content can be created for one locale at a time. SEO alternate links are generated mechanically, so for truly bilingual content publish both corresponding locale versions and manually review untranslated screens before making the site public.

### Customer, lead and document reference codes

Codes appear in Customers / Leads; they are assigned once and cannot be edited in routine forms. New invoices and receipts inherit the customer code. A quotation can be prepared from either an existing lead or an existing customer; it uses `QUO-VORA-[CODE]-YYYYMM-[5 RANDOM DIGITS]`. Draft/issue/void preserve the same number; void never releases the number for reuse. Review `NUMBERING_POLICY.md` for old-record policy and technical safeguards. Do not use document numbers instead of QR verification tokens.

## Quotation customer approval and direct invoice email

1. Configure `/admin/mail`: enable custom SMTP and the email rules `quotation_approval_request`, `invoice_customer`, `payment_confirmed`, `receipt_customer`, `lead_admin`, `lead_customer` as required. Save approved HTML templates. A server-owned `MAIL_ENCRYPTION_KEY` is needed to save SMTP passwords.
2. Create and issue the quotation. In its detail page, select **Send quotation for customer approval**. The system creates a one-use, time-limited private link and queues the quotation PDF to the recipient. Check the delivery outbox; `queued` does not mean delivered.
3. The customer opens the link, downloads the PDF, signs and applies the company stamp, then uploads a complete signed PDF and identifies the authorized signatory.
4. Finance downloads the signed file from quotation history and inspects it. The **Approve** button requires an explicit checkbox confirming manual signature/stamp review. Until then, status remains `awaiting_approval` and the uploaded file is unverified.
5. To send an issued invoice PDF from Admin, open its detail and select **Email invoice PDF to customer**. The rule and SMTP must be enabled first. Outstanding amounts change only when the incoming payment is confirmed as cleared, not when an email is sent.
6. In the receipt flow, if the confirmed payment amount exceeds IDR 5 million, the PDF is marked pending e-meterai and must be stamped through an official external mechanism then uploaded before final delivery. The app never generates an e-meterai itself.

Public quotation approval tokens are not visible in site navigation, are `noindex`, and expire. Never send signed customer PDFs as public media assets.
