-- VORA Document Trust: immutable issued artifacts, organisational issuance attestations, an append-only evidence chain, revocation/supersession,
-- signer profiles and authority, passkey credentials, signing requests, challenges and events, and the parties of a multi-party document.
--
-- Additive and backward compatible: no existing table loses a column or a row, every existing document and QR token keeps working, and a document that was
-- issued before this migration simply has no artifact, no attestation and no signing event. It is NOT given any: the verification page shows only the evidence
-- that exists ("legacy" assurance). Nothing here is applied to production automatically.
--
-- What is and is not claimed:
--   * An artifact is the exact PDF VORA issued, kept in private storage with its SHA-256. It is never rewritten.
--   * An attestation is VORA's own Ed25519 signature over a canonical description of that artifact, made with a server-held key whose public half is listed
--     here. It is an internal application attestation, NOT a PSrE-certified electronic seal and NOT a personal electronic signature.
--   * A signing event is a non-certified electronic signature by an authenticated individual who held an active authority, consented explicitly, and proved
--     control of a passkey for THIS exact payload. It is not a certificate-backed signature.

-- The moment this system started. A document CREATED before it (an invoice, a letter, ...) keeps its legacy behaviour for ever: it is not given an archived artifact or
-- an attestation, because that would claim evidence that was never kept. Only documents created at or after this moment are archived when they are issued.
INSERT INTO settings (key, value, updated_at) VALUES ('trust_enabled_at', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), now()) ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Keys
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- The PUBLIC halves of the attestation keys. The private key is never in the database: it is an environment secret of the server (see DEPLOYMENT.md).
-- A retired key still verifies what it signed; a compromised key is marked so that the verification page says its attestations are not to be relied on.
CREATE TABLE IF NOT EXISTS attestation_keys (
  key_id         VARCHAR(64) PRIMARY KEY CHECK (key_id ~ '^[A-Za-z0-9._-]{3,64}$'),
  algorithm      VARCHAR(16) NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
  public_key     TEXT NOT NULL CHECK (length(public_key) BETWEEN 40 AND 200),      -- base64 of the SPKI DER
  status         VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'compromised')),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at     TIMESTAMPTZ,
  compromised_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_attestation_keys_one_active ON attestation_keys ((TRUE)) WHERE status = 'active';

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Artifacts and attestations
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- `kind` is the kind of the verification token (invoice, receipt, quotation, prepayment, document, delivery, pod); `document_id` is the row it names.
-- Version 1 is the issued file; a later version is a signed file made from the one before it (`supersedes_artifact_id`). Rows are never changed.
CREATE TABLE IF NOT EXISTS document_artifacts (
  id                     SERIAL PRIMARY KEY,
  kind                   VARCHAR(20) NOT NULL,
  document_id            INTEGER NOT NULL,
  version                INTEGER NOT NULL CHECK (version >= 1),
  role                   VARCHAR(16) NOT NULL CHECK (role IN ('issued', 'signed')),
  storage_key            VARCHAR(300) NOT NULL,
  sha256                 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size              INTEGER NOT NULL CHECK (byte_size > 0),
  pages                  INTEGER,
  source_sha256          CHAR(64) CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),  -- the original third-party file, when there is one
  supersedes_artifact_id INTEGER REFERENCES document_artifacts (id),
  created_by             INTEGER REFERENCES users (id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, document_id, version),
  UNIQUE (storage_key)
);
CREATE INDEX IF NOT EXISTS ix_document_artifacts_sha ON document_artifacts (sha256);

