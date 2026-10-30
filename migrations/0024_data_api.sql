-- The database functions behind the Supabase Data API.
--
-- The application no longer opens a database connection of its own (no DATABASE_URL). It talks to the database through supabase-js with the
-- project's secret key (server side only): plain reads and writes use the table endpoints, and every operation that must stay consistent across
-- several statements is ONE function call here, so it is ONE transaction (PostgREST runs each call in its own).
--
-- Security of every function in this file
--   * Callable only by `service_role` (the secret key). EXECUTE is revoked from PUBLIC, anon and authenticated, and default privileges are
--     changed so a function added later is closed too. Nobody holding the publishable key, and nobody signed in, can call any of them.
--   * SECURITY INVOKER: a function runs with the caller's own rights (service_role), never with more, so it cannot be used to climb to the
--     rights of its owner. Because nothing here is SECURITY DEFINER, RLS and grants apply exactly as they do to direct table access.
--   * `search_path` is pinned (public, pg_temp) on every function, so a look-alike object in another schema cannot take over a name.
--   * Business refusals are raised with SQLSTATE `VRnnn` (nnn = the HTTP-like status, e.g. VR409 "already confirmed"); the application turns
--     them into form messages. Anything else is an unexpected failure and is reported as one.
--   * Row locks are taken in one fixed order everywhere (invoice, then payment, then receipt), numbers are allocated under a transaction-scoped
--     advisory lock and backed by unique indexes, and every state change writes its audit row in the same transaction.
--
-- What stays in the application: parsing and validating what a person typed, money arithmetic, PDF inspection, file storage and the rendering
-- and queuing of email. The functions re-check everything a concurrent request could have changed (state, balances, existence).

-- ============================================================================
-- Helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION vr_fail(p_status integer, p_message text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  RAISE EXCEPTION '%', p_message USING ERRCODE = 'VR' || lpad(p_status::text, 3, '0');
END
$fn$;

-- "Today" on a document is the date in Jakarta, not in UTC.
CREATE OR REPLACE FUNCTION vr_today() RETURNS text
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')
$fn$;

CREATE OR REPLACE FUNCTION vr_audit(p_actor integer, p_verb text, p_type text, p_id integer, p_summary text DEFAULT '') RETURNS void
LANGUAGE sql SET search_path = public, pg_temp AS $fn$
  INSERT INTO audit_logs (actor_id, verb, object_type, object_id, summary) VALUES (p_actor, p_verb, p_type, p_id, left(coalesce(p_summary, ''), 1000))
$fn$;

-- Stable, random per-customer / per-lead reference (C or L + 10 hex). Never derived from a name or an email.
-- `public_code IS NULL` in the UPDATE makes concurrent allocators converge on whichever code was stored first.
CREATE OR REPLACE FUNCTION vr_public_code(p_table text, p_id integer) RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_prefix text; v_existing text; v_candidate text; v_stored text; v_taken boolean; v_n bigint; i integer;
BEGIN
  IF p_table = 'customers' THEN v_prefix := 'C'; ELSIF p_table = 'leads' THEN v_prefix := 'L'; ELSE RAISE EXCEPTION 'Unsupported owner table'; END IF;
  EXECUTE format('SELECT count(*), max(public_code) FROM %I WHERE id = $1', p_table) INTO v_n, v_existing USING p_id;      -- EXECUTE does not set FOUND
  IF v_n = 0 THEN RAISE EXCEPTION 'Owner not found'; END IF;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  FOR i IN 1..60 LOOP
    v_candidate := v_prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE public_code = $1)', p_table) INTO v_taken USING v_candidate;
    CONTINUE WHEN v_taken;
    v_stored := NULL;
    EXECUTE format('UPDATE %I SET public_code = $1 WHERE id = $2 AND public_code IS NULL RETURNING public_code', p_table) INTO v_stored USING v_candidate, p_id;
    IF v_stored IS NOT NULL THEN RETURN v_stored; END IF;
    EXECUTE format('SELECT public_code FROM %I WHERE id = $1', p_table) INTO v_existing USING p_id;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END LOOP;
  RAISE EXCEPTION 'Cannot allocate a unique owner code';
END
$fn$;

-- The company's own code (V + 10 hex): the owner of documents that are not for one customer. Stored once in the settings.
CREATE OR REPLACE FUNCTION vr_company_code() RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_code text;
BEGIN
  SELECT value INTO v_code FROM settings WHERE key = 'company_code';
  IF v_code ~ '^V[A-F0-9]{10}$' THEN RETURN v_code; END IF;
  INSERT INTO settings (key, value, updated_at) VALUES ('company_code', 'V' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), now())
    ON CONFLICT (key) DO NOTHING;
  SELECT value INTO v_code FROM settings WHERE key = 'company_code';
  IF v_code IS NULL OR v_code !~ '^V[A-F0-9]{10}$' THEN RAISE EXCEPTION 'Cannot allocate the company code'; END IF;
  RETURN v_code;
END
$fn$;

-- KIND-VORA-OWNER-YYYYMM-RANDOM5. The last five digits are random, not a running counter. A transaction-scoped advisory lock serialises
-- allocation per (kind, owner, month); the unique index on the column stays the ultimate guard. Call it in the transaction that inserts the row.
CREATE OR REPLACE FUNCTION vr_next_number(p_kind text, p_owner text, p_date text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_kind text := upper(p_kind); v_table text; v_column text; v_day text := coalesce(p_date, vr_today()); v_scope text; v_candidate text; v_taken boolean; i integer;
BEGIN
  v_table := CASE v_kind WHEN 'INV' THEN 'invoices' WHEN 'RCP' THEN 'receipts' WHEN 'PPR' THEN 'prepayment_receipts' WHEN 'QUO' THEN 'quotations'
                         WHEN 'RFQ' THEN 'leads' WHEN 'INQ' THEN 'leads' WHEN 'DLV' THEN 'deliveries' ELSE 'documents' END;
  v_column := CASE v_table WHEN 'leads' THEN 'reference' ELSE 'number' END;
  IF v_table = 'documents' AND v_kind !~ '^[A-Z]{2,4}$' THEN RAISE EXCEPTION 'Unsupported document kind'; END IF;
  IF p_owner IS NULL OR p_owner !~ '^[CLV][A-F0-9]{10}$' THEN RAISE EXCEPTION 'Invalid owner code'; END IF;
  IF v_day !~ '^\d{4}-\d{2}-\d{2}' THEN RAISE EXCEPTION 'Invalid date'; END IF;
  v_scope := v_kind || '-VORA-' || p_owner || '-' || substr(v_day, 1, 4) || substr(v_day, 6, 2) || '-';
  PERFORM pg_advisory_xact_lock(hashtext(v_scope));
  FOR i IN 1..160 LOOP
    v_candidate := v_scope || lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))::bit(28)::integer) % 100000)::text, 5, '0');
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE %I = $1)', v_table, v_column) INTO v_taken USING v_candidate;
    IF NOT v_taken THEN RETURN v_candidate; END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not allocate a unique five-digit document number';
