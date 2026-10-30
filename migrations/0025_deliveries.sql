-- Delivery notes (surat jalan) with a proof of delivery (POD).
-- A delivery note travels with the goods and carries a QR code. The DRIVER or COURIER who delivers the goods scans it, on their own phone, at
-- the handover: they say who they are, the receiver gives their name and signs on the screen, the driver photographs the goods, and the
-- phone's position (only if the driver allows it) and the time are recorded: that is the POD.
-- The QR code and the emailed "view the POD" link are two different, unguessable tokens (a printed QR must keep working, so they are
-- stored, not derived from a secret that may be rotated). Evidence files (signature, photos) live in the private documents bucket.
-- Delivery status: draft -> issued -> delivered (a POD was submitted) -> back to issued when Finance rejects the POD; void from draft or issued.
-- RLS is enabled with no policies, so the Supabase Data API cannot read any of it; the server reaches it with the secret key, through the
-- functions at the end of this file (SECURITY INVOKER, EXECUTE only for service_role).
CREATE TABLE IF NOT EXISTS deliveries (
  id                 SERIAL PRIMARY KEY,
  number             VARCHAR(70)  NOT NULL UNIQUE,
  status             VARCHAR(12)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'delivered', 'void')),
  customer_id        INTEGER REFERENCES customers (id),
  consignee_name     VARCHAR(240) NOT NULL,
  consignee_address  TEXT         NOT NULL DEFAULT '',
  consignee_contact  VARCHAR(160) NOT NULL DEFAULT '',
  consignee_phone    VARCHAR(60)  NOT NULL DEFAULT '',
  consignee_email    VARCHAR(200) NOT NULL DEFAULT '',
  origin             VARCHAR(240) NOT NULL DEFAULT '',
  destination        VARCHAR(240) NOT NULL DEFAULT '',
  shipment_reference VARCHAR(120) NOT NULL DEFAULT '',
  po_number          VARCHAR(100) NOT NULL DEFAULT '',
  carrier            VARCHAR(160) NOT NULL DEFAULT '',
  vehicle            VARCHAR(120) NOT NULL DEFAULT '',
  vehicle_plate      VARCHAR(30)  NOT NULL DEFAULT '',
  driver_name        VARCHAR(160) NOT NULL DEFAULT '',
  driver_phone       VARCHAR(60)  NOT NULL DEFAULT '',
  delivery_date      VARCHAR(10)  NOT NULL,
  notes              TEXT         NOT NULL DEFAULT '',
  capture_token      VARCHAR(120) NOT NULL UNIQUE,
  view_token         VARCHAR(120) NOT NULL UNIQUE,
  created_by         INTEGER REFERENCES users (id),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  issued_at          TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_deliveries_status ON deliveries (status);
CREATE INDEX IF NOT EXISTS ix_deliveries_customer ON deliveries (customer_id);