CREATE TABLE IF NOT EXISTS document_attestations (
  id                SERIAL PRIMARY KEY,
  artifact_id       INTEGER NOT NULL UNIQUE REFERENCES document_artifacts (id),
  key_id            VARCHAR(64) NOT NULL REFERENCES attestation_keys (key_id),
  algorithm         VARCHAR(16) NOT NULL DEFAULT 'Ed25519',
  payload_canonical TEXT NOT NULL,                  -- the exact text that was signed (canonical JSON)
  signature         TEXT NOT NULL,                  -- base64url
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Evidence chain (append-only, hash-linked per document)
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_events (
  id          BIGSERIAL PRIMARY KEY,
  kind        VARCHAR(20) NOT NULL,
  document_id INTEGER NOT NULL,
  artifact_id INTEGER REFERENCES document_artifacts (id),
  event_type  VARCHAR(40) NOT NULL CHECK (event_type IN ('issued', 'attested', 'attestation_unavailable', 'signing_requested', 'signing_completed', 'signing_cancelled', 'revoked', 'superseded',
                                                       'party_fulfilled', 'legal_review_recorded', 'evidence_exported')),
  actor_id    INTEGER REFERENCES users (id),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash   CHAR(64) NOT NULL,
  hash        CHAR(64) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_evidence_events_document ON evidence_events (kind, document_id, id);

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Revocation and supersession live next to the QR token that they affect
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
ALTER TABLE document_verification_tokens
  ADD COLUMN IF NOT EXISTS revoked_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_reason      VARCHAR(300),
  ADD COLUMN IF NOT EXISTS superseded_by_kind  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS superseded_by_id    INTEGER;

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Signers
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- One profile per portal user. The identity is the Supabase Auth account behind users.auth_user_id: the name and position below are what the AUTHORISED
-- person is called on documents, set by an administrator other than that person (see signer_authority_grant), never typed by whoever prepares a document.
CREATE TABLE IF NOT EXISTS signer_profiles (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL UNIQUE REFERENCES users (id),
  display_name VARCHAR(160) NOT NULL CHECK (btrim(display_name) <> ''),
  position     VARCHAR(160) NOT NULL CHECK (btrim(position) <> ''),
  status       VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants of authority, kept for ever: a grant ends by being revoked (revoked_at), never by being deleted or edited.
-- `scope` lists document families the person may sign for (letter, parties, certificate, agreement, seal, ...) or '*'.
CREATE TABLE IF NOT EXISTS signer_authorities (
  id            SERIAL PRIMARY KEY,
  profile_id    INTEGER NOT NULL REFERENCES signer_profiles (id),
  scope         TEXT[] NOT NULL CHECK (cardinality(scope) > 0),
  granted_by    INTEGER NOT NULL REFERENCES users (id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  sole_admin_grant BOOLEAN NOT NULL DEFAULT FALSE,    -- the only active administrator granted authority to themselves: recorded, not hidden
  note          VARCHAR(300),
  revoked_at    TIMESTAMPTZ,
  revoked_by    INTEGER REFERENCES users (id),
  revoke_reason VARCHAR(300)
);
CREATE INDEX IF NOT EXISTS ix_signer_authorities_profile ON signer_authorities (profile_id);

-- Passkeys (WebAuthn). The private key never leaves the signer's device; only the public key and a sign counter are stored.
CREATE TABLE IF NOT EXISTS signer_credentials (
  id            SERIAL PRIMARY KEY,
  profile_id    INTEGER NOT NULL REFERENCES signer_profiles (id),
  credential_id TEXT NOT NULL UNIQUE,                 -- base64url
  public_key    TEXT NOT NULL,                        -- base64url of the COSE key
  counter       BIGINT NOT NULL DEFAULT 0,
  transports    TEXT[],
  device_type   VARCHAR(20),
  backed_up     BOOLEAN,
  label         VARCHAR(80),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_signer_credentials_profile ON signer_credentials (profile_id);

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Signing requests, challenges and events
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- A request names the document, the exact artifact (and its SHA-256) the person is asked to sign, the person, and why. The person who prepares it is
-- recorded and is NOT the signer by virtue of preparing it.
CREATE TABLE IF NOT EXISTS signing_requests (
  id                 SERIAL PRIMARY KEY,
  ref                VARCHAR(24) NOT NULL UNIQUE,                       -- VORA-SIG-XXXXXXXX
  kind               VARCHAR(20) NOT NULL,
  document_id        INTEGER NOT NULL,
  family             VARCHAR(30) NOT NULL,
  source_artifact_id INTEGER NOT NULL REFERENCES document_artifacts (id),
  source_sha256      CHAR(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  signer_profile_id  INTEGER NOT NULL REFERENCES signer_profiles (id),
  purpose            VARCHAR(20) NOT NULL CHECK (purpose IN ('verified', 'approved', 'acknowledged', 'signed')),
  party_role         VARCHAR(30) NOT NULL DEFAULT 'vora',
  created_by         INTEGER NOT NULL REFERENCES users (id),
  legal_review_note  VARCHAR(500),                                      -- a document class that needs legal review records who reviewed it and what was decided
  legal_review_by    INTEGER REFERENCES users (id),
  status             VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'cancelled', 'expired')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL,
  completed_at       TIMESTAMPTZ,
  result_artifact_id INTEGER REFERENCES document_artifacts (id)
);
CREATE INDEX IF NOT EXISTS ix_signing_requests_document ON signing_requests (kind, document_id);
CREATE INDEX IF NOT EXISTS ix_signing_requests_signer ON signing_requests (signer_profile_id, status);
-- One open request per document and signer, so that two preparers cannot race two ceremonies on the same file.
CREATE UNIQUE INDEX IF NOT EXISTS ux_signing_requests_open ON signing_requests (kind, document_id, signer_profile_id) WHERE status = 'pending';

-- One row per ceremony attempt (or passkey registration). `challenge` is what the passkey signs: for a signing it is the SHA-256 of the canonical payload, so
-- the assertion is bound to that exact document, signer, purpose, consent and placement. Used once (consumed_at) and only before it expires.
CREATE TABLE IF NOT EXISTS signing_challenges (
  id                SERIAL PRIMARY KEY,
  purpose           VARCHAR(12) NOT NULL CHECK (purpose IN ('register', 'sign')),
  profile_id        INTEGER NOT NULL REFERENCES signer_profiles (id),
  request_id        INTEGER REFERENCES signing_requests (id),
  challenge         VARCHAR(100) NOT NULL UNIQUE,                       -- base64url
  payload_canonical TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  consumed_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS signing_events (
  id                 SERIAL PRIMARY KEY,
  request_id         INTEGER NOT NULL UNIQUE REFERENCES signing_requests (id),
  ref                VARCHAR(24) NOT NULL UNIQUE,
  profile_id         INTEGER NOT NULL REFERENCES signer_profiles (id),
  user_id            INTEGER NOT NULL REFERENCES users (id),
  credential_id      INTEGER NOT NULL REFERENCES signer_credentials (id),
  kind               VARCHAR(20) NOT NULL,
  document_id        INTEGER NOT NULL,
  source_artifact_id INTEGER NOT NULL REFERENCES document_artifacts (id),
  signed_artifact_id INTEGER NOT NULL UNIQUE REFERENCES document_artifacts (id),
  purpose            VARCHAR(20) NOT NULL,
  signer_name        VARCHAR(160) NOT NULL,                              -- frozen at signing
  signer_position    VARCHAR(160) NOT NULL,
  payload_canonical  TEXT NOT NULL,
  payload_sha256     CHAR(64) NOT NULL,
  consent            JSONB NOT NULL,                                     -- the statement shown, its version and each separate confirmation
  authentication     JSONB NOT NULL,                                     -- method, rp id, origin, user verification, counter: no secret, no IP
  placement          JSONB NOT NULL,
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The parties a document needs, and how each was fulfilled. VORA signing never fulfils anybody else's part.
CREATE TABLE IF NOT EXISTS document_parties (
  id               SERIAL PRIMARY KEY,
  kind             VARCHAR(20) NOT NULL,
  document_id      INTEGER NOT NULL,
  role             VARCHAR(30) NOT NULL,
  name             VARCHAR(240) NOT NULL CHECK (btrim(name) <> ''),
  required         BOOLEAN NOT NULL DEFAULT TRUE,
  method           VARCHAR(30) CHECK (method IS NULL OR method IN ('vora_electronic', 'external_pdf_uploaded', 'wet_ink_uploaded', 'manually_validated', 'external_certified_verified')),
  signing_event_id INTEGER REFERENCES signing_events (id),
  evidence_note    VARCHAR(500),
  evidence_sha256  CHAR(64) CHECK (evidence_sha256 IS NULL OR evidence_sha256 ~ '^[0-9a-f]{64}$'),
  fulfilled_at     TIMESTAMPTZ,
  fulfilled_by     INTEGER REFERENCES users (id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, document_id, role),
  CHECK ((method IS NULL) = (fulfilled_at IS NULL)),
  CHECK (method IS DISTINCT FROM 'vora_electronic' OR signing_event_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Immutability
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trust_block_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  RAISE EXCEPTION 'Evidence is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME USING ERRCODE = 'VR409';
END
$fn$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_artifacts', 'document_attestations', 'evidence_events', 'signing_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_immutable ON %1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_immutable BEFORE UPDATE OR DELETE ON %1$I FOR EACH ROW EXECUTE FUNCTION trust_block_change()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_no_truncate ON %1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_no_truncate BEFORE TRUNCATE ON %1$I FOR EACH STATEMENT EXECUTE FUNCTION trust_block_change()', t);
  END LOOP;
END $$;

-- An authority can only be ended: the one change allowed is to fill in the revocation, once.
CREATE OR REPLACE FUNCTION trust_authority_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Authority history is kept: a grant is revoked, not deleted' USING ERRCODE = 'VR409'; END IF;
  IF OLD.revoked_at IS NOT NULL
     OR (to_jsonb(NEW) - 'revoked_at' - 'revoked_by' - 'revoke_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at' - 'revoked_by' - 'revoke_reason') THEN
    RAISE EXCEPTION 'A grant of authority cannot be edited: revoke it and grant a new one' USING ERRCODE = 'VR409';
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS trg_signer_authorities_guard ON signer_authorities;
CREATE TRIGGER trg_signer_authorities_guard BEFORE UPDATE OR DELETE ON signer_authorities FOR EACH ROW EXECUTE FUNCTION trust_authority_guard();

-- Revoking a token records when, and writes the evidence event, whichever code path voided the document.
CREATE OR REPLACE FUNCTION trust_token_revoked() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NEW.revoked AND NOT coalesce(OLD.revoked, FALSE) THEN
    NEW.revoked_at := coalesce(NEW.revoked_at, now());
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS trg_tokens_revoked_before ON document_verification_tokens;
CREATE TRIGGER trg_tokens_revoked_before BEFORE UPDATE OF revoked ON document_verification_tokens FOR EACH ROW EXECUTE FUNCTION trust_token_revoked();

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Evidence chain functions
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trust_event_hash(p_prev text, p_kind text, p_document integer, p_type text, p_actor integer, p_artifact integer, p_payload jsonb, p_at timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT encode(sha256(convert_to(
    p_prev || '|' || p_kind || '|' || p_document::text || '|' || p_type || '|' || coalesce(p_actor::text, '') || '|' || coalesce(p_artifact::text, '') || '|' || p_payload::text || '|' ||
    to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'UTF8')), 'hex')
$fn$;

-- Appends one event to the document's chain. Serialised per document, so two writers can never fork the chain.
CREATE OR REPLACE FUNCTION trust_append_evidence(p_kind text, p_document integer, p_type text, p_actor integer, p_artifact integer, p_payload jsonb DEFAULT '{}'::jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_prev text; v_now timestamptz := clock_timestamp(); v_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('trust-chain:' || p_kind || ':' || p_document::text));
  SELECT hash INTO v_prev FROM evidence_events WHERE kind = p_kind AND document_id = p_document ORDER BY id DESC LIMIT 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_now := date_trunc('milliseconds', v_now);
  INSERT INTO evidence_events (kind, document_id, artifact_id, event_type, actor_id, payload, prev_hash, hash, created_at)
    VALUES (p_kind, p_document, p_artifact, p_type, p_actor, coalesce(p_payload, '{}'::jsonb), v_prev,
            trust_event_hash(v_prev, p_kind, p_document, p_type, p_actor, p_artifact, coalesce(p_payload, '{}'::jsonb), v_now), v_now)
    RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

-- Re-computes the whole chain of a document: { ok, events, broken_at }.
CREATE OR REPLACE FUNCTION trust_verify_evidence(p_kind text, p_document integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $fn$
DECLARE r record; v_prev text := repeat('0', 64); v_count integer := 0;
BEGIN
  FOR r IN SELECT * FROM evidence_events WHERE kind = p_kind AND document_id = p_document ORDER BY id LOOP
    IF r.prev_hash <> v_prev OR r.hash <> trust_event_hash(r.prev_hash, r.kind, r.document_id, r.event_type, r.actor_id, r.artifact_id, r.payload, r.created_at) THEN
      RETURN jsonb_build_object('ok', FALSE, 'events', v_count, 'broken_at', r.id);
    END IF;
    v_prev := r.hash; v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', TRUE, 'events', v_count, 'broken_at', NULL);
END
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Issuance
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- The verification token of a document that may not have one yet (a delivery note or a proof of delivery). Idempotent, and serialised so that two callers get one token.
CREATE OR REPLACE FUNCTION trust_ensure_verification(p_kind text, p_document integer) RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_token text;
BEGIN
  IF p_kind NOT IN ('invoice', 'receipt', 'quotation', 'prepayment', 'document', 'delivery', 'pod') THEN RAISE EXCEPTION 'Unknown document kind' USING ERRCODE = 'VR422'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('trust-token:' || p_kind || ':' || p_document::text));
  SELECT token INTO v_token FROM document_verification_tokens WHERE kind = p_kind AND document_id = p_document ORDER BY id LIMIT 1;
  IF v_token IS NULL THEN v_token := vr_create_verification(p_kind, p_document); END IF;
  RETURN v_token;
END
$fn$;

-- The next version of a document's artifacts, for the application to put into the attestation it is about to sign.
CREATE OR REPLACE FUNCTION trust_next_version(p_kind text, p_document integer) RETURNS integer
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT coalesce(max(version), 0) + 1 FROM document_artifacts WHERE kind = p_kind AND document_id = p_document
$fn$;

-- Records an artifact, its attestation (when there is one) and the evidence, in one transaction. `p_expected_version` is the version the attestation was made for:
-- if another issuance got there first the call is refused (409) and the application removes the file it stored, so a document is issued once.
-- p: { storage_key, sha256, byte_size, pages, source_sha256, role, key_id, payload_canonical, signature, summary }
CREATE OR REPLACE FUNCTION trust_record_issuance(p_actor integer, p_kind text, p_document integer, p_expected_version integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_version integer; v_prev integer; v_id integer; v_role text := p->>'role'; v_key text := nullif(p->>'key_id', '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('trust-artifact:' || p_kind || ':' || p_document::text));
  SELECT coalesce(max(version), 0) + 1, max(id) INTO v_version, v_prev FROM document_artifacts WHERE kind = p_kind AND document_id = p_document;
  IF v_version <> p_expected_version THEN RAISE EXCEPTION 'This document was issued or signed meanwhile: reload it' USING ERRCODE = 'VR409'; END IF;
  IF v_role = 'issued' AND v_version <> 1 THEN RAISE EXCEPTION 'This document already has an issued file' USING ERRCODE = 'VR409'; END IF;
  IF v_role = 'signed' AND v_version = 1 THEN RAISE EXCEPTION 'A signed file is made from an issued one' USING ERRCODE = 'VR409'; END IF;
  IF v_role NOT IN ('issued', 'signed') THEN RAISE EXCEPTION 'Unknown artifact role' USING ERRCODE = 'VR422'; END IF;
  IF NOT EXISTS (SELECT 1 FROM document_verification_tokens WHERE kind = p_kind AND document_id = p_document AND NOT revoked) THEN
    RAISE EXCEPTION 'The document has no active verification record' USING ERRCODE = 'VR409';
  END IF;
  INSERT INTO document_artifacts (kind, document_id, version, role, storage_key, sha256, byte_size, pages, source_sha256, supersedes_artifact_id, created_by)
    VALUES (p_kind, p_document, v_version, v_role, p->>'storage_key', p->>'sha256', (p->>'byte_size')::integer, nullif(p->>'pages', '')::integer, nullif(p->>'source_sha256', ''), v_prev, p_actor)
    RETURNING id INTO v_id;
  PERFORM trust_append_evidence(p_kind, p_document, 'issued', p_actor, v_id, jsonb_build_object('version', v_version, 'role', v_role, 'sha256', p->>'sha256', 'summary', p->'summary'));
  IF v_key IS NOT NULL THEN
    INSERT INTO document_attestations (artifact_id, key_id, payload_canonical, signature) VALUES (v_id, v_key, p->>'payload_canonical', p->>'signature');
    PERFORM trust_append_evidence(p_kind, p_document, 'attested', p_actor, v_id, jsonb_build_object('key_id', v_key));
  ELSE
    PERFORM trust_append_evidence(p_kind, p_document, 'attestation_unavailable', p_actor, v_id, jsonb_build_object('reason', 'no attestation key was configured'));
  END IF;
  RETURN v_id;
END
$fn$;

-- Revokes a document's verification record (the existing void functions already do this on their own) or marks it superseded by another document.
CREATE OR REPLACE FUNCTION trust_revoke(p_actor integer, p_kind text, p_document integer, p_reason text, p_superseded_kind text DEFAULT NULL, p_superseded_id integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_n integer;
BEGIN
  IF p_superseded_kind IS NOT NULL AND p_superseded_id IS NULL THEN RAISE EXCEPTION 'Name the document that replaces this one' USING ERRCODE = 'VR422'; END IF;
  UPDATE document_verification_tokens
     SET revoked = TRUE, revoked_at = coalesce(revoked_at, now()), revoked_reason = left(coalesce(revoked_reason, p_reason), 300),
         superseded_by_kind = coalesce(superseded_by_kind, p_superseded_kind), superseded_by_id = coalesce(superseded_by_id, p_superseded_id)
   WHERE kind = p_kind AND document_id = p_document;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'The document has no verification record' USING ERRCODE = 'VR404'; END IF;
  PERFORM trust_append_evidence(p_kind, p_document, CASE WHEN p_superseded_kind IS NULL THEN 'revoked' ELSE 'superseded' END, p_actor, NULL,
                                jsonb_build_object('reason', left(coalesce(p_reason, ''), 300), 'superseded_by_kind', p_superseded_kind, 'superseded_by_id', p_superseded_id));
END
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Signers and signing
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Is the profile active, and does it hold a current, unrevoked authority covering `p_family` at `p_at`?
CREATE OR REPLACE FUNCTION trust_signer_authorized(p_profile integer, p_family text, p_at timestamptz DEFAULT now()) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM signer_profiles p JOIN users u ON u.id = p.user_id JOIN signer_authorities a ON a.profile_id = p.id
     WHERE p.id = p_profile AND p.status = 'active' AND u.active
       AND a.revoked_at IS NULL AND a.granted_at <= p_at AND (a.valid_until IS NULL OR a.valid_until > p_at)
       AND ('*' = ANY (a.scope) OR p_family = ANY (a.scope)))
$fn$;

-- Grants authority. The administrator who grants it is not the person who receives it, except for the sole active administrator, which is recorded on the grant.
CREATE OR REPLACE FUNCTION trust_authority_grant(p_actor integer, p_profile integer, p_scope text[], p_valid_until timestamptz, p_note text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_user integer; v_sole boolean := FALSE; v_id integer;
BEGIN
  SELECT user_id INTO v_user FROM signer_profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signer profile not found' USING ERRCODE = 'VR404'; END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until <= now() THEN RAISE EXCEPTION 'The end of the authority must be in the future' USING ERRCODE = 'VR422'; END IF;
  IF v_user = p_actor THEN
    IF (SELECT count(*) FROM users WHERE active AND role = 'admin') <> 1 THEN RAISE EXCEPTION 'Authority to sign is granted by another administrator' USING ERRCODE = 'VR403'; END IF;
    v_sole := TRUE;
  END IF;
  INSERT INTO signer_authorities (profile_id, scope, granted_by, valid_until, sole_admin_grant, note) VALUES (p_profile, p_scope, p_actor, p_valid_until, v_sole, left(p_note, 300)) RETURNING id INTO v_id;
  UPDATE signer_profiles SET status = 'active', updated_at = now() WHERE id = p_profile AND status = 'pending';
  PERFORM vr_audit(p_actor, 'grant', 'signer_authority', v_id, array_to_string(p_scope, ','));
  RETURN v_id;
END
$fn$;

-- Uses a challenge once: only a challenge that exists, belongs to the profile and purpose, has not expired and has not been used. Returns its request and payload.
CREATE OR REPLACE FUNCTION trust_consume_challenge(p_challenge text, p_profile integer, p_purpose text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE r signing_challenges%ROWTYPE;
BEGIN
  UPDATE signing_challenges SET consumed_at = now()
   WHERE challenge = p_challenge AND profile_id = p_profile AND purpose = p_purpose AND consumed_at IS NULL AND expires_at > now()
   RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'The authentication request is unknown, expired or already used: start again' USING ERRCODE = 'VR409'; END IF;
  RETURN jsonb_build_object('request_id', r.request_id, 'payload_canonical', r.payload_canonical);
END
$fn$;

-- Completes a signing, all or nothing. Everything the ceremony relied on is checked again here, under lock, whatever the application believed:
-- the request is still pending and unexpired, the signer is still authorised, the file being signed is still the latest and has the SHA-256 that was shown.
-- p: { credential_row_id, counter, signer_name, signer_position, payload_canonical, payload_sha256, consent, authentication, placement,
--      artifact: { storage_key, sha256, byte_size, pages, key_id, payload_canonical, signature } }
CREATE OR REPLACE FUNCTION trust_complete_signing(p_request integer, p_expected_version integer, p jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE q signing_requests%ROWTYPE; v_profile signer_profiles%ROWTYPE; v_latest document_artifacts%ROWTYPE; v_artifact integer; v_event integer; v_cred integer := (p->>'credential_row_id')::integer;
BEGIN
  SELECT * INTO q FROM signing_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signing request not found' USING ERRCODE = 'VR404'; END IF;
  IF q.status <> 'pending' THEN RAISE EXCEPTION 'This signing request is no longer open' USING ERRCODE = 'VR409'; END IF;
  IF q.expires_at <= now() THEN RAISE EXCEPTION 'This signing request has expired' USING ERRCODE = 'VR409'; END IF;
  SELECT * INTO v_profile FROM signer_profiles WHERE id = q.signer_profile_id;
  IF NOT trust_signer_authorized(q.signer_profile_id, q.family) THEN RAISE EXCEPTION 'The signer holds no current authority for this kind of document' USING ERRCODE = 'VR403'; END IF;
  IF NOT EXISTS (SELECT 1 FROM signer_credentials WHERE id = v_cred AND profile_id = q.signer_profile_id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'The passkey is not valid for this signer' USING ERRCODE = 'VR403'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('trust-artifact:' || q.kind || ':' || q.document_id::text));
  SELECT * INTO v_latest FROM document_artifacts WHERE kind = q.kind AND document_id = q.document_id ORDER BY version DESC LIMIT 1;
  IF v_latest.id IS DISTINCT FROM q.source_artifact_id OR v_latest.sha256 <> q.source_sha256 THEN RAISE EXCEPTION 'The document changed after the signing request was made: the consent given does not apply to it' USING ERRCODE = 'VR409'; END IF;
  IF v_latest.version + 1 <> p_expected_version THEN RAISE EXCEPTION 'This document was signed meanwhile: reload it' USING ERRCODE = 'VR409'; END IF;
  IF NOT EXISTS (SELECT 1 FROM document_verification_tokens WHERE kind = q.kind AND document_id = q.document_id AND NOT revoked) THEN RAISE EXCEPTION 'The document is revoked or has no verification record' USING ERRCODE = 'VR409'; END IF;

  INSERT INTO document_artifacts (kind, document_id, version, role, storage_key, sha256, byte_size, pages, source_sha256, supersedes_artifact_id, created_by)
    VALUES (q.kind, q.document_id, p_expected_version, 'signed', p#>>'{artifact,storage_key}', p#>>'{artifact,sha256}', (p#>>'{artifact,byte_size}')::integer, nullif(p#>>'{artifact,pages}', '')::integer,
            v_latest.source_sha256, v_latest.id, v_profile.user_id)
    RETURNING id INTO v_artifact;
  IF nullif(p#>>'{artifact,key_id}', '') IS NOT NULL THEN
    INSERT INTO document_attestations (artifact_id, key_id, payload_canonical, signature) VALUES (v_artifact, p#>>'{artifact,key_id}', p#>>'{artifact,payload_canonical}', p#>>'{artifact,signature}');
  END IF;
  INSERT INTO signing_events (request_id, ref, profile_id, user_id, credential_id, kind, document_id, source_artifact_id, signed_artifact_id, purpose, signer_name, signer_position,
                              payload_canonical, payload_sha256, consent, authentication, placement)
    VALUES (q.id, q.ref, q.signer_profile_id, v_profile.user_id, v_cred, q.kind, q.document_id, v_latest.id, v_artifact, q.purpose, p->>'signer_name', p->>'signer_position',
            p->>'payload_canonical', p->>'payload_sha256', p->'consent', p->'authentication', p->'placement')
    RETURNING id INTO v_event;
  UPDATE signer_credentials SET counter = greatest(counter, (p->>'counter')::bigint), last_used_at = now() WHERE id = v_cred;
  UPDATE signing_requests SET status = 'signed', completed_at = now(), result_artifact_id = v_artifact WHERE id = q.id;
  PERFORM trust_append_evidence(q.kind, q.document_id, 'issued', v_profile.user_id, v_artifact, jsonb_build_object('version', p_expected_version, 'role', 'signed', 'sha256', p#>>'{artifact,sha256}'));
  IF nullif(p#>>'{artifact,key_id}', '') IS NOT NULL THEN PERFORM trust_append_evidence(q.kind, q.document_id, 'attested', v_profile.user_id, v_artifact, jsonb_build_object('key_id', p#>>'{artifact,key_id}')); END IF;
  PERFORM trust_append_evidence(q.kind, q.document_id, 'signing_completed', v_profile.user_id, v_artifact,
                                jsonb_build_object('signing_ref', q.ref, 'signer_profile_id', q.signer_profile_id, 'purpose', q.purpose, 'party_role', q.party_role, 'payload_sha256', p->>'payload_sha256'));
  -- The party this signing was for, if the document tracks parties: fulfilled by this event, and only this party.
  UPDATE document_parties SET method = 'vora_electronic', signing_event_id = v_event, fulfilled_at = now(), fulfilled_by = v_profile.user_id
   WHERE kind = q.kind AND document_id = q.document_id AND role = q.party_role AND method IS NULL;
  RETURN v_event;
END
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
-- Who may do what: the tables are closed to the public API roles, evidence cannot be changed even through the Data API, and the functions are for the server only.
-- ---------------------------------------------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE t text; f record;
BEGIN
  FOREACH t IN ARRAY ARRAY['attestation_keys', 'document_artifacts', 'document_attestations', 'evidence_events', 'signer_profiles', 'signer_authorities', 'signer_credentials',
                           'signing_requests', 'signing_challenges', 'signing_events', 'document_parties'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t); END IF;
  END LOOP;
  -- Evidence is written through the functions above only. Even the server's own API role cannot edit or delete a row of it.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH t IN ARRAY ARRAY['document_artifacts', 'document_attestations', 'evidence_events', 'signing_events'] LOOP
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM service_role', t);
    END LOOP;
    REVOKE UPDATE, DELETE, TRUNCATE ON signer_authorities FROM service_role;
    GRANT UPDATE (revoked_at, revoked_by, revoke_reason) ON signer_authorities TO service_role;
    REVOKE DELETE, TRUNCATE ON signer_profiles, signer_credentials, signing_requests, document_parties, attestation_keys FROM service_role;
  END IF;
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'trust\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
