# Hotfix: proof of delivery storage, and shipper/consignee on delivery notes

Nothing in this file has been run on the production database. Run the SQL yourself, in the Supabase SQL editor, in the order below.

## What was wrong

The private bucket `vora-documents` allows **only `application/pdf`** (created that way by migration 0013; checked on the live project with a read-only query: `public = false`, `file_size_limit = 10485760`, `allowed_mime_types = {application/pdf}`). A proof of delivery stores a PNG signature and JPEG photos in that bucket. Storage refused each upload, and the phone showed "Private document storage failed". Nothing was recorded, which is why no proof could be submitted.

## Order of work

1. Run **Step 1** (storage) now. It fixes the proof of delivery by itself, without any code change.
2. Deploy the code of this branch (it works with or without Step 2 for storage, but the new delivery form needs Step 2).
3. Run **Step 2** (shipper columns) before, or immediately after, the deployment. The new code writes `shipper_*` columns; until Step 2 is applied, saving a delivery note fails.

## Step 1: allow PNG and JPEG in the private bucket (file `migrations/0027_documents_bucket_evidence_types.sql`)

Look first:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
```

If the server uses another bucket name (environment variable `SUPABASE_DOCUMENTS_BUCKET`), replace `vora-documents` below with that bucket's id. Then run the whole content of `migrations/0027_documents_bucket_evidence_types.sql`. In short it does this and nothing else:

```sql
update storage.buckets
   set public = false,
       allowed_mime_types = (select array_agg(distinct t order by t) from unnest(allowed_mime_types || array['application/pdf','image/png','image/jpeg']) as t)
 where id = 'vora-documents' and allowed_mime_types is not null;
```

It keeps every type that is already allowed, keeps the bucket private and keeps the 10 MB limit. It can be run again safely.

Check:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'vora-documents';
-- expected: public = false, allowed_mime_types = {application/pdf,image/jpeg,image/png}
```

(Or in the dashboard: Storage, `vora-documents`, Edit bucket: keep it **private**, allowed MIME types `application/pdf, image/png, image/jpeg`.)

## Step 2: shipper columns and the new delivery rules (file `migrations/0028_delivery_parties.sql`)

Run the whole file. It adds five nullable columns to `deliveries` (`shipper_name`, `shipper_address`, `shipper_contact`, `shipper_phone`, `shipper_email`), one check that forbids a blank shipper name, and replaces `delivery_create` and `delivery_update` so that a new note, or the edit of a draft, must name the shipper and the consignee and give both a full address. Existing delivery notes are not changed: their shipper stays empty, the PDF says "Not recorded on this delivery note", and they can still be issued, received and rejected.

Check:

```sql
select column_name from information_schema.columns where table_name = 'deliveries' and column_name like 'shipper_%' order by 1;   -- 5 rows
select count(*) from deliveries where shipper_name is null;                                                                      -- your existing notes
```

## Record both migrations (so `npm run db:migrate` does not run them again)

```sql
insert into schema_migrations (name, sha256) values
  ('0027_documents_bucket_evidence_types.sql', '2854683b4c67fe699277645bc26bfc278b11ed98bfc584b3f52d007c3ca63983'),
  ('0028_delivery_parties.sql', '5ae2c935f70efe4d1b4c4b71c33d01e0d0cfb6eba5c62d329dd143ae941f5238')
on conflict (name) do nothing;
```

Then run `SUPABASE_VERIFICATION.sql`: the new line "bucket vora-documents accepts PDF, PNG and JPEG" must say PASS.

## Test it on a phone

1. Admin, Delivery Notes, New: choose a customer and a validated quotation; fill Shipper and Consignee (different names and addresses), add cargo, Save draft, Issue.
2. Scan the QR code, fill in the driver and the receiver, sign, take a photo, allow the location, send.
3. The phone must show the thank-you with the delivery note number and the receiver; the note becomes Delivered; the PDF of the proof shows both parties and the evidence.
4. If it fails, the message ends with a short code such as `(kode 3fa9c1d2)`. The same code is in the server log (Vercel, Runtime Logs, search `storage_failure`) next to the provider's own error, operation, file type and size. No key, token or file content is logged.

## Security

The bucket stays private. Evidence is read only by the server (service role) through authorised routes, re-hashed with SHA-256 on every read. The POD capture page shows the names of the shipper and the consignee and the origin and destination only; it does not show addresses, phone numbers, prices or billing details. An issued delivery note cannot be edited: void it and write a new one.

## Not covered by this hotfix

The pre-existing unit suites that were already out of date (env, deploy, setup-check, numbering, the media and lead-reply actions in `admin-actions`) still fail as before; they are not related to this change.