CREATE TABLE IF NOT EXISTS delivery_items (
  id          SERIAL PRIMARY KEY,
  delivery_id INTEGER      NOT NULL REFERENCES deliveries (id),
  position    INTEGER      NOT NULL DEFAULT 0,
  description VARCHAR(500) NOT NULL,
  quantity    VARCHAR(40)  NOT NULL,
  unit        VARCHAR(30)  NOT NULL DEFAULT 'pcs',
  remarks     VARCHAR(240) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_delivery_items_delivery ON delivery_items (delivery_id, position);

-- One live (submitted) proof per delivery; a rejected one stays as history and the delivery can be received again.
-- The location is optional: it is taken only when the receiver allows the phone to share it.
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id                 SERIAL PRIMARY KEY,
  delivery_id        INTEGER      NOT NULL REFERENCES deliveries (id),
  status             VARCHAR(12)  NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'rejected')),
  receiver_name      VARCHAR(160) NOT NULL,
  receiver_position  VARCHAR(160) NOT NULL,
  receiver_phone     VARCHAR(60)  NOT NULL,
  receiver_email     VARCHAR(200) NOT NULL DEFAULT '',
  receiver_id_number VARCHAR(40)  NOT NULL DEFAULT '',
  courier_name       VARCHAR(160) NOT NULL DEFAULT '',
  courier_phone      VARCHAR(60)  NOT NULL DEFAULT '',
  received_condition VARCHAR(10)  NOT NULL DEFAULT 'good' CHECK (received_condition IN ('good', 'damaged', 'partial')),
  condition_note     VARCHAR(1000) NOT NULL DEFAULT '',
  signature_key      VARCHAR(500) NOT NULL,
  signature_sha256   VARCHAR(64)  NOT NULL,
  latitude           DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude          DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m         DOUBLE PRECISION CHECK (accuracy_m >= 0),
  location_status    VARCHAR(12)  NOT NULL CHECK (location_status IN ('captured', 'unavailable')),
  location_note      VARCHAR(240) NOT NULL DEFAULT '',
  device_time        VARCHAR(40)  NOT NULL DEFAULT '',
  server_time        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ip                 VARCHAR(64)  NOT NULL DEFAULT '',
  user_agent         VARCHAR(300) NOT NULL DEFAULT '',
  rejected_at        TIMESTAMPTZ,
  rejected_by        INTEGER REFERENCES users (id),
  reject_reason      VARCHAR(500) NOT NULL DEFAULT '',
  CHECK (location_status <> 'captured' OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);
-- Who delivered (a database that already had the table without them gets them here).
ALTER TABLE delivery_proofs ADD COLUMN IF NOT EXISTS courier_name VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE delivery_proofs ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(60) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_proofs_live ON delivery_proofs (delivery_id) WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS ix_delivery_proofs_delivery ON delivery_proofs (delivery_id, id);

