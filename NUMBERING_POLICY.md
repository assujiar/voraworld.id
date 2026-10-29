# VORA Document Reference Policy · 29 October 2026

## Canonical format

`{TYPE}-VORA-{OWNER_CODE}-{YYYYMM}-{RANDOM_5}`

Types implemented:

* `INV`: invoice, linked to an existing customer.
* `RCP`: receipt, linked to the customer of its invoice.
* `QUO`: quotation, linked to an existing customer.
* `RFQ`: request-for-quotation lead reference (from the website form).
* `INQ`: general contact/inquiry lead reference (from the website form).

Customer codes are immutable `C` + 10 uppercase hexadecimal characters (example `C8A4D10B09F`). Lead codes are immutable `L` + 10 uppercase hexadecimal characters (example `LA1C9F204DE`). They are stored on the owner record (`customers.public_code`, `leads.public_code`), generated once from 5 random bytes, and reused for every later document. Changing a name or an email address does not affect the code. Owners that exist without a code are given one the first time a document needs it; concurrent requests converge on whichever code was stored first.

`YYYYMM` is the month of the document's date **on the Jakarta calendar** (UTC+7): the issue date for invoices and quotations, the payment date for receipts, and the day the form was submitted for leads. The last 5 digits are **random**, zero-padded (`00000` through `99999`); they are not sequential, and a number is never edited by hand.

Illustrative samples, not real issued documents:

* `INV-VORA-C8A4D10B09F-202610-04721`
* `RCP-VORA-C8A4D10B09F-202610-83905`
* `QUO-VORA-C8A4D10B09F-202610-19384`
* `RFQ-VORA-LA1C9F204DE-202610-77008`

## Collision and concurrency safeguards

1. The five digits come from `crypto.randomInt(0, 100000)`, a cryptographically secure source.
2. The allocator checks the relevant column before assigning (`invoices.number`, `receipts.number`, `quotations.number`, `leads.reference`). A collision triggers another draw, up to 160 attempts.
3. The allocation runs inside the same transaction that inserts the document, and takes a transaction-scoped advisory lock (`pg_advisory_xact_lock`) on the kind, owner code and month, so allocations for the same scope are serialized. A unique index on each column is the final line of defence: a violation is reported as "numbering collision, please retry" and nothing is stored.
4. There are at most 100,000 five-digit suffixes per kind, owner and month. If a month is completely used up, the allocator fails explicitly with "Could not allocate a unique five-digit document number". Numbers of voided documents are never recycled.
5. Codes and printed numbers are identifiers, **not** authentication secrets. Online verification uses an independent, unpredictable token (36 random bytes) that can be revoked.

## Existing data

A fresh database gets everything from `migrations/`, nothing is renumbered, and issued numbers are permanent. If you ever migrate a database from the earlier Python version, apply the migrations in order (`npm run db:migrate -- --apply`) after taking a backup; previously issued invoice and receipt numbers are preserved exactly, and historical PDFs, QR codes and audit trails must not be renumbered.

## Coverage and limitations

Tests cover the format, the issue month (including the Jakarta/UTC boundary), a forced collision that is retried, a month that is completely used up, sixteen simultaneous allocations that all come out unique and well formed, and the database rejecting duplicates. They run on a real PostgreSQL 16. Load testing on a Supabase project has not been done, and the outbound email that carries a number is a separate flow.
