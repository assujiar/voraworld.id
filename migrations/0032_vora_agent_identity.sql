-- VORA Virtual Agent: compulsory visitor registration and CRM-aware deduplication.
-- Run after 0031. Private service-role only; do not expose identity lookups to anonymous clients.
CREATE TABLE IF NOT EXISTS agent_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(140) NOT NULL,
  company varchar(200) NOT NULL,
  email varchar(200) NOT NULL,
  phone varchar(40) NOT NULL,
  email_key text NOT NULL,
  phone_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_key, phone_key)
);
CREATE INDEX IF NOT EXISTS agent_contacts_phone_idx ON agent_contacts(phone_key);
CREATE INDEX IF NOT EXISTS agent_contacts_email_idx ON agent_contacts(email_key);

ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS visitor_name varchar(140);
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS visitor_company varchar(200);
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS visitor_email varchar(200);
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS visitor_phone varchar(40);
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS identity_at timestamptz;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS identity_source varchar(24);
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS identity_ref text;

-- Potential matches are held for manual review, never auto-merged into a CRM contact.
CREATE TABLE IF NOT EXISTS agent_identity_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL UNIQUE REFERENCES agent_sessions(id) ON DELETE CASCADE,
  name varchar(140) NOT NULL,
  company varchar(200) NOT NULL,
  email varchar(200) NOT NULL,
  phone varchar(40) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE agent_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_identity_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON agent_contacts, agent_identity_reviews FROM anon;
    REVOKE ALL ON SEQUENCE agent_identity_reviews_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON agent_contacts, agent_identity_reviews FROM authenticated;
    REVOKE ALL ON SEQUENCE agent_identity_reviews_id_seq FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON agent_contacts, agent_identity_reviews TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE agent_identity_reviews_id_seq TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION agent_normalize_email(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text := lower(btrim(coalesce(p,'')));
DECLARE v_local text;
DECLARE v_domain text;
BEGIN
  v := regexp_replace(v, '^mailto:', '');
  v_local := split_part(v, '@', 1);
  v_domain := split_part(v, '@', 2);
  IF v_domain IN ('gmail.com','googlemail.com') THEN
    RETURN replace(split_part(v_local, '+', 1), '.', '') || '@gmail.com';
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION agent_normalize_phone(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text := regexp_replace(coalesce(p,''), '[^0-9]', '', 'g');
BEGIN
  IF left(v, 3) = '620' AND length(v) BETWEEN 11 AND 16 THEN RETURN '62' || substr(v, 4); END IF;
  IF left(v, 2) = '08' AND length(v) BETWEEN 10 AND 14 THEN RETURN '62' || substr(v, 2); END IF;
  IF left(v, 1) = '8' AND length(v) BETWEEN 9 AND 13 THEN RETURN '62' || v; END IF;
  RETURN v;
END $$;

-- Common single-character errors (substitution, insertion, deletion, adjacent transpose).
CREATE OR REPLACE FUNCTION agent_one_typo(a text, b text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE i integer := 1; j integer := 1; mistakes integer := 0;
DECLARE la integer := length(a); lb integer := length(b);
BEGIN
  IF a = b OR abs(la - lb) > 1 OR least(la,lb) < 3 THEN RETURN false; END IF;
  WHILE i <= la AND j <= lb LOOP
    IF substr(a,i,1) = substr(b,j,1) THEN i := i+1; j := j+1; CONTINUE; END IF;
    mistakes := mistakes+1;
    IF mistakes > 1 THEN RETURN false; END IF;
    IF la=lb AND i<la AND j<lb AND substr(a,i,1)=substr(b,j+1,1) AND substr(a,i+1,1)=substr(b,j,1) THEN
      i := i+2; j := j+2;
    ELSIF la>lb THEN i := i+1;
    ELSIF lb>la THEN j := j+1;
    ELSE i := i+1; j := j+1;
    END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION agent_email_near(a text, b text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN a = b OR a = '' OR b = '' THEN false
    WHEN split_part(a,'@',2) = split_part(b,'@',2)
      THEN agent_one_typo(split_part(a,'@',1),split_part(b,'@',1))
    WHEN split_part(a,'@',1) = split_part(b,'@',1)
      THEN agent_one_typo(split_part(a,'@',2),split_part(b,'@',2))
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION agent_register_identity(
 p_session uuid, p_name text, p_company text, p_email text, p_phone text,
 p_email_key text, p_phone_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_source text := '';
DECLARE v_ref text := '';
DECLARE v_name text := lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'));
DECLARE v_possible boolean := false;
DECLARE v_contact uuid;
DECLARE v_id integer;
BEGIN
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 140 OR
     length(btrim(coalesce(p_company,''))) NOT BETWEEN 2 AND 200 OR
     length(coalesce(p_email,'')) NOT BETWEEN 5 AND 200 OR
     length(coalesce(p_phone,'')) NOT BETWEEN 7 AND 40 OR
     p_email_key <> agent_normalize_email(p_email) OR
     p_phone_key <> agent_normalize_phone(p_phone) OR
     p_email_key !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR
     p_phone_key !~ '^[0-9]{7,15}$'
  THEN RAISE EXCEPTION 'Invalid registration data' USING ERRCODE = '22023'; END IF;

  -- Lock the session so concurrent registration requests cannot compete.
  PERFORM 1 FROM agent_sessions WHERE id = p_session AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session expired' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM agent_sessions WHERE id=p_session AND identity_at IS NOT NULL) THEN RETURN 'registered'; END IF;

  -- Exact BOTH email and phone only. Phone-only/company mailbox matches may belong to a different person.
  SELECT id INTO v_id FROM customers
    WHERE (agent_normalize_email(pic_email)=p_email_key AND agent_normalize_phone(pic_phone)=p_phone_key)
       OR (agent_normalize_email(email)=p_email_key AND agent_normalize_phone(phone)=p_phone_key)
    ORDER BY id DESC LIMIT 1;
  IF v_id IS NOT NULL THEN v_source:='customer'; v_ref:=v_id::text; END IF;

  IF v_source='' THEN
    SELECT id INTO v_id FROM leads
      WHERE agent_normalize_email(email)=p_email_key AND agent_normalize_phone(phone)=p_phone_key
      ORDER BY id DESC LIMIT 1;
    IF v_id IS NOT NULL THEN v_source:='lead'; v_ref:=v_id::text; END IF;
  END IF;

  IF v_source='' THEN
    SELECT id INTO v_contact FROM agent_contacts
      WHERE email_key=p_email_key AND phone_key=p_phone_key LIMIT 1;
    IF v_contact IS NOT NULL THEN v_source:='contact'; v_ref:=v_contact::text; END IF;
  END IF;

  IF v_source='' THEN
    SELECT EXISTS (
      SELECT 1 FROM agent_contacts c
       WHERE c.phone_key=p_phone_key OR c.email_key=p_email_key OR
          (lower(btrim(c.name))=v_name AND agent_email_near(c.email_key,p_email_key))
      UNION ALL
      SELECT 1 FROM leads l
       WHERE agent_normalize_phone(l.phone)=p_phone_key OR agent_normalize_email(l.email)=p_email_key OR
          (lower(btrim(l.name))=v_name AND agent_email_near(agent_normalize_email(l.email),p_email_key))
      UNION ALL
      SELECT 1 FROM customers c
       WHERE agent_normalize_phone(c.pic_phone)=p_phone_key OR agent_normalize_phone(c.phone)=p_phone_key OR
          agent_normalize_email(c.pic_email)=p_email_key OR agent_normalize_email(c.email)=p_email_key OR
          (lower(btrim(c.pic_name))=v_name AND agent_email_near(agent_normalize_email(c.pic_email),p_email_key))
    ) INTO v_possible;

    IF v_possible THEN
      v_source:='review';
      INSERT INTO agent_identity_reviews(session_id,name,company,email,phone,reason)
      VALUES(p_session,btrim(p_name),btrim(p_company),lower(btrim(p_email)),btrim(p_phone),'Partial or possible typo match; do not merge automatically')
      ON CONFLICT (session_id) DO NOTHING;
    ELSE
      INSERT INTO agent_contacts(name,company,email,phone,email_key,phone_key)
      VALUES(btrim(p_name),btrim(p_company),lower(btrim(p_email)),btrim(p_phone),p_email_key,p_phone_key)
      ON CONFLICT (email_key,phone_key) DO UPDATE SET email_key=EXCLUDED.email_key
      RETURNING id INTO v_contact;
      v_source:='contact'; v_ref:=v_contact::text;
    END IF;
  END IF;

  UPDATE agent_sessions SET visitor_name=btrim(p_name), visitor_company=btrim(p_company),
    visitor_email=lower(btrim(p_email)), visitor_phone=btrim(p_phone), identity_at=now(),
    identity_source=v_source, identity_ref=nullif(v_ref,''), last_activity_at=now()
    WHERE id=p_session;
  RETURN v_source;
END $$;

REVOKE ALL ON FUNCTION agent_register_identity(uuid,text,text,text,text,text,text) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON FUNCTION agent_register_identity(uuid,text,text,text,text,text,text) FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON FUNCTION agent_register_identity(uuid,text,text,text,text,text,text) FROM authenticated; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN GRANT EXECUTE ON FUNCTION agent_register_identity(uuid,text,text,text,text,text,text) TO service_role; END IF;
END $$;
