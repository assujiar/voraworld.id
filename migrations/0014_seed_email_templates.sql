-- Seeds every email template and notification rule the application can trigger.
-- Migrations 0008/0009 seeded only three of the eight events; production never runs the development-only
-- init_db() bootstrap, so without this the invoice, receipt, lead and reply emails could not be enabled.
-- Idempotent: existing rows, including any edited in the admin portal, are left untouched.
-- Keep in step with vora/mail.py EVENTS (tests/test_mail_seed.py fails if they drift).
INSERT INTO email_templates (key, subject, html) VALUES
  ('lead_admin', $vora$New VORA $lead_type inquiry - #$lead_id$vora$, $vora$<h2>New $lead_type inquiry</h2><p>Reference: <strong>#$lead_id</strong></p><p>From: $name ($company)</p><p>Email: $email</p><p>Service: $mode</p><p>Origin: $origin &nbsp; Destination: $destination</p><p>Message: $message</p><p>Open in admin: <a href="$admin_url">Lead #$lead_id</a></p>$vora$),
  ('lead_customer', $vora$VORA inquiry received - #$lead_id$vora$, $vora$<p>Dear $name,</p><p>Thank you for contacting VORA. Your $lead_type inquiry (#$lead_id) has been received. Our team will review the details and respond by email.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('invoice_customer', $vora$VORA invoice $document_number$vora$, $vora$<p>Dear $customer_name,</p><p>Please find attached invoice <strong>$document_number</strong> ($document_date).</p><p>Verify the document using the QR code in the PDF or the link: <a href="$verify_url">Verify invoice</a>.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('receipt_customer', $vora$VORA payment receipt $document_number$vora$, $vora$<p>Dear $customer_name,</p><p>Your payment receipt <strong>$document_number</strong> is attached. Verify the document through the QR code or <a href="$verify_url">online verification</a>.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('payment_confirmed', $vora$VORA payment confirmation - $invoice_number$vora$, $vora$<p>Dear $customer_name,</p><p>We confirm that your payment of <strong>$payment_amount</strong> has been credited to PT Satu Arah International on $payment_date.</p><p>Invoice: <strong>$invoice_number</strong><br>Payment reference: $payment_reference<br>Invoice status: <strong>$invoice_status</strong><br>Outstanding balance: <strong>$outstanding_amount</strong></p><p>For your records, the official receipt will be delivered separately when any required administrative formalities have been completed.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('quotation_approval_request', $vora$VORA quotation approval requested - $document_number$vora$, $vora$<p>Dear $customer_name,</p><p>Please review the attached quotation <strong>$document_number</strong>. You can download, sign and stamp the quotation and securely upload the signed PDF at <a href="$approval_url">the customer approval link</a>.</p><p>Valid until: $valid_until. The approval link will expire on $approval_expiry.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('quotation_approved_admin', $vora$VORA quotation accepted - $document_number$vora$, $vora$<p>Quotation $document_number has been reviewed and approved by VORA Finance. A signed/stamped PDF is retained in the private document archive.</p>$vora$),
  ('lead_reply', $vora$Regarding your VORA inquiry #$lead_id$vora$, $vora$<p>Dear $name,</p><p>$reply_message</p><p>VORA | Freight & Logistics</p>$vora$)
ON CONFLICT (key) DO NOTHING;
INSERT INTO email_rules (key, enabled) VALUES
  ('lead_admin', FALSE),
  ('lead_customer', FALSE),
  ('invoice_customer', FALSE),
  ('receipt_customer', FALSE),
  ('payment_confirmed', FALSE),
  ('quotation_approval_request', FALSE),
  ('quotation_approved_admin', FALSE),
  ('lead_reply', FALSE)
ON CONFLICT (key) DO NOTHING;
