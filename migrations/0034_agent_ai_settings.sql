-- VORA Virtual Agent: provider/model switcher and private API credentials.
-- API keys remain encrypted inside Supabase Vault; they are never stored in app tables.
CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE TABLE IF NOT EXISTS agent_ai_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini','openai')),
  model varchar(120) NOT NULL DEFAULT 'gemini-3.5-flash-lite',
  enabled boolean NOT NULL DEFAULT false,
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO agent_ai_config(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS agent_ai_credentials (
  provider text PRIMARY KEY CHECK (provider IN ('gemini','openai')),
  vault_secret_id uuid NOT NULL UNIQUE,
  key_hint varchar(12) NOT NULL DEFAULT '',
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE agent_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_ai_credentials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON agent_ai_config,agent_ai_credentials FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON agent_ai_config,agent_ai_credentials FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON agent_ai_config,agent_ai_credentials TO service_role;
  END IF;
END $$;

-- Restricted to the app server's service-role connection. Do not expose these to anon/authenticated.
CREATE OR REPLACE FUNCTION agent_ai_set_key(p_provider text,p_key text,p_actor bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_provider NOT IN ('gemini','openai') THEN RAISE EXCEPTION 'Invalid provider' USING ERRCODE='22023'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 15 AND 400 OR p_key ~ '[[:space:][:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid API key' USING ERRCODE='22023';
  END IF;
  SELECT vault_secret_id INTO v_id FROM public.agent_ai_credentials WHERE provider=p_provider FOR UPDATE;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_key,'vora_agent_'||p_provider,'VORA Virtual Agent provider credential');
    INSERT INTO public.agent_ai_credentials(provider,vault_secret_id,key_hint,updated_by)
    VALUES(p_provider,v_id,right(p_key,4),p_actor);
  ELSE
    PERFORM vault.update_secret(v_id,p_key);
    UPDATE public.agent_ai_credentials SET key_hint=right(p_key,4),updated_by=p_actor,updated_at=now() WHERE provider=p_provider;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION agent_ai_remove_key(p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_provider NOT IN ('gemini','openai') THEN RAISE EXCEPTION 'Invalid provider' USING ERRCODE='22023'; END IF;
  SELECT vault_secret_id INTO v_id FROM public.agent_ai_credentials WHERE provider=p_provider FOR UPDATE;
  IF v_id IS NOT NULL THEN
    DELETE FROM public.agent_ai_credentials WHERE provider=p_provider;
    DELETE FROM vault.secrets WHERE id=v_id;
    UPDATE public.agent_ai_config SET enabled=false,updated_at=now() WHERE id=1 AND provider=p_provider;
  END IF;
END $$;

-- The plaintext key exists only in the service-role RPC return to server-side code.
CREATE OR REPLACE FUNCTION agent_ai_get_key(p_provider text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,vault,pg_temp AS $$
  SELECT v.decrypted_secret
  FROM public.agent_ai_credentials c JOIN vault.decrypted_secrets v ON v.id=c.vault_secret_id
  WHERE c.provider=p_provider AND p_provider IN ('gemini','openai') LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION agent_ai_active()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,vault,pg_temp AS $$
  SELECT jsonb_build_object('provider',c.provider,'model',c.model,'api_key',v.decrypted_secret)
  FROM public.agent_ai_config c
  JOIN public.agent_ai_credentials k ON k.provider=c.provider
  JOIN vault.decrypted_secrets v ON v.id=k.vault_secret_id
  WHERE c.id=1 AND c.enabled=true AND length(v.decrypted_secret)>0 LIMIT 1;
$$;

REVOKE ALL ON FUNCTION agent_ai_set_key(text,text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_ai_remove_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_ai_get_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_ai_active() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON FUNCTION agent_ai_set_key(text,text,bigint) FROM anon;
    REVOKE ALL ON FUNCTION agent_ai_remove_key(text) FROM anon;
    REVOKE ALL ON FUNCTION agent_ai_get_key(text) FROM anon;
    REVOKE ALL ON FUNCTION agent_ai_active() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON FUNCTION agent_ai_set_key(text,text,bigint) FROM authenticated;
    REVOKE ALL ON FUNCTION agent_ai_remove_key(text) FROM authenticated;
    REVOKE ALL ON FUNCTION agent_ai_get_key(text) FROM authenticated;
    REVOKE ALL ON FUNCTION agent_ai_active() FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION agent_ai_set_key(text,text,bigint) TO service_role;
    GRANT EXECUTE ON FUNCTION agent_ai_remove_key(text) TO service_role;
    GRANT EXECUTE ON FUNCTION agent_ai_get_key(text) TO service_role;
    GRANT EXECUTE ON FUNCTION agent_ai_active() TO service_role;
  END IF;
END $$;

-- Seed articles are marked so re-running a seed never overrides admin edits.
ALTER TABLE agent_knowledge ADD COLUMN IF NOT EXISTS seed_key varchar(120);
CREATE UNIQUE INDEX IF NOT EXISTS agent_knowledge_seed_key_idx ON agent_knowledge(seed_key) WHERE seed_key IS NOT NULL;
