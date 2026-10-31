-- A signer profile can be removed. It is not deleted: what it signed, and the authority and passkeys it held, stay as evidence, and nothing that points at it can be broken.
-- Removing it ends its authority, revokes its passkeys and cancels what was waiting for its signature; the person can later be given a new profile (the old one is reused, with
-- no authority: every grant has to be made again). Additive and safe to run again.
ALTER TABLE signer_profiles DROP CONSTRAINT IF EXISTS signer_profiles_status_check;
ALTER TABLE signer_profiles ADD CONSTRAINT signer_profiles_status_check CHECK (status IN ('pending', 'active', 'suspended', 'removed'));

CREATE OR REPLACE FUNCTION trust_profile_remove(p_actor integer, p_profile integer, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_name text; v_status text;
BEGIN
  SELECT display_name, status INTO v_name, v_status FROM signer_profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signer profile not found' USING ERRCODE = 'VR404'; END IF;
  IF v_status = 'removed' THEN RAISE EXCEPTION 'This signer profile is already removed' USING ERRCODE = 'VR409'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Give a reason of at least 5 characters' USING ERRCODE = 'VR422'; END IF;
  UPDATE signer_authorities SET revoked_at = now(), revoked_by = p_actor, revoke_reason = left('Profile removed: ' || btrim(p_reason), 300) WHERE profile_id = p_profile AND revoked_at IS NULL;
  UPDATE signer_credentials SET revoked_at = now() WHERE profile_id = p_profile AND revoked_at IS NULL;
  UPDATE signing_requests SET status = 'cancelled', completed_at = now() WHERE signer_profile_id = p_profile AND status = 'pending';
  UPDATE signer_profiles SET status = 'removed', updated_at = now() WHERE id = p_profile;
  PERFORM vr_audit(p_actor, 'remove', 'signer_profile', p_profile, v_name || ': ' || btrim(p_reason));
END
$fn$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'trust_profile_remove' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
