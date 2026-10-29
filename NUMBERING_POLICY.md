# VORA Document Reference Policy · 29 October 2026

## Canonical format

`{TYPE}-VORA-{OWNER_CODE}-{YYYYMM}-{RANDOM_5}`

Types implemented:

- `INV`: invoice, linked to an existing customer.
- `RCP`: receipt, linked to the customer of its invoice (not to a payment's independent code).
- `QUO`: quotation, linked to an existing customer **or** lead.
- `RFQ`: request-for-quotation lead reference.
- `INQ`: general contact/inquiry lead reference.

Customer codes are immutable `C` + 10 uppercase hexadecimal characters (example `C8A4D10B09F`). Lead codes are immutable `L` + 10 uppercase hexadecimal characters (example `LA1C9F204DE`). They are stored on owner records and reused. Changing a name, email, or account display name does not affect the code. Existing customers/leads are assigned codes during migration; new owners are assigned codes server-side.

`YYYYMM` comes from the document's issue date (or payment date for receipts). The last 5 digits are **random**, formatted with zero padding (`00000` through `99999`). They are not sequential. No number should be manually edited.

Illustrative samples, not real issued documents:

- `INV-VORA-C8A4D10B09F-202610-04721`
- `RCP-VORA-C8A4D10B09F-202610-83905`
- `QUO-VORA-C8A4D10B09F-202610-19384`
- `QUO-VORA-LA1C9F204DE-202610-56213`
- `RFQ-VORA-LA1C9F204DE-202610-77008`

## Collision/concurrency safeguards

1. `secrets.randbelow(100000)` uses cryptographically secure randomness.
2. Code tests the relevant database column before assignment. A collision triggers another draw (up to 160 attempts).
3. PostgreSQL locks the transaction by document-type, customer/lead code, and month via `pg_advisory_xact_lock` to serialize allocations for the same scope. A unique index on document numbers is the final line of defense.
4. At most 100,000 five-digit suffixes exist per type + owner + month. If exhausted, fail explicitly. Do not recycle voided document numbers.
5. Codes/printed document numbers are identifiers, **not** authentication secrets. Online verification uses an independent unpredictable token with revocation support.

## Existing production data

Run migration `migrations/0005_document_numbering.sql` **after** `0004_receipt_emeterai.sql`. Back up the database before applying it. It adds permanent owner codes and a quotation module. Previously issued invoice/receipt numbers are preserved exactly; historical PDF, QR and audit trails must not be renumbered.

## Coverage / limitations

Backend integration tests cover invoice, receipt, quotation and RFQ numbering; a forced random-tail collision; quote PDF and QR state transition. Browser prototype tests cover three document types and mobile display. Supabase PostgreSQL concurrency/load testing remains pending. Outbound quotation SMTP delivery is a separate work item, not covered by these numbering tests. The offline prototype uses local browser records rather than a server-side database.
