-- VORA payment clearing approval and idempotent customer notifications.
-- Apply after 0007. Keep existing historical payments as confirmed.
BEGIN;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES users(id);
-- Legacy payment entries were already considered cleared by previous versions.
UPDATE payments SET confirmed_at=created_at WHERE status='recorded' AND confirmed_at IS NULL;
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending_confirmation';
ALTER TABLE email_jobs ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_jobs_dedupe_key ON email_jobs(dedupe_key);
CREATE INDEX IF NOT EXISTS ix_payments_invoice_status ON payments(invoice_id,status);
INSERT INTO email_templates(key,subject,html) VALUES
('payment_confirmed','VORA payment confirmation - $invoice_number','<p>Dear $customer_name,</p><p>We confirm that your payment of <strong>$payment_amount</strong> has been credited to PT Satu Arah International on $payment_date.</p><p>Invoice: <strong>$invoice_number</strong><br>Payment reference: $payment_reference<br>Invoice status: <strong>$invoice_status</strong><br>Outstanding balance: <strong>$outstanding_amount</strong></p><p>The official receipt will follow separately once any required formalities are completed.</p><p>VORA | Freight & Logistics</p>') ON CONFLICT(key) DO NOTHING;
INSERT INTO email_rules(key,enabled) VALUES ('payment_confirmed', FALSE) ON CONFLICT(key) DO NOTHING;
COMMIT;
