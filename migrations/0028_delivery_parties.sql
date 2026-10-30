-- Delivery notes: the SHIPPER (sender) is a party of its own.
-- A delivery note named only a consignee. The customer who pays, the shipper who hands the cargo over and the consignee who receives it are three
-- different roles and often three different organisations; `origin` and `destination` are places, not parties. This adds the shipper's identity
-- next to the consignee's, which already exist as consignee_name / _address / _contact / _phone / _email.
--
-- Historical delivery notes keep NULL shipper columns: nothing is invented or copied into them (the customer is not necessarily the shipper),
-- they stay readable, and they can still change state (issue, receive, reject, void). A NEW note, and the edit of a draft, must name the shipper
-- and the consignee and give both a full address: delivery_create / delivery_update refuse otherwise. The table's own rule only forbids a shipper
-- that is present but blank, so it never blocks a historical row.
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS shipper_name    VARCHAR(240),
  ADD COLUMN IF NOT EXISTS shipper_address TEXT,
  ADD COLUMN IF NOT EXISTS shipper_contact VARCHAR(160),
  ADD COLUMN IF NOT EXISTS shipper_phone   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS shipper_email   VARCHAR(200);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_shipper_complete' AND conrelid = 'deliveries'::regclass) THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_shipper_complete
      CHECK (shipper_name IS NULL OR (btrim(shipper_name) <> '' AND btrim(coalesce(shipper_address, '')) <> ''));
  END IF;
END $$;

-- p: customer_id, quotation_id (both REQUIRED for a new note), shipper_name / _address / _contact / _phone / _email (name and address REQUIRED),
--    consignee_name / _address / _contact / _phone / _email (name and address REQUIRED), origin, destination, shipment_reference, po_number, carrier, vehicle,
--    vehicle_plate, driver_name, driver_phone, delivery_date, notes, capture_token, view_token, items[{description, quantity, unit, remarks}]
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
  IF length(btrim(coalesce(p->>'shipper_name', ''))) = 0 OR length(btrim(coalesce(p->>'shipper_address', ''))) = 0 THEN PERFORM vr_fail(422, 'Write the shipper''s name and full address'); END IF;
  IF length(btrim(coalesce(p->>'consignee_name', ''))) = 0 OR length(btrim(coalesce(p->>'consignee_address', ''))) = 0 THEN PERFORM vr_fail(422, 'Write the consignee''s name and full address'); END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one item'); END IF;
  v_number := vr_next_number('DLV', vr_public_code('customers', v_customer), p->>'delivery_date');
  INSERT INTO deliveries (number, status, customer_id, quotation_id,
      shipper_name, shipper_address, shipper_contact, shipper_phone, shipper_email,
      consignee_name, consignee_address, consignee_contact, consignee_phone, consignee_email, origin, destination,
      shipment_reference, po_number, carrier, vehicle, vehicle_plate, driver_name, driver_phone, delivery_date, notes, capture_token, view_token, created_by)
    VALUES (v_number, 'draft', v_customer, v_quotation,
      p->>'shipper_name', p->>'shipper_address', coalesce(p->>'shipper_contact', ''), coalesce(p->>'shipper_phone', ''), coalesce(p->>'shipper_email', ''),
      p->>'consignee_name', p->>'consignee_address', p->>'consignee_contact', p->>'consignee_phone', p->>'consignee_email', p->>'origin', p->>'destination',
      p->>'shipment_reference', p->>'po_number', p->>'carrier', p->>'vehicle', p->>'vehicle_plate', p->>'driver_name', p->>'driver_phone', p->>'delivery_date', p->>'notes',
      p->>'capture_token', p->>'view_token', p_actor)
    RETURNING id INTO v_id;
  INSERT INTO delivery_items (delivery_id, position, description, quantity, unit, remarks)
    SELECT v_id, (t.ord - 1)::integer, t.x->>'description', t.x->>'quantity', t.x->>'unit', t.x->>'remarks' FROM jsonb_array_elements(p->'items') WITH ORDINALITY AS t(x, ord);
  PERFORM vr_audit(p_actor, 'create', 'delivery', v_id, v_number || ' for quotation ' || v_q.number);
  RETURN v_id;
END
$fn$;

-- Only a draft can be edited (an issued note is on its way with a printed QR code; its parties are not rewritten silently: void it and write a new one).
-- Its customer and quotation stay as they were made. A legacy draft without a shipper must be given one when it is saved.
CREATE OR REPLACE FUNCTION delivery_update(p_actor integer, p_id integer, p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_d deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM vr_fail(404, 'Delivery note not found'); END IF;
  IF v_d.status <> 'draft' THEN PERFORM vr_fail(409, 'Only a draft can be edited: void this delivery note and write a new one'); END IF;
  IF length(btrim(coalesce(p->>'shipper_name', ''))) = 0 OR length(btrim(coalesce(p->>'shipper_address', ''))) = 0 THEN PERFORM vr_fail(422, 'Write the shipper''s name and full address'); END IF;
  IF length(btrim(coalesce(p->>'consignee_name', ''))) = 0 OR length(btrim(coalesce(p->>'consignee_address', ''))) = 0 THEN PERFORM vr_fail(422, 'Write the consignee''s name and full address'); END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN PERFORM vr_fail(422, 'Add at least one item'); END IF;
  UPDATE deliveries SET shipper_name = p->>'shipper_name', shipper_address = p->>'shipper_address', shipper_contact = coalesce(p->>'shipper_contact', ''),
      shipper_phone = coalesce(p->>'shipper_phone', ''), shipper_email = coalesce(p->>'shipper_email', ''),
      consignee_name = p->>'consignee_name', consignee_address = p->>'consignee_address', consignee_contact = p->>'consignee_contact',
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

-- Closed to everyone but the server's secret key (service_role), like the rest.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('delivery_create', 'delivery_update')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
