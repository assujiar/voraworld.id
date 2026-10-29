-- Optional shipment metadata used by detailed branded VORA invoice PDFs.
-- Existing invoice rows are retained, no customer values are fabricated.
BEGIN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_mode VARCHAR(120) DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS origin VARCHAR(180) DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS destination VARCHAR(180) DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transport_document_ref VARCHAR(150) DEFAULT '';
COMMIT;
