-- VORA Agent: private chat history and durable request quotas. No anon/authenticated table access.
-- The public API reaches these tables with the existing server-side Supabase secret key.
CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'id')),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
CREATE INDEX IF NOT EXISTS agent_sessions_expiration_idx ON agent_sessions (expires_at);

CREATE TABLE IF NOT EXISTS agent_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_messages_session_idx ON agent_messages (session_id, id DESC);

CREATE TABLE IF NOT EXISTS agent_rate_counters (
  key_hash text NOT NULL CHECK (length(key_hash) = 64),
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (key_hash, window_start)
);
CREATE INDEX IF NOT EXISTS agent_rate_counters_window_idx ON agent_rate_counters (window_start);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rate_counters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON agent_sessions, agent_messages, agent_rate_counters FROM anon;
    REVOKE ALL ON SEQUENCE agent_messages_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON agent_sessions, agent_messages, agent_rate_counters FROM authenticated;
    REVOKE ALL ON SEQUENCE agent_messages_id_seq FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON agent_sessions, agent_messages, agent_rate_counters TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE agent_messages_id_seq TO service_role;
  END IF;
END $$;

-- Atomic consumption protects against simultaneous requests on different serverless instances.
-- A rejected request cannot increment beyond the cap, and does not consume model tokens.
CREATE OR REPLACE FUNCTION agent_consume_quota(p_key text, p_window_seconds integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_window timestamptz;
DECLARE v_count integer;
BEGIN
  IF p_key !~ '^[0-9a-f]{64}$' OR p_window_seconds NOT IN (600, 86400) OR p_max < 1 OR p_max > 100 THEN
    RAISE EXCEPTION 'Invalid agent quota' USING ERRCODE = '22023';
  END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO agent_rate_counters (key_hash, window_start, count)
    VALUES (p_key, v_window, 1)
    ON CONFLICT (key_hash, window_start) DO UPDATE
      SET count = agent_rate_counters.count + 1
      WHERE agent_rate_counters.count < p_max
    RETURNING count INTO v_count;
  RETURN v_count IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION agent_consume_quota(text, integer, integer) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON FUNCTION agent_consume_quota(text, integer, integer) FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON FUNCTION agent_consume_quota(text, integer, integer) FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN GRANT EXECUTE ON FUNCTION agent_consume_quota(text, integer, integer) TO service_role; END IF;
END $$;

-- Remove expired conversations after seven days and stale counters. Invoked opportunistically
-- by the agent backend, at most once per hour across all serverless instances.
CREATE TABLE IF NOT EXISTS agent_housekeeping (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_run_at timestamptz NOT NULL DEFAULT (now() - interval '2 hours')
);
INSERT INTO agent_housekeeping (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE agent_housekeeping ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON agent_housekeeping FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON agent_housekeeping FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN GRANT SELECT, INSERT, UPDATE, DELETE ON agent_housekeeping TO service_role; END IF;
END $$;
CREATE OR REPLACE FUNCTION agent_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_run boolean;
BEGIN
  UPDATE agent_housekeeping SET last_run_at = now()
   WHERE id = true AND last_run_at < now() - interval '1 hour'
   RETURNING true INTO v_run;
  IF v_run IS TRUE THEN
    DELETE FROM agent_sessions WHERE expires_at < now();
    DELETE FROM agent_rate_counters WHERE window_start < now() - interval '2 days';
  END IF;
END $$;
REVOKE ALL ON FUNCTION agent_cleanup() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON FUNCTION agent_cleanup() FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON FUNCTION agent_cleanup() FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN GRANT EXECUTE ON FUNCTION agent_cleanup() TO service_role; END IF;
END $$;
