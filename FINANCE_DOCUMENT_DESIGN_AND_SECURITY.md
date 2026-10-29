# VORA Finance Documents — Detail, Identity and Authenticity

Last update: 29 October 2026. This is a source-backed engineering review, not a live deployment approval.

## Approved appearance

- A4 with the official VORA reverse logo, original A watermark, monochrome ink `#101720`, red `#B43E31`, paper `#F7F7F4` and legible monospace.
- Details are genuinely connected to the issuing transaction; no hardcoded sample customers, bank accounts, route claims, shipment references or tax rates.
- Invoice is paginated to **five charge items per page**, with final settlement details only on the last page; when an unusually verbose block cannot fit, it produces a separate financial summary page instead of clipping data.
- Quotation maintains its signature/stamp approval area and customer upload workflow.

## Invoice fields actually supported

- Issuer legal entity, address, email and branding from published company settings.
- Customer legal name, billing address, email, tax ID.
- Document number, date, due date, dynamically computed payment terms, currency, issuance and current payment status.
- Customer PO, shipment / job reference, **service mode, origin, destination, transport document (B/L or AWB) reference**. Newly added fields are optional admin inputs; **migration 0010** adds them.
- Description, quantity, unit, unit price and row total on every item.
- Gross subtotal, discount, VAT/other configurable tax percentage and amount, withholding percentage and amount, grand total and outstanding balance.
- Selected bank-account snapshots, commercial notes, page count and opaque online QR.

## Receipt fields actually supported

- Payer / customer, issuer, receipt number and issue date.
- Invoice reference, payment record ID, payment date/method, bank transfer reference.
- Linked invoice total, amount allocated to **this** payment, total ledger-confirmed paid amount and current remaining balance.
- Actual confirmed amount in figures and English words (integer IDR only).
- Finance reviewer identifier and bank-credit confirmation date, **when stored**.
- Receiving-bank snapshot, invoice settlement status, verification QR and e-meterai release status.
- Official receipt cannot be generated from a pending claim: Finance must mark funds `recorded` first. Official e-meterai where applicable must be applied manually through the protected workflow.

## Financial integrity and anti-counterfeiting

1. Server-side decimal-safe line calculations and document-to-payment reconciliation.
2. Stable customer reference in randomized document numbers, uniqueness in PostgreSQL and unguessable QR tokens.
3. Minimal public verification endpoint with current issuer record and status; `noindex` and no public customer monetary data.
4. Authorization and audit log for admin mutations; immutable original bank-account instructions captured at issue time.
5. **Existing limitation:** the public QR endpoint currently verifies the existence/status of a database record, **not that every field in a received PDF matches the master file**. A determined counterfeiter can copy a valid QR into a modified PDF. For financial document authenticity beyond visual deterrence, implement a downloadable canonical issued PDF, an issued-version digest, and a compare-PDF workflow (or cryptographic signing) on protected staging before production. Do not promise tamper-proof documents on the basis of a detailed design alone.
6. Example PDFs contain fictitious QA-only customer and transfer data and must not be sent to customers.

## Release conditions

Migrate through the latest numbered migration in order (see `SUPABASE_SETUP_GUIDE.md`), test editable invoice metadata on real Supabase staging, confirm legitimate SMTP delivery, validate external e-meterai, compare stored original PDF against a tampered file, and audit invoice status, tax calculations, manual payment confirmation and PDF pagination before publishing.
