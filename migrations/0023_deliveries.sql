-- Delivery notes (surat jalan) with a proof of delivery (POD).
-- A delivery note travels with the goods and carries a QR code. The person who receives the goods scans it and, on their own phone,
-- signs on the screen, photographs the goods, gives their details, and the phone's position and time are recorded: that is the POD.
-- The QR code and the emailed "view the POD" link are two different, unguessable tokens (a printed QR must keep working, so they are
-- stored, not derived from a secret that may be rotated). Evidence files (signature, photos) live in the private documents bucket.
-- Delivery status: draft -> issued -> delivered (a POD was submitted) -> back to issued when Finance rejects the POD; void from draft or issued.
-- RLS is enabled with no policies, so the Supabase Data API cannot read any of it.
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
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id                 SERIAL PRIMARY KEY,
  delivery_id        INTEGER      NOT NULL REFERENCES deliveries (id),
  status             VARCHAR(12)  NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'rejected')),
  receiver_name      VARCHAR(160) NOT NULL,
  receiver_position  VARCHAR(160) NOT NULL,
  receiver_phone     VARCHAR(60)  NOT NULL,
  receiver_email     VARCHAR(200) NOT NULL DEFAULT '',
  receiver_id_number VARCHAR(40)  NOT NULL DEFAULT '',
  received_condition VARCHAR(10)  NOT NULL DEFAULT 'good' CHECK (received_condition IN ('good', 'damaged', 'partial')),
  condition_note     VARCHAR(1000) NOT NULL DEFAULT '',
  signature_key      VARCHAR(500) NOT NULL,
  signature_sha256   VARCHAR(64)  NOT NULL,
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  accuracy_m         DOUBLE PRECISION,
  location_status    VARCHAR(12)  NOT NULL CHECK (location_status IN ('captured', 'unavailable')),
  location_note      VARCHAR(240) NOT NULL DEFAULT '',
  device_time        VARCHAR(40)  NOT NULL DEFAULT '',
  server_time        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ip                 VARCHAR(64)  NOT NULL DEFAULT '',
  user_agent         VARCHAR(300) NOT NULL DEFAULT '',
  rejected_at        TIMESTAMPTZ,
  rejected_by        INTEGER REFERENCES users (id),
  reject_reason      VARCHAR(500) NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_proofs_live ON delivery_proofs (delivery_id) WHERE status = 'submitted';

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
  ('delivery_received_customer', $vora$VORA delivery $delivery_number received$vora$, $vora$<p>Dear $consignee_name,</p><p>Your shipment <strong>$delivery_number</strong> has been delivered and received by <strong>$receiver_name</strong> on $received_at.</p><p>The proof of delivery, with the signature, photos, location and time of receipt, is available here: <a href="$pod_url">View the proof of delivery</a>.</p><p>VORA | Freight & Logistics</p>$vora$),
  ('delivery_received_admin', $vora$VORA delivery $delivery_number received$vora$, $vora$<p>Delivery <strong>$delivery_number</strong> to $consignee_name was received by $receiver_name on $received_at.</p><p>Open in admin: <a href="$admin_url">$delivery_number</a></p>$vora$)
ON CONFLICT (key) DO NOTHING;
INSERT INTO email_rules (key, enabled) VALUES
  ('delivery_received_customer', FALSE),
  ('delivery_received_admin', FALSE)
ON CONFLICT (key) DO NOTHING;
