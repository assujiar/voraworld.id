-- Failed/successful admin sign-in attempts, used for server-side brute-force throttling.
-- Run AFTER 0011. RLS is enabled with no policies so the Supabase Data API cannot read it.
CREATE TABLE IF NOT EXISTS login_attempts (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(200) NOT NULL,
  ip          VARCHAR(64)  NOT NULL DEFAULT '',
  succeeded   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_login_attempts_email      ON login_attempts (email);
CREATE INDEX IF NOT EXISTS ix_login_attempts_ip         ON login_attempts (ip);
CREATE INDEX IF NOT EXISTS ix_login_attempts_created_at ON login_attempts (created_at);
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE login_attempts FROM anon;
    REVOKE ALL ON SEQUENCE login_attempts_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE login_attempts FROM authenticated;
    REVOKE ALL ON SEQUENCE login_attempts_id_seq FROM authenticated;
  END IF;
END $$;
