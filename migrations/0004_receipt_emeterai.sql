-- Run once after 0003_mail_seals.sql. Official manual e-meterai workflow.
BEGIN;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS stamp_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS stamp_storage_key VARCHAR(500);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS stamp_sha256 VARCHAR(64);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS stamp_provider_reference VARCHAR(160);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS stamp_uploaded_at TIMESTAMPTZ;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS stamp_uploaded_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS ix_receipts_stamp_pending ON receipts (status,stamp_required);
COMMIT;