CREATE TABLE IF NOT EXISTS delivery_proof_photos (
  id          SERIAL PRIMARY KEY,
  proof_id    INTEGER      NOT NULL REFERENCES delivery_proofs (id),
  position    INTEGER      NOT NULL DEFAULT 0,
  storage_key VARCHAR(500) NOT NULL,
  sha256      VARCHAR(64)  NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_delivery_proof_photos_proof ON delivery_proof_photos (proof_id, position);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deliveries', 'delivery_items', 'delivery_proofs', 'delivery_proof_photos'] LOOP
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

-- The two emails: to the consignee (with the link to the POD) and to the VORA admin. Both start switched off like every notification.
INSERT INTO email_templates (key, subject, html) VALUES
  ('delivery_received_customer', $vora$VORA delivery $delivery_number received$vora$, $vora$<p>Dear $consignee_name,</p><p>Your shipment <strong>$delivery_number</strong> has been delivered and received by <strong>$receiver_name</strong> on $received_at.</p><p>The proof of delivery, with the signature, photos, location (when shared) and time of receipt, is available here: <a href="$pod_url">View the proof of delivery</a>.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('delivery_received_admin', $vora$VORA delivery $delivery_number received$vora$, $vora$<p>Delivery <strong>$delivery_number</strong> to $consignee_name was received by $receiver_name on $received_at.</p><p>Open in admin: <a href="$admin_url">$delivery_number</a></p>$vora$)
ON CONFLICT (key) DO NOTHING;
INSERT INTO email_rules (key, enabled) VALUES
  ('delivery_received_customer', FALSE),
  ('delivery_received_admin', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Functions. The application checks and prepares every value; these functions repeat the checks that matter under a row lock and write
-- the change, its items and its audit row in one transaction. A refusal is a SQLSTATE VRnnn (see vr_fail in migration 0024).
-- ---------------------------------------------------------------------------------------------------------------------------------

-- p: customer_id, consignee_*, origin, destination, shipment_reference, po_number, carrier, vehicle, vehicle_plate, driver_name, driver_phone,
--    delivery_date, notes, capture_token, view_token, items [{description, quantity, unit, remarks}]
CREATE OR REPLACE FUNCTION delivery_create(p_actor integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_customer integer := nullif(p->>'customer_id', '')::integer; v_owner text; v_number text; v_id integer;
BEGIN
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one item'); END IF;
  IF v_customer IS NOT NULL THEN
    PERFORM 1 FROM customers WHERE id = v_customer;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
    v_owner := vr_public_code('customers', v_customer);
  ELSE
    v_owner := vr_company_code();
  END IF;
  v_number := vr_next_number('DLV', v_owner, p->>'delivery_date');
  INSERT INTO deliveries (number, status, customer_id, consignee_name, consignee_address, consignee_contact, consignee_phone, consignee_email, origin, destination,
      shipment_reference, po_number, carrier, vehicle, vehicle_plate, driver_name, driver_phone, delivery_date, notes, capture_token, view_token, created_by)
    VALUES (v_number, 'draft', v_customer, p->>'consignee_name', p->>'consignee_address', p->>'consignee_contact', p->>'consignee_phone', p->>'consignee_email', p->>'origin', p->>'destination',
      p->>'shipment_reference', p->>'po_number', p->>'carrier', p->>'vehicle', p->>'vehicle_plate', p->>'driver_name', p->>'driver_phone', p->>'delivery_date', p->>'notes',
      p->>'capture_token', p->>'view_token', p_actor)
    RETURNING id INTO v_id;
  INSERT INTO delivery_items (delivery_id, position, description, quantity, unit, remarks)
    SELECT v_id, (t.ord - 1)::integer, t.x->>'description', t.x->>'quantity', t.x->>'unit', t.x->>'remarks' FROM jsonb_array_elements(p->'items') WITH ORDINALITY AS t(x, ord);
  PERFORM vr_audit(p_actor, 'create', 'delivery', v_id, v_number);
  RETURN v_id;
END
$fn$;

-- Only a draft can be edited: once issued, the note is on its way with a printed QR code. p as for delivery_create, without the tokens.
CREATE OR REPLACE FUNCTION delivery_update(p_actor integer, p_id integer, p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_d deliveries%ROWTYPE; v_customer integer := nullif(p->>'customer_id', '')::integer;
BEGIN
  SELECT * INTO v_d FROM deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Delivery note not found'); END IF;
  IF v_d.status <> 'draft' THEN PERFORM vr_fail(409, 'Only a draft can be edited: void this delivery note and write a new one'); END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one item'); END IF;
  IF v_customer IS NOT NULL THEN
    PERFORM 1 FROM customers WHERE id = v_customer;
    IF NOT FOUND THEN PERFORM vr_fail(422, 'Select an existing customer'); END IF;
  END IF;
  UPDATE deliveries SET customer_id = v_customer, consignee_name = p->>'consignee_name', consignee_address = p->>'consignee_address', consignee_contact = p->>'consignee_contact',
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

-- issue: draft -> issued (its QR code starts to work). void: a draft or issued note (its QR code stops).
-- A received one needs its POD rejected first.
CREATE OR REPLACE FUNCTION delivery_set_status(p_actor integer, p_id integer, p_action text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_d deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Delivery note not found'); END IF;
  IF p_action = 'issue' AND v_d.status = 'draft' THEN
    UPDATE deliveries SET status = 'issued', issued_at = now(), updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'void' AND v_d.status IN ('draft', 'issued') THEN
    UPDATE deliveries SET status = 'void', updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'void' AND v_d.status = 'delivered' THEN
    PERFORM vr_fail(409, 'The goods were received: reject the proof of delivery first if it was recorded by mistake');
  ELSE
    PERFORM vr_fail(409, 'Invalid state change');
  END IF;
  PERFORM vr_audit(p_actor, p_action, 'delivery', p_id, v_d.number);
END
$fn$;

-- The recorded POD was wrong (wrong person, wrong goods): it stays as history and the same QR code can be used again.
CREATE OR REPLACE FUNCTION delivery_reject_proof(p_actor integer, p_id integer, p_reason text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_d deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Delivery note not found'); END IF;
  IF v_d.status <> 'delivered' THEN PERFORM vr_fail(409, 'This delivery has no recorded proof of delivery'); END IF;
  UPDATE delivery_proofs SET status = 'rejected', rejected_at = now(), rejected_by = p_actor, reject_reason = p_reason WHERE delivery_id = p_id AND status = 'submitted';
  UPDATE deliveries SET status = 'issued', delivered_at = NULL, updated_at = now() WHERE id = p_id;
  PERFORM vr_audit(p_actor, 'reject-proof', 'delivery', p_id, v_d.number || ': ' || p_reason);
END
$fn$;

-- The driver's submission (the receiver's details and signature included), after its evidence files were stored under the keys in p. The delivery is found by the QR code's token and
-- locked, so two phones sending at once record one proof; the second is told the receipt is already recorded (and the application removes
-- the files it had stored). p: token, courier_name, courier_phone, receiver_name, receiver_position, receiver_phone, receiver_email, receiver_id_number, condition,
-- condition_note, signature_key, signature_sha256, photos [{key, sha256}], location_status, latitude, longitude, accuracy_m, location_note,
-- device_time, ip, user_agent.
CREATE OR REPLACE FUNCTION delivery_submit_proof(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_d deliveries%ROWTYPE; v_proof_id integer; v_time timestamptz;
BEGIN
  SELECT * INTO v_d FROM deliveries WHERE capture_token = p->>'token' FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'This delivery link is not valid'); END IF;
  IF v_d.status = 'delivered' THEN PERFORM vr_fail(409, 'The receipt of this delivery has already been recorded'); END IF;
  IF v_d.status = 'draft' THEN PERFORM vr_fail(409, 'This delivery note has not been issued yet'); END IF;
  IF v_d.status <> 'issued' THEN PERFORM vr_fail(409, 'This delivery note was cancelled'); END IF;
  IF jsonb_typeof(p->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'photos') = 0 THEN PERFORM vr_fail(422, 'Take at least one photo of the goods'); END IF;
  INSERT INTO delivery_proofs (delivery_id, status, receiver_name, receiver_position, receiver_phone, receiver_email, receiver_id_number, courier_name, courier_phone, received_condition, condition_note,
      signature_key, signature_sha256, latitude, longitude, accuracy_m, location_status, location_note, device_time, ip, user_agent)
    VALUES (v_d.id, 'submitted', p->>'receiver_name', p->>'receiver_position', p->>'receiver_phone', p->>'receiver_email', p->>'receiver_id_number', p->>'courier_name', p->>'courier_phone', p->>'condition', p->>'condition_note',
      p->>'signature_key', p->>'signature_sha256', nullif(p->>'latitude', '')::double precision, nullif(p->>'longitude', '')::double precision, nullif(p->>'accuracy_m', '')::double precision,
      p->>'location_status', p->>'location_note', p->>'device_time', p->>'ip', p->>'user_agent')
    RETURNING id, server_time INTO v_proof_id, v_time;
  INSERT INTO delivery_proof_photos (proof_id, position, storage_key, sha256)
    SELECT v_proof_id, (t.ord - 1)::integer, t.x->>'key', t.x->>'sha256' FROM jsonb_array_elements(p->'photos') WITH ORDINALITY AS t(x, ord);
  UPDATE deliveries SET status = 'delivered', delivered_at = v_time, updated_at = now() WHERE id = v_d.id;
  PERFORM vr_audit(NULL, 'receive', 'delivery', v_d.id, v_d.number || ': received by ' || (p->>'receiver_name'));
  RETURN jsonb_build_object('proof_id', v_proof_id, 'server_time', v_time, 'delivery_id', v_d.id, 'number', v_d.number, 'consignee_name', v_d.consignee_name,
                            'consignee_email', v_d.consignee_email, 'view_token', v_d.view_token);
END
$fn$;

-- Closed to everyone but the server's secret key (service_role).
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('delivery_create', 'delivery_update', 'delivery_set_status', 'delivery_reject_proof', 'delivery_submit_proof')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
