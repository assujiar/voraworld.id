-- Phase 3A: one commercial workflow with two entry points.
--
--   Path A:  Lead -> Customer -> Quotation -> Customer approval -> VORA validation -> Delivery notes (POD) -> Invoice + pre-payment receipt -> Payment -> Receipt
--   Path B:  Customer ------------------^ (no lead at all)
--
-- The CUSTOMER is the commercial entity; the lead is an optional source of business. A new quotation requires a customer and never a lead
-- (quotations.customer_id / quotations.lead_id are both nullable columns so that the historical lead-only quotations stay as they are, but the
-- function that creates a quotation now insists on the customer). A new delivery note is tied to a customer and to one of that customer's
-- VALIDATED quotations; a new invoice is tied to a customer, a validated quotation and the delivery notes it bills (invoice_delivery_notes).
--
-- Forward-only and safe to run again: every column, table and index is IF NOT EXISTS, every function is CREATE OR REPLACE, the template updates only touch a
-- template the owner has not edited (they compare with the previous default), and the status backfill only maps records that carry approval evidence.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Customers: the primary contact person (PIC). `customers.phone` (already there) is the company's general number.
-- ---------------------------------------------------------------------------------------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pic_name     VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pic_position VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pic_email    VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pic_phone    VARCHAR(60)  NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS ix_customers_name_lower ON customers (lower(name));
CREATE INDEX IF NOT EXISTS ix_customers_email_lower ON customers (lower(email));

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Leads: the customer a lead became (kept: the lead itself is never rewritten or deleted).
-- ---------------------------------------------------------------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_id  INTEGER REFERENCES customers (id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_by INTEGER REFERENCES users (id);
CREATE INDEX IF NOT EXISTS ix_leads_customer ON leads (customer_id);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Quotations: who at the customer, what is being quoted, and the two separate milestones after the customer signs.
--   status: draft -> issued -> awaiting_approval -> customer_approved (the customer uploaded the signed PDF)
--           -> validated (VORA checked it) | rejected (needs correction; the approval can be requested again) | void.  Expiry is read from valid_until.
-- ---------------------------------------------------------------------------------------------------------------------------------
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pic_name             VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pic_email            VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pic_phone            VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS service_mode         VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS origin               VARCHAR(240) NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS destination          VARCHAR(240) NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS cargo_info           TEXT         NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_approved_at TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS validated_at         TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS validated_by         INTEGER REFERENCES users (id);
-- Until now a quotation had EITHER a customer OR a lead (quote_one_recipient). It now has a customer and, when the business came from a lead, that lead too; a historical
-- quotation with a lead alone stays valid. The new rule only asks for a recipient; the function that creates a quotation insists on the customer.
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quote_one_recipient;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_has_recipient' AND conrelid = 'quotations'::regclass) THEN
    ALTER TABLE quotations ADD CONSTRAINT quote_has_recipient CHECK (customer_id IS NOT NULL OR lead_id IS NOT NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_quotations_customer ON quotations (customer_id, status);
CREATE INDEX IF NOT EXISTS ix_quotations_lead ON quotations (lead_id);

-- The old single 'approved' state meant "Finance reviewed the customer's signed PDF". That is today's 'validated' - but only for a record that
-- really has that evidence (a reviewed approval with a stored PDF and its fingerprint). Any other 'approved' quotation is left exactly as it is.
UPDATE quotations q
   SET status = 'validated', customer_approved_at = coalesce(q.customer_approved_at, a.uploaded_at), validated_at = coalesce(q.validated_at, a.reviewed_at),
       validated_by = coalesce(q.validated_by, a.reviewed_by)
  FROM (SELECT DISTINCT ON (quotation_id) * FROM quotation_approvals WHERE status = 'approved' AND signed_pdf_key IS NOT NULL AND signed_pdf_sha256 IS NOT NULL AND reviewed_at IS NOT NULL
         ORDER BY quotation_id, reviewed_at DESC) a
 WHERE a.quotation_id = q.id AND q.status = 'approved';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Delivery notes and invoices point at the quotation they come from; an invoice bills delivery notes through a junction table.
-- (Historical rows keep a NULL quotation_id: no relationship is invented for them.)
-- ---------------------------------------------------------------------------------------------------------------------------------
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS quotation_id INTEGER REFERENCES quotations (id);
CREATE INDEX IF NOT EXISTS ix_deliveries_quotation ON deliveries (quotation_id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quotation_id INTEGER REFERENCES quotations (id);
CREATE INDEX IF NOT EXISTS ix_invoices_quotation ON invoices (quotation_id);
CREATE INDEX IF NOT EXISTS ix_invoices_customer ON invoices (customer_id);

-- One live (not released) billing per delivery note: a delivery note can be on only one open invoice. A voided invoice releases its delivery
-- notes (released_at), and the row stays as history.
CREATE TABLE IF NOT EXISTS invoice_delivery_notes (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER     NOT NULL REFERENCES invoices (id),
  delivery_id INTEGER     NOT NULL REFERENCES deliveries (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_delivery_live ON invoice_delivery_notes (delivery_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_delivery_pair ON invoice_delivery_notes (invoice_id, delivery_id);
CREATE INDEX IF NOT EXISTS ix_invoice_delivery_invoice ON invoice_delivery_notes (invoice_id);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- E-mail with more than one attachment (the invoice and its pre-payment receipt travel in ONE message).
-- email_jobs.attachment_kind/attachment_id stay for the single-attachment messages.
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_job_attachments (
  id          SERIAL PRIMARY KEY,
  job_id      INTEGER     NOT NULL REFERENCES email_jobs (id),
  position    INTEGER     NOT NULL DEFAULT 0,
  kind        VARCHAR(20) NOT NULL CHECK (kind IN ('invoice', 'receipt', 'quotation', 'prepayment')),
  document_id INTEGER     NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_email_job_attachments_job ON email_job_attachments (job_id, position);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoice_delivery_notes', 'email_job_attachments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
      EXECUTE format('REVOKE ALL ON SEQUENCE %I FROM anon', t || '_id_seq');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
      EXECUTE format('REVOKE ALL ON SEQUENCE %I FROM authenticated', t || '_id_seq');
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Functions. Business refusals are SQLSTATE VRnnn (vr_fail, migration 0024). Everything stays SECURITY INVOKER, with a pinned search_path.
-- ---------------------------------------------------------------------------------------------------------------------------------

-- p: name, email, phone, address, tax_id, currency, terms_days, pic_name, pic_position, pic_email, pic_phone
CREATE OR REPLACE FUNCTION customer_save(p_actor integer, p_id integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_id integer := p_id; v_currency text; v_used bigint;
BEGIN
  IF p_id IS NOT NULL THEN
    SELECT currency INTO v_currency FROM customers WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM vr_fail(404, 'Customer not found'); END IF;
    IF v_currency <> p->>'currency' THEN
      SELECT (SELECT count(*) FROM invoices WHERE customer_id = p_id) + (SELECT count(*) FROM quotations WHERE customer_id = p_id) INTO v_used;
      IF v_used > 0 THEN PERFORM vr_fail(409, 'Currency cannot change on a customer that already has quotations or invoices'); END IF;
    END IF;
    UPDATE customers SET name = p->>'name', email = p->>'email', phone = coalesce(p->>'phone', ''), address = p->>'address', tax_id = p->>'tax_id', currency = p->>'currency',
           terms_days = (p->>'terms_days')::integer, pic_name = coalesce(p->>'pic_name', ''), pic_position = coalesce(p->>'pic_position', ''),
           pic_email = coalesce(p->>'pic_email', ''), pic_phone = coalesce(p->>'pic_phone', '')
     WHERE id = p_id;
  ELSE
    INSERT INTO customers (name, email, phone, address, tax_id, currency, terms_days, pic_name, pic_position, pic_email, pic_phone)
      VALUES (p->>'name', p->>'email', coalesce(p->>'phone', ''), p->>'address', p->>'tax_id', p->>'currency', (p->>'terms_days')::integer,
              coalesce(p->>'pic_name', ''), coalesce(p->>'pic_position', ''), coalesce(p->>'pic_email', ''), coalesce(p->>'pic_phone', '')) RETURNING id INTO v_id;
  END IF;
  PERFORM vr_public_code('customers', v_id);
  PERFORM vr_audit(p_actor, 'upsert', 'customer', v_id, p->>'name');
  RETURN v_id;
END
$fn$;

-- The public form's phone / WhatsApp number is stored too.
CREATE OR REPLACE FUNCTION lead_create(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_rfq boolean := p->>'kind' = 'rfq'; v_id integer; v_ref text; v_recent integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lead-' || lower(p->>'email')));
  SELECT count(*) INTO v_recent FROM leads WHERE email = p->>'email' AND created_at >= now() - make_interval(mins => (p->>'window_minutes')::integer);
  IF v_recent >= (p->>'max_per_email')::integer THEN PERFORM vr_fail(429, 'Too many submissions; try again later'); END IF;
  INSERT INTO leads (type, name, email, phone, message, company, mode, origin, destination, cargo, pickup, source)
    VALUES (CASE WHEN v_rfq THEN 'RFQ' ELSE 'contact' END, p->>'name', p->>'email', coalesce(p->>'phone', ''), p->>'message', p->>'company',
            CASE WHEN v_rfq THEN p->>'mode' ELSE '' END, CASE WHEN v_rfq THEN p->>'origin' ELSE '' END, CASE WHEN v_rfq THEN p->>'destination' ELSE '' END,
            CASE WHEN v_rfq THEN p->>'cargo' ELSE '' END, CASE WHEN v_rfq THEN p->>'pickup' ELSE '' END, 'website') RETURNING id INTO v_id;
  v_ref := vr_next_number(CASE WHEN v_rfq THEN 'RFQ' ELSE 'INQ' END, vr_public_code('leads', v_id));
  UPDATE leads SET reference = v_ref WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'reference', v_ref);
END
$fn$;

-- A lead becomes (or is linked to) a customer. The lead is kept as it is; the link and who made it are recorded; a lead converts once.
-- p: customer_id (link this existing customer) OR customer {customer_save fields} (create one).
CREATE OR REPLACE FUNCTION lead_convert(p_actor integer, p_lead integer, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_lead leads%ROWTYPE; v_customer integer := nullif(p->>'customer_id', '')::integer; v_created boolean := FALSE; v_name text;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Lead not found'); END IF;
  IF v_lead.customer_id IS NOT NULL THEN PERFORM vr_fail(409, 'This lead was already converted to a customer'); END IF;
  IF v_customer IS NOT NULL THEN
    SELECT name INTO v_name FROM customers WHERE id = v_customer;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
  ELSE
    IF jsonb_typeof(p->'customer') IS DISTINCT FROM 'object' THEN PERFORM vr_fail(422, 'Give the customer''s details or choose an existing customer'); END IF;
    v_customer := customer_save(p_actor, NULL, p->'customer');
    v_created := TRUE;
    v_name := p->'customer'->>'name';
  END IF;
  UPDATE leads SET customer_id = v_customer, converted_at = now(), converted_by = p_actor, updated_at = now() WHERE id = p_lead;
  INSERT INTO lead_activities (lead_id, actor_id, message)
    VALUES (p_lead, p_actor, CASE WHEN v_created THEN 'Saved as a new customer: ' ELSE 'Linked to the existing customer: ' END || v_name);
  PERFORM vr_audit(p_actor, 'convert', 'lead', p_lead, CASE WHEN v_created THEN 'New customer ' ELSE 'Existing customer ' END || v_name);
  RETURN jsonb_build_object('customer_id', v_customer, 'created', v_created);
END
$fn$;

-- p: customer_id (REQUIRED), lead_id (optional, the lead that brought the business), currency, issued_at, valid_until, payment_terms, terms_conditions,
--    notes, tax_percent, subtotal_minor, tax_minor, total_minor, pic_name, pic_email, pic_phone, service_mode, origin, destination, cargo_info,
--    items[{description, unit, quantity, price_minor, amount_minor}]
-- A quotation is numbered under the customer's permanent code. A lead is linked, never required, and never created here.
CREATE OR REPLACE FUNCTION quotation_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_customer integer := nullif(p->>'customer_id', '')::integer; v_lead integer := nullif(p->>'lead_id', '')::integer; v_currency text; v_number text; v_id integer; v_item jsonb;
  v_lead_customer integer; v_name text;
BEGIN
  IF v_customer IS NULL THEN PERFORM vr_fail(422, 'Select the customer this quotation is for'); END IF;
  SELECT currency, name INTO v_currency, v_name FROM customers WHERE id = v_customer;
  IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
  IF v_currency <> p->>'currency' THEN PERFORM vr_fail(409, 'The customer''s currency changed while the quotation was being prepared: try again'); END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one charge item'); END IF;
  IF v_lead IS NOT NULL THEN
    SELECT customer_id INTO v_lead_customer FROM leads WHERE id = v_lead FOR UPDATE;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'The lead does not exist'); END IF;
    IF v_lead_customer IS NOT NULL AND v_lead_customer <> v_customer THEN PERFORM vr_fail(409, 'This lead belongs to another customer'); END IF;
    IF v_lead_customer IS NULL THEN
      UPDATE leads SET customer_id = v_customer, converted_at = now(), converted_by = p_actor, updated_at = now() WHERE id = v_lead;
      INSERT INTO lead_activities (lead_id, actor_id, message) VALUES (v_lead, p_actor, 'Linked to the customer ' || v_name || ' when a quotation was made');
    END IF;
  END IF;
  v_number := vr_next_number('QUO', vr_public_code('customers', v_customer), p->>'issued_at');
  INSERT INTO quotations (number, customer_id, lead_id, status, currency, issued_at, valid_until, payment_terms, terms_conditions, notes, tax_percent, subtotal_minor, tax_minor, total_minor,
                          pic_name, pic_email, pic_phone, service_mode, origin, destination, cargo_info)
    VALUES (v_number, v_customer, v_lead, 'draft', v_currency, p->>'issued_at', p->>'valid_until', p->>'payment_terms', p->>'terms_conditions', p->>'notes', p->>'tax_percent',
            (p->>'subtotal_minor')::bigint, (p->>'tax_minor')::bigint, (p->>'total_minor')::bigint,
            coalesce(p->>'pic_name', ''), coalesce(p->>'pic_email', ''), coalesce(p->>'pic_phone', ''), coalesce(p->>'service_mode', ''), coalesce(p->>'origin', ''),
            coalesce(p->>'destination', ''), coalesce(p->>'cargo_info', '')) RETURNING id INTO v_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO quotation_items (quotation_id, description, unit, quantity, price_minor, amount_minor)
      VALUES (v_id, v_item->>'description', v_item->>'unit', v_item->>'quantity', (v_item->>'price_minor')::bigint, (v_item->>'amount_minor')::bigint);
  END LOOP;
  PERFORM vr_create_verification('quotation', v_id);
  PERFORM vr_audit(p_actor, 'create', 'quotation', v_id, v_number);
  RETURN v_id;
END
$fn$;

-- issue: draft -> issued.  void: any state that is not void; a validated quotation only while no delivery note or invoice that is not void was made from it.
CREATE OR REPLACE FUNCTION quotation_set_status(p_actor integer, p_id integer, p_action text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_q quotations%ROWTYPE;
BEGIN
  SELECT * INTO v_q FROM quotations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Quotation not found'); END IF;
  IF p_action = 'issue' AND v_q.status = 'draft' THEN
    UPDATE quotations SET status = 'issued' WHERE id = p_id;
  ELSIF p_action = 'void' AND v_q.status IN ('draft', 'issued', 'awaiting_approval', 'customer_approved', 'rejected', 'validated', 'approved') THEN
    IF EXISTS (SELECT 1 FROM deliveries WHERE quotation_id = p_id AND status <> 'void') OR EXISTS (SELECT 1 FROM invoices WHERE quotation_id = p_id AND status <> 'void') THEN
      PERFORM vr_fail(409, 'Delivery notes or invoices were made from this quotation: void them first');
    END IF;
    UPDATE quotations SET status = 'void' WHERE id = p_id;
    UPDATE quotation_approvals SET status = 'revoked' WHERE quotation_id = p_id AND status = 'pending';
    UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'quotation' AND document_id = p_id;
  ELSE
    PERFORM vr_fail(409, 'Quotation cannot make that status transition');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'quotation', p_id, v_q.number);
END
$fn$;

-- A rejected quotation (it needs correction) can be sent again.
CREATE OR REPLACE FUNCTION quotation_request_approval(p_actor integer, p_id integer, p_approval integer, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_q quotations%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_q FROM quotations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Quotation not found'); END IF;
  IF v_q.status NOT IN ('issued', 'awaiting_approval', 'rejected') THEN PERFORM vr_fail(409, 'Issue the quotation before requesting customer approval'); END IF;
  IF v_q.valid_until < vr_today() THEN PERFORM vr_fail(409, 'Quotation validity has expired'); END IF;
  UPDATE quotation_approvals SET status = 'revoked' WHERE quotation_id = p_id AND status = 'pending';
  INSERT INTO quotation_approvals (id, quotation_id, token_hash, expires_at, status) VALUES (p_approval, p_id, p_token_hash, p_expires_at, 'pending');
  UPDATE quotations SET status = 'awaiting_approval' WHERE id = p_id;
  SELECT token INTO v_token FROM document_verification_tokens WHERE kind = 'quotation' AND document_id = p_id ORDER BY id LIMIT 1;
  PERFORM vr_audit(p_actor, 'send-approval-request', 'quotation', p_id, format('Customer approval link #%s expires %s', p_approval, to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  RETURN jsonb_build_object('number', v_q.number, 'valid_until', v_q.valid_until, 'verification_token', coalesce(v_token, ''));
END
$fn$;

-- The customer's upload (already checked and stored by the application): the quotation becomes CUSTOMER APPROVED. That is not VORA's validation.
CREATE OR REPLACE FUNCTION approval_submit(p_token_hash text, p_key text, p_sha256 text, p_signer text, p_title text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_item quotation_approvals%ROWTYPE; v_q quotations%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM quotation_approvals WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'This approval link is not valid'); END IF;
  SELECT * INTO v_q FROM quotations WHERE id = v_item.quotation_id FOR UPDATE;
  IF v_item.status <> 'pending' OR v_item.expires_at < now() OR NOT FOUND OR v_q.status <> 'awaiting_approval' THEN
    PERFORM vr_fail(410, 'This approval request has expired or was already used');
  END IF;
  UPDATE quotation_approvals SET signed_pdf_key = p_key, signed_pdf_sha256 = p_sha256, signer_name = p_signer, signer_title = p_title, uploaded_at = now(), status = 'submitted' WHERE id = v_item.id;
  UPDATE quotations SET status = 'customer_approved', customer_approved_at = now() WHERE id = v_q.id;
  PERFORM vr_audit(NULL, 'customer-approval-upload', 'quotation', v_item.quotation_id, format('Customer submission #%s by %s, %s, SHA256 %s', v_item.id, p_signer, p_title, p_sha256));
  RETURN jsonb_build_object('approval_id', v_item.id, 'quotation_id', v_item.quotation_id, 'number', v_q.number, 'signer_name', p_signer, 'signer_title', p_title,
                            'customer_id', v_q.customer_id);
END
$fn$;

-- VORA's decision on the uploaded file: validate (after looking at the signature and the company stamp by hand) or reject with a reason.
CREATE OR REPLACE FUNCTION approval_review(p_actor integer, p_id integer, p_outcome text, p_verified boolean, p_note text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_item quotation_approvals%ROWTYPE; v_q quotations%ROWTYPE;
BEGIN
  IF p_outcome NOT IN ('approve', 'reject') THEN PERFORM vr_fail(422, 'Invalid review outcome'); END IF;
  SELECT * INTO v_item FROM quotation_approvals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_item.status <> 'submitted' THEN PERFORM vr_fail(409, 'Only submitted approvals can be reviewed'); END IF;
  SELECT * INTO v_q FROM quotations WHERE id = v_item.quotation_id FOR UPDATE;
  IF NOT FOUND OR v_q.status <> 'customer_approved' THEN PERFORM vr_fail(409, 'The quotation is not waiting for validation'); END IF;
  IF p_outcome = 'approve' AND NOT coalesce(p_verified, FALSE) THEN PERFORM vr_fail(422, 'Confirm that the signature and company stamp were reviewed manually'); END IF;
  IF p_outcome = 'reject' AND length(btrim(coalesce(p_note, ''))) < 5 THEN PERFORM vr_fail(422, 'Give the reason the document is rejected (at least 5 characters)'); END IF;
  UPDATE quotation_approvals SET status = CASE WHEN p_outcome = 'approve' THEN 'approved' ELSE 'rejected' END, reviewed_by = p_actor, reviewed_at = now(), review_note = left(p_note, 2000) WHERE id = p_id;
  IF p_outcome = 'approve' THEN
    UPDATE quotations SET status = 'validated', validated_at = now(), validated_by = p_actor WHERE id = v_q.id;
  ELSE
    UPDATE quotations SET status = 'rejected' WHERE id = v_q.id;
  END IF;
  PERFORM vr_audit(p_actor, CASE WHEN p_outcome = 'approve' THEN 'validate-quotation' ELSE 'reject-quotation' END, 'quotation', v_q.id, format('Approval #%s; PDF checksum %s', p_id, v_item.signed_pdf_sha256));
  RETURN jsonb_build_object('quotation_id', v_q.id, 'number', v_q.number, 'customer_id', v_q.customer_id);
END
$fn$;

-- p: customer_id, quotation_id (both REQUIRED for a new note: a delivery is made for a customer's VALIDATED quotation), consignee_*, origin, ...
--    (as before), capture_token, view_token, items[{description, quantity, unit, remarks}]
CREATE OR REPLACE FUNCTION delivery_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_customer integer := nullif(p->>'customer_id', '')::integer; v_quotation integer := nullif(p->>'quotation_id', '')::integer; v_q quotations%ROWTYPE; v_number text; v_id integer;
BEGIN
  IF v_customer IS NULL THEN PERFORM vr_fail(422, 'Select the customer'); END IF;
  PERFORM 1 FROM customers WHERE id = v_customer;
  IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
  IF v_quotation IS NULL THEN PERFORM vr_fail(422, 'Select one of the customer''s validated quotations'); END IF;
  SELECT * INTO v_q FROM quotations WHERE id = v_quotation FOR SHARE;
  IF NOT FOUND OR v_q.customer_id IS DISTINCT FROM v_customer THEN PERFORM vr_fail(422, 'The quotation does not belong to this customer'); END IF;
  IF v_q.status <> 'validated' THEN PERFORM vr_fail(409, 'Delivery notes can only be made for a validated quotation'); END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one item'); END IF;
  v_number := vr_next_number('DLV', vr_public_code('customers', v_customer), p->>'delivery_date');
  INSERT INTO deliveries (number, status, customer_id, quotation_id, consignee_name, consignee_address, consignee_contact, consignee_phone, consignee_email, origin, destination,
      shipment_reference, po_number, carrier, vehicle, vehicle_plate, driver_name, driver_phone, delivery_date, notes, capture_token, view_token, created_by)
    VALUES (v_number, 'draft', v_customer, v_quotation, p->>'consignee_name', p->>'consignee_address', p->>'consignee_contact', p->>'consignee_phone', p->>'consignee_email', p->>'origin', p->>'destination',
      p->>'shipment_reference', p->>'po_number', p->>'carrier', p->>'vehicle', p->>'vehicle_plate', p->>'driver_name', p->>'driver_phone', p->>'delivery_date', p->>'notes',
      p->>'capture_token', p->>'view_token', p_actor)
    RETURNING id INTO v_id;
  INSERT INTO delivery_items (delivery_id, position, description, quantity, unit, remarks)
    SELECT v_id, (t.ord - 1)::integer, t.x->>'description', t.x->>'quantity', t.x->>'unit', t.x->>'remarks' FROM jsonb_array_elements(p->'items') WITH ORDINALITY AS t(x, ord);
  PERFORM vr_audit(p_actor, 'create', 'delivery', v_id, v_number || ' for quotation ' || v_q.number);
  RETURN v_id;
END
$fn$;

-- Only a draft can be edited. Its customer and quotation stay as they were made.
CREATE OR REPLACE FUNCTION delivery_update(p_actor integer, p_id integer, p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_d deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Delivery note not found'); END IF;
  IF v_d.status <> 'draft' THEN PERFORM vr_fail(409, 'Only a draft can be edited: void this delivery note and write a new one'); END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one item'); END IF;
  UPDATE deliveries SET consignee_name = p->>'consignee_name', consignee_address = p->>'consignee_address', consignee_contact = p->>'consignee_contact',
      consignee_phone = p->>'consignee_phone', consignee_email = p->>'consignee_email', origin = p->>'origin', destination = p->>'destination', shipment_reference = p->>'shipment_reference',
      po_number = p->>'po_number', carrier = p->>'carrier', vehicle = p->>'vehicle', vehicle_plate = p->>'vehicle_plate', driver_name = p->>'driver_name', driver_phone = p->>'driver_phone',
      delivery_date = p->>'delivery_date', notes = p->>'notes', updated_at = now()
    WHERE id = p_id;
  DELETE FROM delivery_items WHERE delivery_id = p_id;
  INSERT INTO delivery_items (delivery_id, position, description, quantity, unit, remarks)
    SELECT p_id, (t.ord - 1)::integer, t.x->>'description', t.x->>'quantity', t.x->>'unit', t.x->>'remarks' FROM jsonb_array_elements(p->'items') WITH ORDINALITY AS t(x, ord);
  PERFORM vr_audit(p_actor, 'update', 'delivery', p_id, v_d.number);
END
$fn$;

-- p: as before, plus quotation_id and delivery_ids[] (REQUIRED), over_quotation_ack (boolean).
-- The invoice is for one customer's VALIDATED quotation and bills delivery notes that have a proof of delivery, belong to that customer and that
-- quotation, and are not on another open invoice. The quotation row is locked first, so two invoices cannot both be checked against the same
-- balance; then the delivery notes are locked in a fixed order. The billed total of the quotation may not pass its quoted subtotal unless the
-- administrator acknowledged it.
CREATE OR REPLACE FUNCTION invoice_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cust customers%ROWTYPE; v_q quotations%ROWTYPE; v_quotation integer := nullif(p->>'quotation_id', '')::integer; v_dels integer[]; v_d deliveries%ROWTYPE; v_del_id integer;
  v_ids integer[]; v_bank bank_accounts%ROWTYPE; v_default integer; v_number text; v_id integer; v_bank_id integer; v_pos integer := 0; v_item jsonb; v_billed bigint;
BEGIN
  SELECT * INTO v_cust FROM customers WHERE id = (p->>'customer_id')::integer;
  IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
  IF v_cust.currency <> p->>'currency' THEN PERFORM vr_fail(409, 'The customer''s currency changed while the invoice was being prepared: try again'); END IF;
  IF v_quotation IS NULL THEN PERFORM vr_fail(422, 'Select one of the customer''s validated quotations'); END IF;
  SELECT * INTO v_q FROM quotations WHERE id = v_quotation FOR UPDATE;
  IF NOT FOUND OR v_q.customer_id IS DISTINCT FROM v_cust.id THEN PERFORM vr_fail(422, 'The quotation does not belong to this customer'); END IF;
  IF v_q.status <> 'validated' THEN PERFORM vr_fail(409, 'Only a validated quotation can be invoiced'); END IF;
  IF v_q.currency <> v_cust.currency THEN PERFORM vr_fail(409, 'The quotation and the invoice must be in the same currency'); END IF;

  SELECT coalesce(array_agg(DISTINCT t.value::integer ORDER BY t.value::integer), '{}') INTO v_dels FROM jsonb_array_elements_text(coalesce(p->'delivery_ids', '[]'::jsonb)) AS t(value);
  IF cardinality(v_dels) = 0 THEN PERFORM vr_fail(422, 'Select at least one delivery note to bill'); END IF;
  IF cardinality(v_dels) <> jsonb_array_length(p->'delivery_ids') THEN PERFORM vr_fail(422, 'A delivery note was selected twice'); END IF;
  FOREACH v_del_id IN ARRAY v_dels LOOP
    SELECT * INTO v_d FROM deliveries WHERE id = v_del_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'A selected delivery note does not exist'); END IF;
    IF v_d.customer_id IS DISTINCT FROM v_cust.id THEN PERFORM vr_fail(422, 'Delivery note ' || v_d.number || ' belongs to another customer'); END IF;
    IF v_d.quotation_id IS DISTINCT FROM v_quotation THEN PERFORM vr_fail(422, 'Delivery note ' || v_d.number || ' belongs to another quotation'); END IF;
    IF v_d.status <> 'delivered' THEN PERFORM vr_fail(409, 'Delivery note ' || v_d.number || ' has no recorded proof of delivery yet'); END IF;
    IF EXISTS (SELECT 1 FROM invoice_delivery_notes WHERE delivery_id = v_del_id AND released_at IS NULL) THEN PERFORM vr_fail(409, 'Delivery note ' || v_d.number || ' is already billed on another invoice'); END IF;
  END LOOP;
  SELECT coalesce(sum(subtotal_minor), 0)::bigint INTO v_billed FROM invoices WHERE quotation_id = v_quotation AND status <> 'void';
  IF v_billed + (p->>'subtotal_minor')::bigint > v_q.subtotal_minor AND NOT coalesce((p->>'over_quotation_ack')::boolean, FALSE) THEN
    PERFORM vr_fail(409, format('The invoices for this quotation would total %s against %s quoted: check the amounts, or acknowledge that this is intended', v_billed + (p->>'subtotal_minor')::bigint, v_q.subtotal_minor));
  END IF;

  SELECT coalesce(array_agg(t.value::integer ORDER BY t.ord), '{}') INTO v_ids FROM jsonb_array_elements_text(coalesce(p->'bank_ids', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord);
  IF cardinality(v_ids) = 0 THEN
    SELECT id INTO v_default FROM bank_accounts WHERE currency = v_cust.currency AND active AND is_default;
    IF FOUND THEN v_ids := ARRAY[v_default]; END IF;
  END IF;
  FOREACH v_bank_id IN ARRAY v_ids LOOP
    SELECT * INTO v_bank FROM bank_accounts WHERE id = v_bank_id;
    IF NOT FOUND OR NOT v_bank.active OR v_bank.currency <> v_cust.currency THEN PERFORM vr_fail(422, 'Only active bank accounts in the invoice currency can be selected'); END IF;
  END LOOP;

  v_number := vr_next_number('INV', vr_public_code('customers', v_cust.id), p->>'issued_at');
  INSERT INTO invoices (number, customer_id, quotation_id, status, currency, issued_at, due_at, po_number, shipment_reference, service_mode, origin, destination,
      transport_document_ref, notes, tax_percent, withholding_percent, discount_minor, subtotal_minor, tax_minor, withholding_minor, total_minor, outstanding_minor)
    VALUES (v_number, v_cust.id, v_quotation, 'draft', v_cust.currency, p->>'issued_at', p->>'due_at', p->>'po_number', p->>'shipment_reference', p->>'service_mode', p->>'origin', p->>'destination',
      p->>'transport_document_ref', p->>'notes', p->>'tax_percent', p->>'withholding_percent', (p->>'discount_minor')::bigint, (p->>'subtotal_minor')::bigint, (p->>'tax_minor')::bigint,
      (p->>'withholding_minor')::bigint, (p->>'total_minor')::bigint, (p->>'total_minor')::bigint) RETURNING id INTO v_id;
  FOREACH v_del_id IN ARRAY v_dels LOOP
    INSERT INTO invoice_delivery_notes (invoice_id, delivery_id) VALUES (v_id, v_del_id);
  END LOOP;
  FOREACH v_bank_id IN ARRAY v_ids LOOP
    SELECT * INTO v_bank FROM bank_accounts WHERE id = v_bank_id;
    INSERT INTO invoice_bank_instructions (invoice_id, bank_account_id, bank_name, account_number, account_holder, currency, branch, swift_code, position)
      VALUES (v_id, v_bank.id, v_bank.bank_name, v_bank.account_number, v_bank.account_holder, v_bank.currency, v_bank.branch, v_bank.swift_code, v_pos);
    v_pos := v_pos + 1;
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO invoice_items (invoice_id, description, unit, quantity, price_minor, amount_minor)
      VALUES (v_id, v_item->>'description', v_item->>'unit', v_item->>'quantity', (v_item->>'price_minor')::bigint, (v_item->>'amount_minor')::bigint);
  END LOOP;
  PERFORM vr_create_verification('invoice', v_id);
  -- Every invoice comes with its pre-payment receipt (a draft until the invoice is issued). It is not a payment: it never changes the balance.
  PERFORM vr_create_prepayment(v_id, v_cust.id, v_cust.currency, (p->>'total_minor')::bigint, p->>'issued_at', coalesce((p->>'stamp_required')::boolean, FALSE));
  PERFORM vr_audit(p_actor, 'create', 'invoice', v_id, v_number || ' for quotation ' || v_q.number);
  RETURN v_id;
END
$fn$;

-- As before, and a voided invoice lets its delivery notes be billed again (the link stays as history).
CREATE OR REPLACE FUNCTION invoice_set_status(p_actor integer, p_id integer, p_action text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_inv invoices%ROWTYPE; v_cancelled integer;
BEGIN
  SELECT * INTO v_inv FROM invoices WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Invoice not found'); END IF;
  IF p_action = 'issue' AND v_inv.status = 'draft' THEN
    UPDATE invoices SET status = 'issued' WHERE id = p_id;
    PERFORM vr_release_prepayment(p_id);
  ELSIF p_action = 'void' AND v_inv.status NOT IN ('void', 'paid', 'partially_paid') THEN
    UPDATE invoices SET status = 'void' WHERE id = p_id;
    UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'invoice' AND document_id = p_id;
    PERFORM vr_void_prepayments_of(p_id);
    UPDATE invoice_delivery_notes SET released_at = now() WHERE invoice_id = p_id AND released_at IS NULL;
    WITH c AS (UPDATE payments SET status = 'cancelled' WHERE invoice_id = p_id AND status = 'pending_confirmation' RETURNING id) SELECT count(*) INTO v_cancelled FROM c;
    IF v_cancelled > 0 THEN PERFORM vr_audit(p_actor, 'cancel-unconfirmed-payment', 'invoice', p_id, v_cancelled || ' open payment claim(s) cancelled with the void'); END IF;
  ELSE
    PERFORM vr_fail(409, 'Invalid state change. Reverse confirmed payments (void their receipts) before voiding an invoice');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'invoice', p_id, v_inv.number);
END
$fn$;

-- The stamped receipt is released: what the customer's email needs (the amount and date of the payment it is for) comes back with it.
CREATE OR REPLACE FUNCTION receipt_stamp_commit(p_actor integer, p_id integer, p_key text, p_sha256 text, p_reference text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_receipt receipts%ROWTYPE; v_inv invoices%ROWTYPE; v_cust customers%ROWTYPE; v_pay payments%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_receipt FROM receipts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.status <> 'pending_stamp' OR NOT v_receipt.stamp_required THEN PERFORM vr_fail(409, 'This receipt is not waiting for a manual e-meterai'); END IF;
  SELECT * INTO v_inv FROM invoices WHERE id = v_receipt.invoice_id;
  SELECT * INTO v_cust FROM customers WHERE id = v_inv.customer_id;
  SELECT * INTO v_pay FROM payments WHERE id = v_receipt.payment_id;
  UPDATE receipts SET stamp_storage_key = p_key, stamp_sha256 = p_sha256, stamp_uploaded_at = now(), stamp_uploaded_by = p_actor, stamp_provider_reference = p_reference, status = 'issued' WHERE id = p_id;
  SELECT token INTO v_token FROM document_verification_tokens WHERE kind = 'receipt' AND document_id = p_id ORDER BY id LIMIT 1;
  PERFORM vr_audit(p_actor, 'stamp-upload', 'receipt', p_id, 'Official e-meterai reference: ' || p_reference || '; sha256: ' || p_sha256);
  RETURN jsonb_build_object('receipt_number', v_receipt.number, 'token', coalesce(v_token, ''), 'invoice_number', v_inv.number, 'currency', v_inv.currency,
    'payment', jsonb_build_object('amount_minor', v_pay.amount_minor, 'date', v_pay.date, 'reference', v_pay.reference),
    'customer', jsonb_build_object('name', v_cust.name, 'email', v_cust.email));
END
$fn$;

-- Queues ONE message with its attachments, all or nothing (a message without its attachments must never exist). `dedupe_key` makes it idempotent:
-- a second call with the same key returns the message already queued. p: event, recipient, subject, html, dedupe_key, attachments[{kind, id}].
CREATE OR REPLACE FUNCTION mail_enqueue(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_id integer; v_status text; v_att jsonb; v_pos integer := 0;
BEGIN
  IF jsonb_typeof(p->'attachments') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'attachments') = 0 THEN PERFORM vr_fail(422, 'A message with attachments needs at least one'); END IF;
  INSERT INTO email_jobs (event, recipient, subject, html, status, attempts, dedupe_key)
    VALUES (p->>'event', p->>'recipient', p->>'subject', p->>'html', 'queued', 0, nullif(p->>'dedupe_key', ''))
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, status INTO v_id, v_status;
  IF v_id IS NULL THEN
    SELECT id, status INTO v_id, v_status FROM email_jobs WHERE dedupe_key = p->>'dedupe_key';
    RETURN jsonb_build_object('id', v_id, 'status', v_status, 'created', FALSE);
  END IF;
  FOR v_att IN SELECT * FROM jsonb_array_elements(p->'attachments') LOOP
    INSERT INTO email_job_attachments (job_id, position, kind, document_id) VALUES (v_id, v_pos, v_att->>'kind', (v_att->>'id')::integer);
    v_pos := v_pos + 1;
  END LOOP;
  RETURN jsonb_build_object('id', v_id, 'status', v_status, 'created', TRUE);
END
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- E-mail wording. The new messages start switched off like every notification. A template the owner has edited is never touched: the
-- UPDATEs below apply only where the stored subject and text are still exactly the previous default.
-- ---------------------------------------------------------------------------------------------------------------------------------
INSERT INTO email_templates (key, subject, html) VALUES
  ('quotation_customer_approved_admin', $vora$VORA quotation signed by the customer - $document_number$vora$, $vora$<p>$customer_name has uploaded the signed quotation <strong>$document_number</strong> (signed by $signer_name, $signer_title).</p><p>Check the signature and the company stamp, then validate or reject it: <a href="$admin_url">Open the quotation</a>.</p>$vora$),
  ('quotation_validated_customer', $vora$VORA quotation validated - $document_number$vora$, $vora$<p>Dear $customer_name,</p><p>We have received your signed quotation <strong>$document_number</strong> and VORA has validated it. We will arrange the delivery with you accordingly.</p><p>VORA | Freight & Logistics</p>$vora$)
ON CONFLICT (key) DO NOTHING;
INSERT INTO email_rules (key, enabled) VALUES
  ('quotation_customer_approved_admin', FALSE),
  ('quotation_validated_customer', FALSE)
ON CONFLICT (key) DO NOTHING;

-- The invoice email now carries the invoice AND its pre-payment receipt.
UPDATE email_templates
   SET subject = $vora$VORA invoice $document_number$vora$,
       html = $vora$<p>Dear $customer_name,</p><p>Please find attached invoice <strong>$document_number</strong> ($document_date) and its pre-payment receipt <strong>$prepayment_number</strong>, in this one email.</p><p>The pre-payment receipt is prepared for your internal payment process. It is not proof that payment has been made: VORA issues the official payment receipt once the funds are credited to its bank account.</p><p>Verify the invoice using the QR code in the PDF or the link: <a href="$verify_url">Verify invoice</a>.</p><p>VORA | Freight & Logistics</p>$vora$
 WHERE key = 'invoice_customer'
   AND subject = $vora$VORA invoice $document_number$vora$
   AND html = $vora$<p>Dear $customer_name,</p><p>Please find attached invoice <strong>$document_number</strong> ($document_date).</p><p>Verify the document using the QR code in the PDF or the link: <a href="$verify_url">Verify invoice</a>.</p><p>VORA | Freight & Logistics</p>$vora$;

-- The official receipt email names the invoice, the confirmed amount and the date.
UPDATE email_templates
   SET subject = $vora$VORA | Payment Receipt $document_number$vora$,
       html = $vora$<p>Dear $customer_name,</p><p>Thank you. We confirm that your payment of <strong>$payment_amount</strong> was received on $payment_date for invoice <strong>$invoice_number</strong>.</p><p>Your official payment receipt <strong>$document_number</strong> is attached. Verify the document through the QR code or <a href="$verify_url">online verification</a>.</p><p>VORA | Freight & Logistics</p>$vora$
 WHERE key = 'receipt_customer'
   AND subject = $vora$VORA payment receipt $document_number$vora$
   AND html = $vora$<p>Dear $customer_name,</p><p>Your payment receipt <strong>$document_number</strong> is attached. Verify the document through the QR code or <a href="$verify_url">online verification</a>.</p><p>VORA | Freight & Logistics</p>$vora$;

-- The administrator's notice of a new inquiry shows the phone number.
UPDATE email_templates
   SET html = $vora$<h2>New $lead_type inquiry</h2><p>Reference: <strong>#$lead_id</strong></p><p>From: $name ($company)</p><p>Email: $email</p><p>Phone / WhatsApp: $phone</p><p>Service: $mode</p><p>Origin: $origin &nbsp; Destination: $destination</p><p>Message: $message</p><p>Open in admin: <a href="$admin_url">Lead #$lead_id</a></p>$vora$
 WHERE key = 'lead_admin'
   AND html = $vora$<h2>New $lead_type inquiry</h2><p>Reference: <strong>#$lead_id</strong></p><p>From: $name ($company)</p><p>Email: $email</p><p>Service: $mode</p><p>Origin: $origin &nbsp; Destination: $destination</p><p>Message: $message</p><p>Open in admin: <a href="$admin_url">Lead #$lead_id</a></p>$vora$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- The new functions are closed to everyone but the server's secret key (service_role), like the others.
-- ---------------------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('customer_save', 'lead_create', 'lead_convert', 'quotation_create', 'quotation_set_status', 'quotation_request_approval', 'approval_submit',
             'approval_review', 'delivery_create', 'delivery_update', 'invoice_create', 'invoice_set_status', 'receipt_stamp_commit', 'mail_enqueue')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
