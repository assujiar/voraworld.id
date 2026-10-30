-- Sign-in moves to Supabase Auth. Passwords, sessions, password reset and rate limits are Supabase's; this database keeps only WHO MAY USE THE PORTAL.
--
--   public.users stays the membership table (id, email, role, active) so every audit trail and "confirmed by / issued by" column that points
--   at users(id) keeps working. It gains `auth_user_id`, the link to auth.users. A person can sign in only when a Supabase Auth account exists AND
--   a row here links to it with role = 'admin' and active = true. The role is never read from Supabase user metadata (users can edit their own),
--   and there is no sign-up path in the application: a person who merely registers in Supabase Auth has no row here and no access.
--   public.users is not reachable through the Data API (RLS on, no policies, no grants to anon/authenticated).
--
-- First administrator, from the Supabase Dashboard:  Authentication > Users > Add user (email + password, tick "Auto Confirm User"), then in the
-- SQL Editor:   select public.promote_admin('you@company.com');
--
-- The link of a quotation-approval address used to be derived from SESSION_SECRET. With no application secret in the environment any more it
-- is derived from a random value generated here, once per database (table app_secrets; also locked from the Data API).
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_auth_user_id ON users (auth_user_id) WHERE auth_user_id IS NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;     -- passwords now live in Supabase Auth; old hashes of earlier accounts stay only as history

CREATE TABLE IF NOT EXISTS app_secrets (
  key        VARCHAR(60) PRIMARY KEY,
  value      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO app_secrets (key, value)
  VALUES ('approval_link', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  ON CONFLICT (key) DO NOTHING;
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- Grants an existing Supabase Auth account access to the portal. Run it in the SQL Editor (it runs as the project owner).
-- SECURITY DEFINER with a fixed search_path; not executable by anon or authenticated, so it cannot be called through the Data API.
CREATE OR REPLACE FUNCTION public.promote_admin(p_email text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $fn$
DECLARE
  v_email text := lower(btrim(p_email));
  v_uid   uuid;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'An email address is required'; END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email AND deleted_at IS NULL;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth account with the email %. Create it first in Authentication > Users.', v_email;
  END IF;
  INSERT INTO public.users (email, auth_user_id, role, active) VALUES (v_email, v_uid, 'admin', TRUE)
    ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, role = 'admin', active = TRUE;
  INSERT INTO public.audit_logs (actor_id, verb, object_type, object_id, summary)
    SELECT NULL, 'promote-admin', 'user', u.id, v_email FROM public.users u WHERE u.email = v_email;
  RETURN 'Admin access granted to ' || v_email;
END
$fn$;

-- Takes the access away at once (the account is refused on its next request); the Supabase Auth account itself is untouched.
CREATE OR REPLACE FUNCTION public.deactivate_admin(p_email text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_email text := lower(btrim(p_email));
  v_id    integer;
BEGIN
  UPDATE public.users SET active = FALSE WHERE email = v_email RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'No portal account with the email %', v_email; END IF;
  INSERT INTO public.audit_logs (actor_id, verb, object_type, object_id, summary) VALUES (NULL, 'deactivate-admin', 'user', v_id, v_email);
  RETURN 'Access removed for ' || v_email;
END
$fn$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.promote_admin(text), public.deactivate_admin(text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.promote_admin(text), public.deactivate_admin(text) FROM anon;
    REVOKE ALL ON TABLE app_secrets FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.promote_admin(text), public.deactivate_admin(text) FROM authenticated;
    REVOKE ALL ON TABLE app_secrets FROM authenticated;
  END IF;
END $$;
