# VORA Finance Documents: detail, identity and authenticity

Last update: 29 October 2026. This is a source-backed engineering review of the Next.js implementation, not a live deployment approval; nothing here has been run on a production account.

## Approved appearance

* A4 with the official VORA reverse logo, the original A watermark, ink `#101720`, red `#B43E31`, paper `#F7F7F4` and a monospace face (the PDF standard Courier fonts, so no font files are bundled).
* Details come from the issuing transaction and the company settings; there are no hard-coded sample customers, bank accounts, routes, shipment references or tax rates.
* The **invoice** is paginated to **five charge items per page**, with the settlement block on the last page; when an unusually verbose block cannot fit, a separate summary page is produced instead of clipping data. The **quotation** is laid out on **one page** (text is measured, font size 8.0 down to 6.5); a quotation that cannot fit fails loudly instead of being clipped, and one with more than ten items uses the paginated layout. The **receipt** is one page.
* The quotation keeps its signature and company-stamp area for the customer approval workflow.

## Invoice fields actually supported

* Issuer legal entity, address and email from the published company settings.
* Customer legal name, billing address, email and tax ID.
* Document number, issue date, due date (defaults to the customer's payment terms), currency, and issuance/payment status (`AWAITING PAYMENT`, `PARTIALLY PAID`, `OFFICIALLY PAID`).
* Customer PO, shipment or job reference, **service mode, origin, destination, transport document (B/L or AWB) reference**. All are optional inputs.
* Description, quantity, unit, unit price and row total on every item.
* Gross subtotal, discount, tax percentage and amount, withholding percentage and amount, grand total and outstanding balance.
* Up to eight selected bank-account **snapshots** (frozen when the invoice is created, never changed by later edits to the bank account), notes, page count and the verification QR.
* The statement **"PAYMENT REQUEST - NOT PROOF OF PAYMENT"**, and that the receipt is issued only after Finance confirms cleared funds.

## Receipt fields actually supported

* Payer (the customer), issuer, receipt number and issue date.
* Invoice reference, payment record number, payment date and method, bank transaction reference.
* Invoice total, the amount allocated to **this** payment, the total confirmed so far and the remaining balance.
* The confirmed amount in figures and, for IDR, in English words.
* The finance confirmation trace (who confirmed and when, as stored), the credited company bank account, the invoice's settlement status, the verification QR and the e-meterai release control.
* A receipt cannot be generated from a pending claim: Finance must confirm cleared funds first. Where an e-meterai applies (any non-IDR payment, or IDR above 5,000,000), the official stamp is applied manually outside this system and the stamped PDF is uploaded through the protected workflow; until then the receipt is `pending e-meterai` and is neither downloadable as final nor emailed.

## Quotation fields actually supported

Issuer, recipient (customer), number, issue date, validity date, currency, items, subtotal, tax percentage and amount, grand total, terms and notes, the "approved by customer" signature and stamp area, and the verification QR. A customer approval request is a private link that expires; the signed PDF the customer uploads is **evidence for you to review, not an approval**.

## Financial integrity and anti-counterfeiting

1. Server-side exact decimal arithmetic in integer minor units (BigInt, half-up rounding); money columns are 64-bit; the browser never supplies a total. Invoice totals reconcile against confirmed payments, and a payment total above the invoice is a hard error.
2. Stable customer reference inside the document number, uniqueness enforced by PostgreSQL, and unguessable QR tokens (36 random bytes; only the SHA-256 is needed to look one up). See `NUMBERING_POLICY.md`.
3. A minimal public verification page with the current issuer record and status; it is `noindex`, sends no referrer and shows no customer or monetary data. Voiding revokes the link.
4. Every admin mutation is audited. Bank instructions are snapshotted onto the invoice at creation.
5. Payment control: a claim is pending and reserves balance; confirmation locks the invoice then the payment in a fixed order inside one transaction, so concurrent confirmations produce exactly one winner. Voiding a receipt reverses its payment; voiding an invoice cancels open claims.
6. **Uploaded PDFs are untrusted input.** Before anything is stored the file must start with `%PDF-`, be within the size limit, parse structurally (otherwise "Invalid or damaged PDF"), have a sensible page count, contain no `OpenAction`, additional actions, JavaScript or Launch entries, and contain extracted text with the document's own reference numbers. It is stored in the **private** bucket with its SHA-256, and every read re-checks the hash (a mismatch is refused with a conflict error). Download routes require the admin session.
7. **Existing limitation:** the public QR endpoint verifies that a database record exists and its status, **not that every field of a received PDF matches the master record**. A determined counterfeiter can copy a valid QR into a modified PDF. For authenticity beyond visual deterrence, add a canonical issued-PDF digest with a compare-PDF workflow or cryptographic signing, and test it on staging before promising tamper-proof documents. PDFs are not cryptographically signed.
8. Standard PDF fonts cover Latin text only; characters outside it are printed as `?`. Non-Latin customer names would need an embedded font.
9. Test PDFs contain fictitious data and must never be sent to customers.

## Release conditions

Apply every numbered migration in order (see `SUPABASE_SETUP_GUIDE.md`), test the invoice, quotation and receipt flow on a protected staging deployment with fictitious data, confirm legitimate SMTP delivery, validate a genuine external e-meterai against the upload checks, compare a stored original PDF against a tampered copy, and have an adviser review invoice status handling, tax and withholding treatment, the manual payment confirmation procedure and the PDF pagination before real documents are issued.
