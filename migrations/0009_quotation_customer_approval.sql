-- Secure quotation approval links and private signed PDF archive.
-- Apply after 0008_payment_confirmation.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS quotation_approvals (
 id SERIAL PRIMARY KEY,
 quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
 token_hash VARCHAR(64) NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'pending',
 signer_name VARCHAR(180) DEFAULT '',
 signer_title VARCHAR(180) DEFAULT '',
 signed_pdf_key VARCHAR(500),
 signed_pdf_sha256 VARCHAR(64),
 uploaded_at TIMESTAMPTZ,
 reviewed_at TIMESTAMPTZ,
 reviewed_by INTEGER REFERENCES users(id),
 review_note TEXT DEFAULT '',
 created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_quote_approval_quote ON quotation_approvals(quotation_id,created_at);
INSERT INTO email_templates(key,subject,html) VALUES
('quotation_approval_request','VORA quotation approval requested - $document_number','<p>Dear $customer_name,</p><p>Please review attached quotation <strong>$document_number</strong>. Download, sign, stamp and upload the PDF using <a href="$approval_url">this secure link</a>.</p><p>Valid until: $valid_until. Link expires: $approval_expiry.</p><p>VORA | Freight & Logistics</p>'),
('quotation_approved_admin','VORA quotation accepted - $document_number','<p>Signed quotation $document_number was manually reviewed by VORA.</p>') ON CONFLICT(key) DO NOTHING;
INSERT INTO email_rules(key,enabled) VALUES
('quotation_approval_request',FALSE),('quotation_approved_admin',FALSE)
ON CONFLICT(key) DO NOTHING;
COMMIT;
