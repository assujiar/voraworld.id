-- Optional commercial references for redesigned VORA invoice PDFs.
BEGIN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number VARCHAR(100) DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipment_reference VARCHAR(120) DEFAULT '';
COMMIT;
