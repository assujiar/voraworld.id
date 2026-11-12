-- VORA Agent conversations are kept for 30 days after the visitor's last activity, so an administrator can read them
-- (Admin > VORA Virtual Agent > Agent Conversations).
-- The visitor's chat token still expires after 7 days (agent_sessions.expires_at is unchanged); only the stored record lives longer.
-- A visitor who deletes the chat from the widget still removes it at once (DELETE /api/agent/chat).
-- The signature, owner and grants of agent_cleanup() are unchanged, so the application keeps calling it as before.
CREATE INDEX IF NOT EXISTS agent_sessions_registered_activity_idx
  ON public.agent_sessions (last_activity_at DESC) WHERE identity_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.agent_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_run boolean;
BEGIN
  UPDATE agent_housekeeping SET last_run_at = now()
   WHERE id = true AND last_run_at < now() - interval '1 hour'
   RETURNING true INTO v_run;
  IF v_run IS TRUE THEN
    DELETE FROM agent_sessions
     WHERE expires_at < now()
       AND last_activity_at < now() - interval '30 days';
    DELETE FROM agent_rate_counters WHERE window_start < now() - interval '2 days';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.agent_cleanup() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON FUNCTION public.agent_cleanup() FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON FUNCTION public.agent_cleanup() FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN GRANT EXECUTE ON FUNCTION public.agent_cleanup() TO service_role; END IF;
END $$;