END
$fn$;

-- Opaque public token for a QR code: 36 random bytes, URL-safe base64. Only its SHA-256 is needed for lookup; the token is kept to print the URL.
CREATE OR REPLACE FUNCTION vr_create_verification(p_kind text, p_document integer) RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_token text;
BEGIN
  v_token := translate(encode(substring(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex') FROM 1 FOR 36), 'base64'), '+/=', '-_');
  INSERT INTO document_verification_tokens (token, token_hash, kind, document_id) VALUES (v_token, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_kind, p_document);
  RETURN v_token;
END
$fn$;

-- A frozen copy of a bank account, kept by invoices and payments so later edits never alter issued documents.
CREATE OR REPLACE FUNCTION vr_bank_snapshot(p_bank bank_accounts) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT jsonb_build_object('bank_name', coalesce(p_bank.bank_name, ''), 'account_number', coalesce(p_bank.account_number, ''), 'account_holder', coalesce(p_bank.account_holder, ''),
                            'currency', coalesce(p_bank.currency, ''), 'branch', coalesce(p_bank.branch, ''), 'swift_code', coalesce(p_bank.swift_code, ''))
$fn$;

-- Recomputes balance and status from the confirmed payments. A payment total above the invoice is a hard error.
CREATE OR REPLACE FUNCTION vr_recompute_outstanding(p_invoice integer, OUT o_outstanding bigint, OUT o_status text) RETURNS record
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_total bigint; v_status text; v_paid bigint;
BEGIN
  SELECT i.total_minor, i.status INTO v_total, v_status FROM invoices i WHERE i.id = p_invoice;
  SELECT coalesce(sum(p.amount_minor), 0)::bigint INTO v_paid FROM payments p WHERE p.invoice_id = p_invoice AND p.status = 'recorded';
  IF v_paid > v_total THEN PERFORM vr_fail(409, 'Confirmed payments exceed the invoice total'); END IF;
  o_outstanding := v_total - v_paid;
  o_status := CASE WHEN v_status = 'void' THEN 'void' WHEN o_outstanding = 0 THEN 'paid' WHEN v_paid > 0 THEN 'partially_paid' ELSE 'issued' END;
  UPDATE invoices SET outstanding_minor = o_outstanding, status = o_status WHERE id = p_invoice;
END
$fn$;

-- The pre-payment receipt made together with an invoice (a draft until the invoice is issued). Nothing is owed on a zero invoice.
CREATE OR REPLACE FUNCTION vr_create_prepayment(p_invoice integer, p_customer integer, p_currency text, p_total bigint, p_issued_at text, p_stamp_required boolean) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_number text; v_id integer;
BEGIN
  IF p_total <= 0 THEN RETURN NULL; END IF;
  v_number := vr_next_number('PPR', vr_public_code('customers', p_customer), p_issued_at);
  INSERT INTO prepayment_receipts (number, invoice_id, status, currency, amount_minor, stamp_required) VALUES (v_number, p_invoice, 'draft', p_currency, p_total, p_stamp_required) RETURNING id INTO v_id;
  PERFORM vr_create_verification('prepayment', v_id);
  RETURN v_id;
END
$fn$;

-- The invoice is issued: a receipt that needs no stamp is released now, the others wait for their e-meterai.
CREATE OR REPLACE FUNCTION vr_release_prepayment(p_invoice integer) RETURNS void
LANGUAGE sql SET search_path = public, pg_temp AS $fn$
  UPDATE prepayment_receipts SET status = CASE WHEN stamp_required THEN 'pending_stamp' ELSE 'issued' END WHERE invoice_id = p_invoice AND status = 'draft'
$fn$;

-- The invoice is void: its pre-payment receipt and its QR link go with it.
CREATE OR REPLACE FUNCTION vr_void_prepayments_of(p_invoice integer) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'prepayment' AND document_id IN (SELECT id FROM prepayment_receipts WHERE invoice_id = p_invoice);
  UPDATE prepayment_receipts SET status = 'void' WHERE invoice_id = p_invoice AND status <> 'void';
END
$fn$;

-- ============================================================================
-- Customers and bank accounts
-- ============================================================================
-- Creates or updates a customer (p_id NULL = create). The permanent owner code, used in every document number, is allocated once.
-- p: name, email, address, tax_id, currency, terms_days (already validated by the application).
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
    UPDATE customers SET name = p->>'name', email = p->>'email', address = p->>'address', tax_id = p->>'tax_id', currency = p->>'currency', terms_days = (p->>'terms_days')::integer WHERE id = p_id;
  ELSE
    INSERT INTO customers (name, email, phone, address, tax_id, currency, terms_days)
      VALUES (p->>'name', p->>'email', '', p->>'address', p->>'tax_id', p->>'currency', (p->>'terms_days')::integer) RETURNING id INTO v_id;
  END IF;
  PERFORM vr_public_code('customers', v_id);
  PERFORM vr_audit(p_actor, 'upsert', 'customer', v_id, p->>'name');
  RETURN v_id;
END
$fn$;

-- p: bank_name, account_number, account_holder, currency, branch, swift_code, notes, make_default
CREATE OR REPLACE FUNCTION bank_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_currency text := p->>'currency'; v_primary boolean; v_position integer; v_id integer;
BEGIN
  -- One preferred account per currency: the first account for a currency is preferred automatically.
  PERFORM pg_advisory_xact_lock(hashtext('bank-accounts-' || v_currency));
  v_primary := coalesce((p->>'make_default')::boolean, FALSE)
               OR (SELECT count(*) FROM bank_accounts WHERE currency = v_currency AND is_default AND active) = 0;
  IF v_primary THEN UPDATE bank_accounts SET is_default = FALSE WHERE currency = v_currency AND is_default; END IF;
  SELECT count(*)::integer + 1 INTO v_position FROM bank_accounts;
  INSERT INTO bank_accounts (bank_name, account_number, account_holder, currency, branch, swift_code, notes, active, is_default, position)
    VALUES (p->>'bank_name', p->>'account_number', p->>'account_holder', v_currency, p->>'branch', p->>'swift_code', p->>'notes', TRUE, v_primary, v_position) RETURNING id INTO v_id;
  PERFORM vr_audit(p_actor, 'create', 'bank-account', v_id, (p->>'bank_name') || ' / ' || v_currency);
  RETURN v_id;
END
$fn$;

CREATE OR REPLACE FUNCTION bank_update(p_actor integer, p_id integer, p_action text, p jsonb DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_bank bank_accounts%ROWTYPE; v_takeover boolean;
BEGIN
  SELECT * INTO v_bank FROM bank_accounts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Bank account not found'); END IF;
  IF p_action = 'default' THEN
    IF NOT v_bank.active THEN PERFORM vr_fail(409, 'An inactive account cannot be the preferred account'); END IF;
    UPDATE bank_accounts SET is_default = FALSE WHERE currency = v_bank.currency AND is_default AND id <> p_id;
    UPDATE bank_accounts SET is_default = TRUE, updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'disable' THEN
    UPDATE bank_accounts SET active = FALSE, is_default = FALSE, updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'enable' THEN
    v_takeover := NOT EXISTS (SELECT 1 FROM bank_accounts WHERE currency = v_bank.currency AND is_default AND active AND id <> p_id);
    UPDATE bank_accounts SET active = TRUE, is_default = v_takeover, updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'save' THEN
    IF p IS NULL THEN PERFORM vr_fail(422, 'Invalid bank details'); END IF;
    UPDATE bank_accounts SET bank_name = p->>'bank_name', account_number = p->>'account_number', account_holder = p->>'account_holder',
           branch = p->>'branch', swift_code = p->>'swift_code', notes = p->>'notes', updated_at = now() WHERE id = p_id;
  ELSE
    PERFORM vr_fail(422, 'Invalid action');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'bank-account', p_id, v_bank.bank_name);
END
$fn$;

-- ============================================================================
-- Invoices and their pre-payment receipts
-- ============================================================================
-- p: customer_id, currency, issued_at, due_at, po_number, shipment_reference, service_mode, origin, destination, transport_document_ref, notes,
--    tax_percent, withholding_percent, discount_minor, subtotal_minor, tax_minor, withholding_minor, total_minor, bank_ids[], stamp_required,
--    items[{description, unit, quantity, price_minor, amount_minor}]
CREATE OR REPLACE FUNCTION invoice_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cust customers%ROWTYPE; v_ids integer[]; v_bank bank_accounts%ROWTYPE; v_default integer; v_number text; v_id integer; v_bank_id integer; v_pos integer := 0; v_item jsonb;
BEGIN
  SELECT * INTO v_cust FROM customers WHERE id = (p->>'customer_id')::integer;
  IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
  IF v_cust.currency <> p->>'currency' THEN PERFORM vr_fail(409, 'The customer''s currency changed while the invoice was being prepared: try again'); END IF;
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
  INSERT INTO invoices (number, customer_id, status, currency, issued_at, due_at, po_number, shipment_reference, service_mode, origin, destination,
      transport_document_ref, notes, tax_percent, withholding_percent, discount_minor, subtotal_minor, tax_minor, withholding_minor, total_minor, outstanding_minor)
    VALUES (v_number, v_cust.id, 'draft', v_cust.currency, p->>'issued_at', p->>'due_at', p->>'po_number', p->>'shipment_reference', p->>'service_mode', p->>'origin', p->>'destination',
      p->>'transport_document_ref', p->>'notes', p->>'tax_percent', p->>'withholding_percent', (p->>'discount_minor')::bigint, (p->>'subtotal_minor')::bigint, (p->>'tax_minor')::bigint,
      (p->>'withholding_minor')::bigint, (p->>'total_minor')::bigint, (p->>'total_minor')::bigint) RETURNING id INTO v_id;
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
  -- Every invoice comes with its pre-payment receipt (a draft until the invoice is issued).
  PERFORM vr_create_prepayment(v_id, v_cust.id, v_cust.currency, (p->>'total_minor')::bigint, p->>'issued_at', coalesce((p->>'stamp_required')::boolean, FALSE));
  PERFORM vr_audit(p_actor, 'create', 'invoice', v_id, v_number);
  RETURN v_id;
END
$fn$;

-- issue: draft -> issued. void: only while nothing has been confirmed; open payment claims are cancelled with it.
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
    WITH c AS (UPDATE payments SET status = 'cancelled' WHERE invoice_id = p_id AND status = 'pending_confirmation' RETURNING id) SELECT count(*) INTO v_cancelled FROM c;
    IF v_cancelled > 0 THEN PERFORM vr_audit(p_actor, 'cancel-unconfirmed-payment', 'invoice', p_id, v_cancelled || ' open payment claim(s) cancelled with the void'); END IF;
  ELSE
    PERFORM vr_fail(409, 'Invalid state change. Reverse confirmed payments (void their receipts) before voiding an invoice');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'invoice', p_id, v_inv.number);
END
$fn$;

-- For an invoice that has none: made before pre-payment receipts existed, or whose receipt was voided. Only while nothing has been paid.
CREATE OR REPLACE FUNCTION prepayment_ensure(p_actor integer, p_invoice integer, p_stamp_required boolean) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_inv invoices%ROWTYPE; v_id integer;
BEGIN
  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Invoice not found'); END IF;
  IF v_inv.status NOT IN ('draft', 'issued') THEN PERFORM vr_fail(409, 'A pre-payment receipt can only be made for an invoice that is unpaid and not void'); END IF;
  IF EXISTS (SELECT 1 FROM prepayment_receipts WHERE invoice_id = p_invoice AND status <> 'void') THEN PERFORM vr_fail(409, 'This invoice already has a pre-payment receipt'); END IF;
  v_id := vr_create_prepayment(p_invoice, v_inv.customer_id, v_inv.currency, v_inv.total_minor, v_inv.issued_at, p_stamp_required);
  IF v_id IS NULL THEN PERFORM vr_fail(409, 'The invoice total is zero: there is nothing to receive'); END IF;
  IF v_inv.status = 'issued' THEN PERFORM vr_release_prepayment(p_invoice); END IF;
  PERFORM vr_audit(p_actor, 'create', 'prepayment-receipt', v_id, 'Invoice ' || v_inv.number);
  RETURN v_id;
END
$fn$;

-- The stamped PDF was checked and stored by the application; this records it, but only if the receipt is still waiting for it.
CREATE OR REPLACE FUNCTION prepayment_stamp_commit(p_actor integer, p_id integer, p_key text, p_sha256 text, p_reference text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_row prepayment_receipts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM prepayment_receipts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'pending_stamp' OR NOT v_row.stamp_required THEN PERFORM vr_fail(409, 'This pre-payment receipt is not waiting for a manual e-meterai'); END IF;
  UPDATE prepayment_receipts SET stamp_storage_key = p_key, stamp_sha256 = p_sha256, stamp_uploaded_at = now(), stamp_uploaded_by = p_actor, stamp_provider_reference = p_reference, status = 'issued' WHERE id = p_id;
  PERFORM vr_audit(p_actor, 'stamp-upload', 'prepayment-receipt', p_id, 'Official e-meterai reference: ' || p_reference || '; sha256: ' || p_sha256);
END
$fn$;

CREATE OR REPLACE FUNCTION prepayment_void(p_actor integer, p_id integer) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_row prepayment_receipts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM prepayment_receipts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Pre-payment receipt not found'); END IF;
  IF v_row.status = 'void' THEN PERFORM vr_fail(409, 'The pre-payment receipt is already void'); END IF;
  UPDATE prepayment_receipts SET status = 'void' WHERE id = p_id;
  UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'prepayment' AND document_id = p_id;
  PERFORM vr_audit(p_actor, 'void', 'prepayment-receipt', p_id, v_row.number);
END
$fn$;

-- ============================================================================
-- Payments and official receipts
-- ============================================================================
-- Records a payment CLAIM. Nothing is credited: the invoice balance stays unchanged and no receipt exists until Finance confirms the money
-- reached the bank. Open claims reserve part of the balance, so two people cannot claim the same money twice.
CREATE OR REPLACE FUNCTION payment_record(p_actor integer, p_invoice integer, p_amount bigint, p_date text, p_method text, p_reference text, p_bank integer) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_inv invoices%ROWTYPE; v_outstanding bigint; v_reserved bigint; v_bank bank_accounts%ROWTYPE; v_snapshot jsonb; v_id integer;
BEGIN
  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Invoice not found'); END IF;
  IF v_inv.status NOT IN ('issued', 'partially_paid') THEN PERFORM vr_fail(409, 'The invoice must be issued and have an unpaid balance'); END IF;
  SELECT o_outstanding INTO v_outstanding FROM vr_recompute_outstanding(p_invoice);
  SELECT coalesce(sum(amount_minor), 0)::bigint INTO v_reserved FROM payments WHERE invoice_id = p_invoice AND status = 'pending_confirmation';
  IF p_amount <= 0 OR p_amount > v_outstanding - v_reserved THEN PERFORM vr_fail(422, 'The amount exceeds the unreserved outstanding balance'); END IF;
  IF p_date > vr_today() THEN PERFORM vr_fail(422, 'Payment date cannot be in the future'); END IF;
  IF p_bank IS NOT NULL THEN
    SELECT * INTO v_bank FROM bank_accounts WHERE id = p_bank;
    IF NOT FOUND OR NOT v_bank.active OR v_bank.currency <> v_inv.currency THEN PERFORM vr_fail(422, 'The receiving bank account is inactive or does not match the invoice currency'); END IF;
    v_snapshot := vr_bank_snapshot(v_bank);
  END IF;
  INSERT INTO payments (invoice_id, amount_minor, date, method, reference, status, receiving_bank_id, receiving_bank_snapshot)
    VALUES (p_invoice, p_amount, p_date, p_method, p_reference, 'pending_confirmation', p_bank, v_snapshot::json) RETURNING id INTO v_id;
  PERFORM vr_audit(p_actor, 'payment-pending', 'invoice', p_invoice, format('Payment #%s: %s %s; not cleared', v_id, p_amount, v_inv.currency));
  RETURN v_id;
END
$fn$;

CREATE OR REPLACE FUNCTION payment_cancel(p_actor integer, p_payment integer) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_invoice integer; v_pay payments%ROWTYPE;
BEGIN
  SELECT invoice_id INTO v_invoice FROM payments WHERE id = p_payment;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Payment not found'); END IF;
  PERFORM 1 FROM invoices WHERE id = v_invoice FOR UPDATE;
  SELECT * INTO v_pay FROM payments WHERE id = p_payment FOR UPDATE;
  IF v_pay.status <> 'pending_confirmation' THEN PERFORM vr_fail(409, 'Only unconfirmed payments can be cancelled here'); END IF;
  UPDATE payments SET status = 'cancelled' WHERE id = p_payment;
  PERFORM vr_audit(p_actor, 'cancel-unconfirmed-payment', 'payment', p_payment, 'No funds confirmed');
  RETURN v_invoice;
END
$fn$;

-- Finance confirms that the funds are credited. In ONE transaction, under row locks (invoice first, then payment, the same order everywhere):
-- the payment becomes recorded, the invoice balance and status are recomputed, the receipt and its verification link are created.
-- Concurrent confirmations of the same payment: exactly one succeeds. Returns what the application needs to queue the customer emails.
CREATE OR REPLACE FUNCTION payment_confirm(p_actor integer, p_payment integer, p_bank integer, p_stamp_required boolean) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_invoice integer; v_inv invoices%ROWTYPE; v_pay payments%ROWTYPE; v_confirmed bigint; v_bank bank_accounts%ROWTYPE; v_snapshot json;
  v_outstanding bigint; v_status text; v_after bigint; v_cust customers%ROWTYPE; v_number text; v_receipt integer; v_token text;
BEGIN
  SELECT invoice_id INTO v_invoice FROM payments WHERE id = p_payment;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Payment not found'); END IF;
  SELECT * INTO v_inv FROM invoices WHERE id = v_invoice FOR UPDATE;
  SELECT * INTO v_pay FROM payments WHERE id = p_payment FOR UPDATE;
  IF v_pay.status <> 'pending_confirmation' THEN PERFORM vr_fail(409, 'The payment was already confirmed, cancelled or voided'); END IF;
  IF v_inv.status IN ('draft', 'void') THEN PERFORM vr_fail(409, 'The invoice is not eligible for payment confirmation'); END IF;
  SELECT coalesce(sum(amount_minor), 0)::bigint INTO v_confirmed FROM payments WHERE invoice_id = v_inv.id AND status = 'recorded';
  IF v_pay.amount_minor > v_inv.total_minor - v_confirmed THEN PERFORM vr_fail(409, 'The payment exceeds the invoice balance'); END IF;

  v_snapshot := v_pay.receiving_bank_snapshot;
  IF p_bank IS NOT NULL THEN
    SELECT * INTO v_bank FROM bank_accounts WHERE id = p_bank;
    IF NOT FOUND OR NOT v_bank.active OR v_bank.currency <> v_inv.currency THEN PERFORM vr_fail(422, 'The receiving bank account is inactive or does not match the invoice currency'); END IF;
    v_snapshot := vr_bank_snapshot(v_bank)::json;
    UPDATE payments SET receiving_bank_id = v_bank.id, receiving_bank_snapshot = v_snapshot WHERE id = p_payment;
  END IF;
  IF v_snapshot IS NULL AND lower(btrim(v_pay.method)) ~ '^(bank )?transfer$' THEN PERFORM vr_fail(422, 'Select the VORA bank account that received the transfer'); END IF;

  UPDATE payments SET status = 'recorded', confirmed_at = now(), confirmed_by = p_actor WHERE id = p_payment;
  SELECT r.o_outstanding, r.o_status INTO v_outstanding, v_status FROM vr_recompute_outstanding(v_inv.id) r;
  SELECT outstanding_minor INTO v_after FROM invoices WHERE id = v_inv.id;
  SELECT * INTO v_cust FROM customers WHERE id = v_inv.customer_id;
  v_number := vr_next_number('RCP', vr_public_code('customers', v_cust.id), coalesce(nullif(v_pay.date, ''), vr_today()));
  INSERT INTO receipts (number, invoice_id, payment_id, status, stamp_required) VALUES (v_number, v_inv.id, p_payment, CASE WHEN p_stamp_required THEN 'pending_stamp' ELSE 'issued' END, p_stamp_required) RETURNING id INTO v_receipt;
  v_token := vr_create_verification('receipt', v_receipt);
  PERFORM vr_audit(p_actor, 'confirm-cleared-payment', 'payment', p_payment, format('Invoice %s; receipt %s; %s; bank credit confirmed', v_inv.number, v_number, v_status));
  RETURN jsonb_build_object('receipt_id', v_receipt, 'receipt_number', v_number, 'token', v_token, 'invoice_id', v_inv.id, 'invoice_number', v_inv.number, 'currency', v_inv.currency,
    'invoice_status', v_status, 'outstanding_minor', v_after, 'stamp_required', p_stamp_required,
    'payment', jsonb_build_object('amount_minor', v_pay.amount_minor, 'date', v_pay.date, 'reference', v_pay.reference),
    'customer', jsonb_build_object('id', v_cust.id, 'name', v_cust.name, 'email', v_cust.email));
END
$fn$;

-- The stamped PDF was checked and stored by the application; this records it, but only if the receipt is still waiting for it.
CREATE OR REPLACE FUNCTION receipt_stamp_commit(p_actor integer, p_id integer, p_key text, p_sha256 text, p_reference text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_receipt receipts%ROWTYPE; v_inv invoices%ROWTYPE; v_cust customers%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_receipt FROM receipts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.status <> 'pending_stamp' OR NOT v_receipt.stamp_required THEN PERFORM vr_fail(409, 'This receipt is not waiting for a manual e-meterai'); END IF;
  SELECT * INTO v_inv FROM invoices WHERE id = v_receipt.invoice_id;
  SELECT * INTO v_cust FROM customers WHERE id = v_inv.customer_id;
  UPDATE receipts SET stamp_storage_key = p_key, stamp_sha256 = p_sha256, stamp_uploaded_at = now(), stamp_uploaded_by = p_actor, stamp_provider_reference = p_reference, status = 'issued' WHERE id = p_id;
  SELECT token INTO v_token FROM document_verification_tokens WHERE kind = 'receipt' AND document_id = p_id ORDER BY id LIMIT 1;
  PERFORM vr_audit(p_actor, 'stamp-upload', 'receipt', p_id, 'Official e-meterai reference: ' || p_reference || '; sha256: ' || p_sha256);
  RETURN jsonb_build_object('receipt_number', v_receipt.number, 'token', coalesce(v_token, ''), 'invoice_number', v_inv.number, 'customer', jsonb_build_object('name', v_cust.name, 'email', v_cust.email));
END
$fn$;

-- Voids a receipt AND reverses its payment: the invoice balance and status are recalculated and the QR link is revoked.
CREATE OR REPLACE FUNCTION receipt_void(p_actor integer, p_id integer) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_ref receipts%ROWTYPE; v_receipt receipts%ROWTYPE; v_pay payments%ROWTYPE;
BEGIN
  SELECT * INTO v_ref FROM receipts WHERE id = p_id;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Receipt not found'); END IF;
  PERFORM 1 FROM invoices WHERE id = v_ref.invoice_id FOR UPDATE;
  SELECT * INTO v_receipt FROM receipts WHERE id = p_id FOR UPDATE;
  IF v_receipt.status = 'void' THEN PERFORM vr_fail(409, 'The receipt is already void'); END IF;
  SELECT * INTO v_pay FROM payments WHERE id = v_ref.payment_id FOR UPDATE;
  IF NOT FOUND OR v_pay.status <> 'recorded' THEN PERFORM vr_fail(409, 'The payment is not in a recorded state'); END IF;
  UPDATE receipts SET status = 'void' WHERE id = p_id;
  UPDATE payments SET status = 'void' WHERE id = v_pay.id;
  UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'receipt' AND document_id = p_id;
  PERFORM vr_recompute_outstanding(v_ref.invoice_id);
  PERFORM vr_audit(p_actor, 'void-payment-and-receipt', 'receipt', p_id, v_receipt.number);
END
$fn$;

-- ============================================================================
-- Quotations and the customer's approval upload
-- ============================================================================
-- p: owner_kind ('customer' | 'lead'), owner_id, currency, issued_at, valid_until, payment_terms, terms_conditions, notes, tax_percent,
--    subtotal_minor, tax_minor, total_minor, items[{description, unit, quantity, price_minor, amount_minor}]
CREATE OR REPLACE FUNCTION quotation_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_kind text := p->>'owner_kind'; v_owner integer := (p->>'owner_id')::integer; v_currency text; v_number text; v_id integer; v_item jsonb;
BEGIN
  IF v_kind = 'customer' THEN
    SELECT currency INTO v_currency FROM customers WHERE id = v_owner;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'Recipient unavailable'); END IF;
  ELSIF v_kind = 'lead' THEN
    PERFORM 1 FROM leads WHERE id = v_owner;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'Recipient unavailable'); END IF;
    v_currency := 'IDR';
  ELSE
    PERFORM vr_fail(422, 'Select a customer or lead');
  END IF;
  IF v_currency <> p->>'currency' THEN PERFORM vr_fail(409, 'The recipient''s currency changed while the quotation was being prepared: try again'); END IF;
  v_number := vr_next_number('QUO', vr_public_code(CASE WHEN v_kind = 'customer' THEN 'customers' ELSE 'leads' END, v_owner), p->>'issued_at');
  INSERT INTO quotations (number, customer_id, lead_id, status, currency, issued_at, valid_until, payment_terms, terms_conditions, notes, tax_percent, subtotal_minor, tax_minor, total_minor)
    VALUES (v_number, CASE WHEN v_kind = 'customer' THEN v_owner END, CASE WHEN v_kind = 'lead' THEN v_owner END, 'draft', v_currency, p->>'issued_at', p->>'valid_until',
            p->>'payment_terms', p->>'terms_conditions', p->>'notes', p->>'tax_percent', (p->>'subtotal_minor')::bigint, (p->>'tax_minor')::bigint, (p->>'total_minor')::bigint) RETURNING id INTO v_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO quotation_items (quotation_id, description, unit, quantity, price_minor, amount_minor)
      VALUES (v_id, v_item->>'description', v_item->>'unit', v_item->>'quantity', (v_item->>'price_minor')::bigint, (v_item->>'amount_minor')::bigint);
  END LOOP;
  PERFORM vr_create_verification('quotation', v_id);
  PERFORM vr_audit(p_actor, 'create', 'quotation', v_id, v_number);
  RETURN v_id;
END
$fn$;

-- issue: draft -> issued. void: draft/issued/awaiting/approved -> void, revoking the QR link and any open approval link.
CREATE OR REPLACE FUNCTION quotation_set_status(p_actor integer, p_id integer, p_action text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_q quotations%ROWTYPE;
BEGIN
  SELECT * INTO v_q FROM quotations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Quotation not found'); END IF;
  IF p_action = 'issue' AND v_q.status = 'draft' THEN
    UPDATE quotations SET status = 'issued' WHERE id = p_id;
  ELSIF p_action = 'void' AND v_q.status IN ('draft', 'issued', 'awaiting_approval', 'approved') THEN
    UPDATE quotations SET status = 'void' WHERE id = p_id;
    UPDATE quotation_approvals SET status = 'revoked' WHERE quotation_id = p_id AND status = 'pending';
    UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'quotation' AND document_id = p_id;
  ELSE
    PERFORM vr_fail(409, 'Quotation cannot make that status transition');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'quotation', p_id, v_q.number);
END
$fn$;

-- The link of an approval request is derived from the request's own number (see approval-token.ts), so the number is taken first.
CREATE OR REPLACE FUNCTION quotation_approval_next_id() RETURNS integer
LANGUAGE sql SET search_path = public, pg_temp AS $fn$
  SELECT nextval(pg_get_serial_sequence('quotation_approvals', 'id'))::integer
$fn$;

-- Opens a private, expiring upload link for the customer. Earlier pending links are revoked. The application sends the email afterwards.
CREATE OR REPLACE FUNCTION quotation_request_approval(p_actor integer, p_id integer, p_approval integer, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_q quotations%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_q FROM quotations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Quotation not found'); END IF;
  IF v_q.status NOT IN ('issued', 'awaiting_approval') THEN PERFORM vr_fail(409, 'Issue the quotation before requesting customer approval'); END IF;
  IF v_q.valid_until < vr_today() THEN PERFORM vr_fail(409, 'Quotation validity has expired'); END IF;
  UPDATE quotation_approvals SET status = 'revoked' WHERE quotation_id = p_id AND status = 'pending';
  INSERT INTO quotation_approvals (id, quotation_id, token_hash, expires_at, status) VALUES (p_approval, p_id, p_token_hash, p_expires_at, 'pending');
  UPDATE quotations SET status = 'awaiting_approval' WHERE id = p_id;
  SELECT token INTO v_token FROM document_verification_tokens WHERE kind = 'quotation' AND document_id = p_id ORDER BY id LIMIT 1;
  PERFORM vr_audit(p_actor, 'send-approval-request', 'quotation', p_id, format('Customer approval link #%s expires %s', p_approval, to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  RETURN jsonb_build_object('number', v_q.number, 'valid_until', v_q.valid_until, 'verification_token', coalesce(v_token, ''));
END
$fn$;

-- The customer's upload (already checked and stored by the application). It never approves anything by itself: it waits for Finance's review.
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
  PERFORM vr_audit(NULL, 'customer-approval-upload', 'quotation', v_item.quotation_id, format('Customer submission #%s, SHA256 %s', v_item.id, p_sha256));
  RETURN jsonb_build_object('approval_id', v_item.id, 'quotation_id', v_item.quotation_id, 'number', v_q.number);
END
$fn$;

-- Finance's decision on a submitted file. Approval requires a manual look at the signature and company stamp.
CREATE OR REPLACE FUNCTION approval_review(p_actor integer, p_id integer, p_outcome text, p_verified boolean, p_note text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_item quotation_approvals%ROWTYPE; v_q quotations%ROWTYPE;
BEGIN
  IF p_outcome NOT IN ('approve', 'reject') THEN PERFORM vr_fail(422, 'Invalid review outcome'); END IF;
  SELECT * INTO v_item FROM quotation_approvals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_item.status <> 'submitted' THEN PERFORM vr_fail(409, 'Only submitted approvals can be reviewed'); END IF;
  SELECT * INTO v_q FROM quotations WHERE id = v_item.quotation_id FOR UPDATE;
  IF NOT FOUND OR v_q.status <> 'awaiting_approval' THEN PERFORM vr_fail(409, 'The quotation is no longer awaiting approval'); END IF;
  IF p_outcome = 'approve' AND NOT coalesce(p_verified, FALSE) THEN PERFORM vr_fail(422, 'Confirm that the signature and company stamp were reviewed manually'); END IF;
  UPDATE quotation_approvals SET status = CASE WHEN p_outcome = 'approve' THEN 'approved' ELSE 'rejected' END, reviewed_by = p_actor, reviewed_at = now(), review_note = left(p_note, 2000) WHERE id = p_id;
  UPDATE quotations SET status = CASE WHEN p_outcome = 'approve' THEN 'approved' ELSE 'issued' END WHERE id = v_q.id;
  PERFORM vr_audit(p_actor, 'customer-quotation-' || p_outcome, 'quotation', v_q.id, format('Approval #%s; PDF checksum %s', p_id, v_item.signed_pdf_sha256));
  RETURN jsonb_build_object('quotation_id', v_q.id, 'number', v_q.number);
END
$fn$;

-- ============================================================================
-- Email queue
-- ============================================================================
-- Claims due messages atomically (FOR UPDATE SKIP LOCKED + a lease), so two cron workers or an admin click can never send the same message
-- twice, and a crashed worker's jobs are picked up again once the lease runs out.
CREATE OR REPLACE FUNCTION mail_claim(p_limit integer, p_lease_minutes integer) RETURNS SETOF email_jobs
LANGUAGE sql SET search_path = public, pg_temp AS $fn$
  UPDATE email_jobs SET status = 'sending', next_attempt_at = now() + make_interval(mins => p_lease_minutes)
  WHERE id IN (SELECT id FROM email_jobs WHERE status IN ('queued', 'retry', 'sending') AND next_attempt_at <= now() ORDER BY id LIMIT least(greatest(p_limit, 1), 30) FOR UPDATE SKIP LOCKED)
  RETURNING *
$fn$;

-- Puts a failed or waiting message back in the queue (admin "Retry").
CREATE OR REPLACE FUNCTION mail_retry(p_actor integer, p_id integer) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_job email_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM email_jobs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Message not found'); END IF;
  IF v_job.status NOT IN ('failed', 'retry') THEN PERFORM vr_fail(409, 'Only failed or waiting messages can be retried'); END IF;
  UPDATE email_jobs SET status = 'queued', attempts = 0, error = '', next_attempt_at = now() WHERE id = p_id;
  PERFORM vr_audit(p_actor, 'retry', 'email-job', p_id, v_job.event);
END
$fn$;

-- ============================================================================
-- Website enquiries
-- ============================================================================
-- Stores a contact message or RFQ from the public website, with its reference number, in one transaction. The per-address throttle is counted under
-- an advisory lock, so a burst of simultaneous submissions cannot slip past it.
-- p: kind ('rfq' | 'contact'), name, email, message, company, mode, origin, destination, cargo, pickup, window_minutes, max_per_email
CREATE OR REPLACE FUNCTION lead_create(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_rfq boolean := p->>'kind' = 'rfq'; v_id integer; v_ref text; v_recent integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lead-' || lower(p->>'email')));
  SELECT count(*) INTO v_recent FROM leads WHERE email = p->>'email' AND created_at >= now() - make_interval(mins => (p->>'window_minutes')::integer);
  IF v_recent >= (p->>'max_per_email')::integer THEN PERFORM vr_fail(429, 'Too many submissions; try again later'); END IF;
  INSERT INTO leads (type, name, email, message, company, mode, origin, destination, cargo, pickup, source)
    VALUES (CASE WHEN v_rfq THEN 'RFQ' ELSE 'contact' END, p->>'name', p->>'email', p->>'message', p->>'company',
            CASE WHEN v_rfq THEN p->>'mode' ELSE '' END, CASE WHEN v_rfq THEN p->>'origin' ELSE '' END, CASE WHEN v_rfq THEN p->>'destination' ELSE '' END,
            CASE WHEN v_rfq THEN p->>'cargo' ELSE '' END, CASE WHEN v_rfq THEN p->>'pickup' ELSE '' END, 'website') RETURNING id INTO v_id;
  v_ref := vr_next_number(CASE WHEN v_rfq THEN 'RFQ' ELSE 'INQ' END, vr_public_code('leads', v_id));
  UPDATE leads SET reference = v_ref WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'reference', v_ref);
END
$fn$;

-- ============================================================================
-- Website content (articles, pages, sections)
-- ============================================================================
-- The application cleans and validates the text (HTML sanitising, slugs, allowed layouts); these functions keep the revision history, the
-- publishing snapshot and the audit row consistent with the change, in one transaction.
CREATE OR REPLACE FUNCTION vr_article_snapshot(a articles) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT jsonb_build_object('title', a.title, 'slug', a.slug, 'excerpt', a.excerpt, 'body', a.body, 'category', a.category, 'tags', a.tags, 'locale', a.locale,
    'status', a.status, 'cover', a.cover, 'author', a.author, 'seoTitle', a.seo_title, 'seoDescription', a.seo_description)
$fn$;

-- Saves (p_id NULL = create) an article; every edit first stores the previous state as a revision.
-- p: title, slug, excerpt, body, category, tags, locale, author, seo_title, seo_description.  p_action: 'publish' | 'unpublish' | anything else = plain save
CREATE OR REPLACE FUNCTION article_save(p_actor integer, p_id integer, p jsonb, p_action text) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_old articles%ROWTYPE; v_id integer := p_id; v_status text;
BEGIN
  v_status := CASE p_action WHEN 'publish' THEN 'published' WHEN 'unpublish' THEN 'draft' END;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_old FROM articles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM vr_fail(404, 'Article not found'); END IF;
    INSERT INTO revisions (resource, resource_id, snapshot, author_id) VALUES ('article', p_id, vr_article_snapshot(v_old)::json, p_actor);
    UPDATE articles SET title = p->>'title', slug = p->>'slug', excerpt = p->>'excerpt', body = p->>'body', category = p->>'category', tags = p->>'tags', locale = p->>'locale',
           author = p->>'author', seo_title = p->>'seo_title', seo_description = p->>'seo_description', updated_at = now() WHERE id = p_id;
    IF v_status = 'published' THEN UPDATE articles SET status = 'published', published_at = now() WHERE id = p_id;
    ELSIF v_status = 'draft' THEN UPDATE articles SET status = 'draft' WHERE id = p_id; END IF;
  ELSE
    INSERT INTO articles (title, slug, excerpt, body, category, tags, locale, author, seo_title, seo_description, status, published_at)
      VALUES (p->>'title', p->>'slug', p->>'excerpt', p->>'body', p->>'category', p->>'tags', p->>'locale', p->>'author', p->>'seo_title', p->>'seo_description',
              coalesce(v_status, 'draft'), CASE WHEN v_status = 'published' THEN now() END) RETURNING id INTO v_id;
  END IF;
  PERFORM vr_audit(p_actor, CASE WHEN p_action = 'publish' THEN 'publish' ELSE 'update' END, 'article', v_id, p->>'title');
  RETURN v_id;
END
$fn$;

-- p_body is the revision's body after the application sanitised it again.
CREATE OR REPLACE FUNCTION article_restore(p_actor integer, p_id integer, p_revision integer, p_body text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_a articles%ROWTYPE; v_r revisions%ROWTYPE; v_snap jsonb;
BEGIN
  SELECT * INTO v_a FROM articles WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Not found'); END IF;
  SELECT * INTO v_r FROM revisions WHERE id = p_revision AND resource = 'article' AND resource_id = p_id;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Not found'); END IF;
  INSERT INTO revisions (resource, resource_id, snapshot, author_id) VALUES ('article', p_id, vr_article_snapshot(v_a)::json, p_actor);
  v_snap := v_r.snapshot::jsonb;
  UPDATE articles SET title = v_snap->>'title', slug = v_snap->>'slug', excerpt = v_snap->>'excerpt', body = p_body, category = v_snap->>'category', tags = v_snap->>'tags',
         locale = v_snap->>'locale', status = v_snap->>'status', cover = coalesce(v_snap->>'cover', ''), author = v_snap->>'author',
         seo_title = coalesce(v_snap->>'seoTitle', ''), seo_description = coalesce(v_snap->>'seoDescription', ''), updated_at = now() WHERE id = p_id;
  PERFORM vr_audit(p_actor, 'restore', 'article', p_id, p_revision::text);
END
$fn$;

-- A frozen copy of a page and its sections: visitors only ever see published snapshots. Keys stay snake_case (a stable format).
CREATE OR REPLACE FUNCTION vr_page_snapshot(p pages) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT jsonb_build_object('title', p.title, 'slug', p.slug, 'description', p.description, 'seo_title', p.seo_title, 'seo_description', p.seo_description, 'locale', p.locale,
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('position', s.position, 'kind', s.kind, 'layout', s.layout, 'visible', s.visible, 'title', s.title, 'body', s.body,
      'image', s.image, 'button_label', s.button_label, 'button_href', s.button_href, 'surface', s.surface) ORDER BY s.position, s.id) FROM sections s WHERE s.page_id = p.id), '[]'::jsonb))
$fn$;

-- p: title, slug, locale, description, seo_title.  p_action: 'publish' | 'unpublish' | other = save as draft
CREATE OR REPLACE FUNCTION page_save(p_actor integer, p_id integer, p jsonb, p_action text) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_id integer := p_id; v_page pages%ROWTYPE;
BEGIN
  IF p_id IS NOT NULL THEN
    PERFORM 1 FROM pages WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM vr_fail(404, 'Page not found'); END IF;
    UPDATE pages SET title = p->>'title', slug = p->>'slug', locale = p->>'locale', description = p->>'description', seo_title = p->>'seo_title', seo_description = p->>'description', updated_at = now() WHERE id = p_id;
  ELSE
    INSERT INTO pages (title, slug, locale, description, seo_title, seo_description) VALUES (p->>'title', p->>'slug', p->>'locale', p->>'description', p->>'seo_title', p->>'description') RETURNING id INTO v_id;
  END IF;
  SELECT * INTO v_page FROM pages WHERE id = v_id;
  IF p_action = 'publish' THEN
    INSERT INTO revisions (resource, resource_id, snapshot, author_id) VALUES ('page', v_id, coalesce(v_page.published_snapshot, '{}'::json), p_actor);
    UPDATE pages SET published_snapshot = vr_page_snapshot(v_page)::json, status = 'published' WHERE id = v_id;
  ELSIF p_action = 'unpublish' THEN
    UPDATE pages SET status = 'draft' WHERE id = v_id;
  END IF;
  PERFORM vr_audit(p_actor, coalesce(nullif(p_action, ''), 'draft'), 'page', v_id, p->>'slug');
  RETURN v_id;
END
$fn$;

CREATE OR REPLACE FUNCTION page_restore(p_actor integer, p_id integer, p_revision integer) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_r revisions%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM revisions WHERE id = p_revision AND resource = 'page' AND resource_id = p_id;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Not found'); END IF;
  IF v_r.snapshot IS NULL OR (v_r.snapshot::jsonb) -> 'sections' IS NULL THEN PERFORM vr_fail(409, 'Previous revision is empty'); END IF;
  UPDATE pages SET published_snapshot = v_r.snapshot, status = 'published' WHERE id = p_id;
  PERFORM vr_audit(p_actor, 'restore', 'page', p_id, p_revision::text);
END
$fn$;

CREATE OR REPLACE FUNCTION section_add(p_page integer) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  PERFORM 1 FROM pages WHERE id = p_page FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Page not found'); END IF;
  INSERT INTO sections (page_id, position, kind, layout, visible, title, body)
    VALUES (p_page, (SELECT coalesce(max(position), 0) + 1 FROM sections WHERE page_id = p_page), 'editorial', 'split', TRUE, 'New editorial block', 'Edit this text before publishing');
END
$fn$;

-- Updates, reorders (p_move 'up' | 'down') or deletes (p_remove) a draft section. Returns the owning page id.
-- p: title, body, kind, layout, surface, visible, button_label, button_href, image  (already validated by the application)
CREATE OR REPLACE FUNCTION section_save(p_actor integer, p_id integer, p jsonb, p_move text, p_remove boolean) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_s sections%ROWTYPE; v_ids integer[]; v_i integer; v_j integer; v_tmp integer; n integer;
BEGIN
  SELECT * INTO v_s FROM sections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Section not found'); END IF;
  IF p_remove THEN
    DELETE FROM sections WHERE id = p_id;
  ELSIF p_move IN ('up', 'down') THEN
    SELECT array_agg(id ORDER BY position, id) INTO v_ids FROM sections WHERE page_id = v_s.page_id;
    v_i := array_position(v_ids, p_id);
    v_j := v_i + CASE WHEN p_move = 'up' THEN -1 ELSE 1 END;
    IF v_j >= 1 AND v_j <= cardinality(v_ids) THEN
      v_tmp := v_ids[v_i]; v_ids[v_i] := v_ids[v_j]; v_ids[v_j] := v_tmp;
      FOR n IN 1..cardinality(v_ids) LOOP UPDATE sections SET position = n - 1 WHERE id = v_ids[n]; END LOOP;
    END IF;
  ELSE
    UPDATE sections SET title = p->>'title', body = p->>'body', kind = p->>'kind', layout = p->>'layout', surface = p->>'surface', visible = (p->>'visible')::boolean,
           button_label = p->>'button_label', button_href = p->>'button_href', image = p->>'image' WHERE id = p_id;
  END IF;
  PERFORM vr_audit(p_actor, 'update', 'section', p_id, 'section draft');
  RETURN v_s.page_id;
END
$fn$;

-- ============================================================================
-- General documents (letters, statements, certificates...)
-- ============================================================================
-- The application validates what was typed against the document type and hands over the finished values.
-- p: prefix (number prefix of the type), kind, language, customer_id (or null), subject, recipient, document_date, fields (json)
CREATE OR REPLACE FUNCTION document_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_customer integer := nullif(p->>'customer_id', '')::integer; v_owner text; v_number text; v_id integer;
BEGIN
  IF v_customer IS NOT NULL THEN
    PERFORM 1 FROM customers WHERE id = v_customer;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
    v_owner := vr_public_code('customers', v_customer);
  ELSE
    v_owner := vr_company_code();
  END IF;
  v_number := vr_next_number(p->>'prefix', v_owner, p->>'document_date');
  INSERT INTO documents (number, kind, language, status, customer_id, subject, recipient, document_date, fields, created_by)
    VALUES (v_number, p->>'kind', p->>'language', 'draft', v_customer, p->>'subject', p->>'recipient', p->>'document_date', (p->'fields')::json, p_actor) RETURNING id INTO v_id;
  PERFORM vr_create_verification('document', v_id);
  PERFORM vr_audit(p_actor, 'create', 'document', v_id, v_number);
  RETURN v_id;
END
$fn$;

-- Only a draft can be edited. p: customer_id, subject, recipient, document_date, fields
CREATE OR REPLACE FUNCTION document_update(p_actor integer, p_id integer, p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_doc documents%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Document not found'); END IF;
  IF v_doc.status <> 'draft' THEN PERFORM vr_fail(409, 'Only a draft can be edited: void this document and write a new one'); END IF;
  UPDATE documents SET customer_id = nullif(p->>'customer_id', '')::integer, subject = p->>'subject', recipient = p->>'recipient', document_date = p->>'document_date',
         fields = (p->'fields')::json, updated_at = now() WHERE id = p_id;
  PERFORM vr_audit(p_actor, 'update', 'document', p_id, v_doc.number);
END
$fn$;

-- issue: draft -> issued, with the values the application re-checked against the type and the invoices as they stand now (p). It is refused if
-- the draft was edited meanwhile (p_expected is the updated_at the application read, to the millisecond). void: any draft or issued document.
CREATE OR REPLACE FUNCTION document_set_status(p_actor integer, p_id integer, p_action text, p jsonb DEFAULT NULL, p_expected timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_doc documents%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Document not found'); END IF;
  IF p_action = 'issue' AND v_doc.status = 'draft' THEN
    IF p IS NULL OR date_trunc('milliseconds', v_doc.updated_at) <> date_trunc('milliseconds', p_expected) THEN PERFORM vr_fail(409, 'The draft was changed while it was being issued: open it again'); END IF;
    UPDATE documents SET status = 'issued', issued_at = now(), issued_by = p_actor, subject = p->>'subject', recipient = p->>'recipient', fields = (p->'fields')::json, updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'void' AND v_doc.status <> 'void' THEN
    UPDATE documents SET status = 'void', updated_at = now() WHERE id = p_id;
    UPDATE document_verification_tokens SET revoked = TRUE WHERE kind = 'document' AND document_id = p_id;
  ELSE
    PERFORM vr_fail(409, 'Invalid state change');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'document', p_id, v_doc.number);
END
$fn$;

-- ============================================================================
-- Who may call what
-- ============================================================================
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'vr\_%' OR p.proname IN (
      'customer_save', 'bank_create', 'bank_update', 'invoice_create', 'invoice_set_status', 'prepayment_ensure', 'prepayment_stamp_commit', 'prepayment_void',
      'payment_record', 'payment_cancel', 'payment_confirm', 'receipt_stamp_commit', 'receipt_void', 'quotation_create', 'quotation_set_status',
      'quotation_approval_next_id', 'quotation_request_approval', 'approval_submit', 'approval_review', 'mail_claim', 'mail_retry', 'lead_create', 'article_save', 'article_restore', 'page_save', 'page_restore', 'section_add', 'section_save', 'document_create', 'document_update', 'document_set_status'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
  -- A function added by a later migration starts closed, too: it must be opened to service_role on purpose.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated; END IF;
END $$;
