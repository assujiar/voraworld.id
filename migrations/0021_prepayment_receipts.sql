-- A pre-payment receipt is created with every invoice. Many customers need a receipt, stamped with an e-meterai when the
-- amount is above IDR 5,000,000 (or in a foreign currency), before their own finance team releases the payment. It is
-- issued BEFORE the money arrives, states that it is no proof of payment, and is separate from the official payment
-- receipt (table `receipts`), which is still issued only after Finance has confirmed cleared funds.
-- One live (not void) per invoice; a voided one can be replaced. Status: draft (invoice not issued yet) -> pending_stamp (waiting for the manual e-meterai) or issued -> void.
-- RLS is enabled with no policies, so the Supabase Data API cannot read it.
CREATE TABLE IF NOT EXISTS prepayment_receipts (
  id                       SERIAL PRIMARY KEY,
  number                   VARCHAR(70)  NOT NULL UNIQUE,
  invoice_id               INTEGER      NOT NULL REFERENCES invoices (id),
  status                   VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_stamp', 'issued', 'void')),
  currency                 VARCHAR(3)   NOT NULL,
  amount_minor             BIGINT       NOT NULL CHECK (amount_minor > 0),
  stamp_required           BOOLEAN      NOT NULL DEFAULT FALSE,
  stamp_storage_key        VARCHAR(500),
  stamp_sha256             VARCHAR(64),
  stamp_provider_reference VARCHAR(160),
  stamp_uploaded_at        TIMESTAMPTZ,
  stamp_uploaded_by        INTEGER REFERENCES users (id),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_prepayment_receipts_live ON prepayment_receipts (invoice_id) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS ix_prepayment_receipts_status ON prepayment_receipts (status, stamp_required);
ALTER TABLE prepayment_receipts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE prepayment_receipts FROM anon;
    REVOKE ALL ON SEQUENCE prepayment_receipts_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE prepayment_receipts FROM authenticated;
    REVOKE ALL ON SEQUENCE prepayment_receipts_id_seq FROM authenticated;
  END IF;
END $$;

-- The email that carries the pre-payment receipt to the customer (starts switched off like every other notification).
INSERT INTO email_templates (key, subject, html) VALUES
  ('prepayment_receipt_customer', $vora$VORA pre-payment receipt $document_number$vora$, $vora$<p>Dear $customer_name,</p><p>Please find attached the pre-payment receipt <strong>$document_number</strong> for invoice <strong>$invoice_number</strong>, prepared for your internal payment process.</p><p>It is not proof that payment has been made: VORA issues the official payment receipt once the funds are credited to its bank account. Verify the document through the QR code or <a href="$verify_url">online verification</a>.</p><p>VORA | Freight & Logistics</p>$vora$)
ON CONFLICT (key) DO NOTHING;
INSERT INTO email_rules (key, enabled) VALUES
  ('prepayment_receipt_customer', FALSE)
ON CONFLICT (key) DO NOTHING;
