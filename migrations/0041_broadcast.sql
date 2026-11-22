-- VORA marketing email: separate queue from transactional mail, opted-in contacts only.
-- No automatic migration of leads/customers and no automatic activation of a scheduler.
CREATE TABLE public.broadcast_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  max_per_hour integer NOT NULL DEFAULT 30 CHECK (max_per_hour BETWEEN 1 AND 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.broadcast_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.broadcast_contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name text NOT NULL DEFAULT '',
  pic_name text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(btrim(email))),
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  business_category text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT '',
  consent_status text NOT NULL DEFAULT 'unverified' CHECK (consent_status IN ('unverified', 'subscribed', 'unsubscribed')),
  consent_evidence text NOT NULL DEFAULT '',
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_contacts_email_unique UNIQUE (email),
  CONSTRAINT broadcast_contacts_consent_proof CHECK (consent_status <> 'subscribed' OR (length(btrim(consent_evidence)) >= 8 AND consent_at IS NOT NULL))
);
CREATE INDEX broadcast_contacts_status_idx ON public.broadcast_contacts (consent_status);
CREATE INDEX broadcast_contacts_tags_idx ON public.broadcast_contacts USING gin(tags);

CREATE TABLE public.broadcast_campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  audience_tag text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','running','paused','completed','cancelled')),
  scheduled_at timestamptz,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  launched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX broadcast_campaigns_status_idx ON public.broadcast_campaigns (status, scheduled_at);

CREATE TABLE public.broadcast_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id bigint NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id bigint NOT NULL REFERENCES public.broadcast_contacts(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','retry','sent','failed','skipped','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  active_attempt_id bigint,
  sent_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_deliveries_unique UNIQUE (campaign_id, contact_id)
);
CREATE INDEX broadcast_deliveries_queue_idx ON public.broadcast_deliveries (next_attempt_at,id) WHERE status IN ('queued','retry');
CREATE INDEX broadcast_deliveries_contact_idx ON public.broadcast_deliveries (contact_id,status);

CREATE TABLE public.broadcast_send_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_id bigint NOT NULL REFERENCES public.broadcast_deliveries(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'reserved' CHECK (outcome IN ('reserved','sent','failed','unknown')),
  error text NOT NULL DEFAULT ''
);
CREATE INDEX broadcast_attempts_window_idx ON public.broadcast_send_attempts (attempted_at DESC);
ALTER TABLE public.broadcast_deliveries ADD CONSTRAINT broadcast_active_attempt_fk FOREIGN KEY (active_attempt_id) REFERENCES public.broadcast_send_attempts(id) ON DELETE SET NULL;

-- Protect ALL new tables from the browser's anon/authenticated Supabase API keys.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['broadcast_settings','broadcast_contacts','broadcast_campaigns','broadcast_deliveries','broadcast_send_attempts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t); END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t); END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t); END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['broadcast_contacts_id_seq','broadcast_campaigns_id_seq','broadcast_deliveries_id_seq','broadcast_send_attempts_id_seq'] LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC',t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon',t); END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM authenticated',t); END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO service_role',t); END IF;
  END LOOP;
END $$;

-- Saving consent and unsubscribing also suppresses every not-yet-sent delivery.
-- An unsubscribe is irreversible through public links: admin re-subscription requires fresh recorded evidence.
CREATE FUNCTION public.broadcast_contact_save(p jsonb) RETURNS bigint
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v_id bigint := nullif(p->>'id','')::bigint; v_email text := lower(btrim(p->>'email')); v_status text := coalesce(p->>'consent_status','unverified'); v_evidence text := btrim(coalesce(p->>'consent_evidence','')); v_row public.broadcast_contacts%ROWTYPE;
BEGIN
  IF v_email IS NULL OR length(v_email)>254 OR v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' THEN PERFORM public.vr_fail(422,'Invalid email'); END IF;
  IF v_status NOT IN ('unverified','subscribed','unsubscribed') THEN PERFORM public.vr_fail(422,'Invalid consent status'); END IF;
  IF v_status='subscribed' AND length(v_evidence)<8 THEN PERFORM public.vr_fail(422,'Record the consent source and evidence (at least 8 characters)'); END IF;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.broadcast_contacts WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM public.vr_fail(404,'Contact not found'); END IF;
    IF v_row.consent_status='unsubscribed' AND v_status='subscribed' AND v_evidence=v_row.consent_evidence THEN
      PERFORM public.vr_fail(422,'Fresh consent evidence is required after unsubscribe');
    END IF;
    UPDATE public.broadcast_contacts SET
      company_name=left(coalesce(p->>'company_name',''),240), pic_name=left(coalesce(p->>'pic_name',''),160),
      position=left(coalesce(p->>'position',''),160), email=v_email, phone=left(coalesce(p->>'phone',''),100),
      country=left(coalesce(p->>'country',''),100),business_category=left(coalesce(p->>'business_category',''),160),
      tags=coalesce(ARRAY(SELECT DISTINCT lower(btrim(tag_value)) FROM jsonb_array_elements_text(coalesce(p->'tags','[]'::jsonb)) AS t(tag_value) WHERE btrim(tag_value)<>'' LIMIT 30),'{}'),
      source=left(coalesce(p->>'source',''),240), consent_status=v_status,
      consent_evidence=CASE WHEN v_status='subscribed' THEN v_evidence ELSE coalesce(p->>'consent_evidence','') END,
      consent_at=CASE WHEN v_status='subscribed' THEN CASE WHEN v_row.consent_status='subscribed' AND v_row.consent_evidence=v_evidence THEN v_row.consent_at ELSE now() END ELSE NULL END,
      unsubscribed_at=CASE WHEN v_status='unsubscribed' THEN coalesce(v_row.unsubscribed_at,now()) ELSE NULL END,
      updated_at=now() WHERE id=v_id;
    IF v_status<>'subscribed' OR v_email<>v_row.email THEN
      UPDATE public.broadcast_deliveries SET status='skipped',last_error='Contact unsubscribed, unverified or email changed'
      WHERE contact_id=v_id AND status IN ('queued','retry');
    END IF;
  ELSE
    INSERT INTO public.broadcast_contacts (company_name,pic_name,position,email,phone,country,business_category,tags,source,consent_status,consent_evidence,consent_at,unsubscribed_at)
    VALUES (left(coalesce(p->>'company_name',''),240),left(coalesce(p->>'pic_name',''),160),left(coalesce(p->>'position',''),160),v_email,
      left(coalesce(p->>'phone',''),100),left(coalesce(p->>'country',''),100),left(coalesce(p->>'business_category',''),160),
      coalesce(ARRAY(SELECT DISTINCT lower(btrim(tag_value)) FROM jsonb_array_elements_text(coalesce(p->'tags','[]'::jsonb)) AS t(tag_value) WHERE btrim(tag_value)<>'' LIMIT 30),'{}'),
      left(coalesce(p->>'source',''),240),v_status,v_evidence,CASE WHEN v_status='subscribed' THEN now() ELSE NULL END,
      CASE WHEN v_status='unsubscribed' THEN now() ELSE NULL END) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $fn$;

CREATE FUNCTION public.broadcast_unsubscribe(p_token uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v_id bigint;
BEGIN
  SELECT id INTO v_id FROM public.broadcast_contacts WHERE unsubscribe_token=p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.broadcast_contacts SET consent_status='unsubscribed',consent_at=NULL,unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now() WHERE id=v_id;
  UPDATE public.broadcast_deliveries SET status='skipped',last_error='Recipient unsubscribed' WHERE contact_id=v_id AND status IN ('queued','retry');
  RETURN true;
END $fn$;

-- Launch is one atomic snapshot of the currently subscribed audience; it cannot double-enqueue.
CREATE FUNCTION public.broadcast_launch(p_campaign bigint) RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v public.broadcast_campaigns%ROWTYPE; n integer;
BEGIN
  SELECT * INTO v FROM public.broadcast_campaigns WHERE id=p_campaign FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.vr_fail(404,'Campaign not found'); END IF;
  IF v.status<>'draft' THEN PERFORM public.vr_fail(409,'Only a draft can be launched'); END IF;
  IF length(btrim(v.subject))=0 OR length(btrim(v.html))=0 THEN PERFORM public.vr_fail(422,'Subject and HTML are required'); END IF;
  INSERT INTO public.broadcast_deliveries(campaign_id,contact_id,recipient_email)
  SELECT v.id,c.id,c.email FROM public.broadcast_contacts c WHERE c.consent_status='subscribed' AND (v.audience_tag='' OR v.audience_tag=ANY(c.tags));
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=0 THEN PERFORM public.vr_fail(422,'No subscribed contacts match this campaign'); END IF;
  UPDATE public.broadcast_campaigns SET status='queued',launched_at=now(),updated_at=now() WHERE id=v.id;
  RETURN n;
END $fn$;

-- Atomic global rolling 60-minute throttle. Advisory lock serialises concurrent workers.
-- Claim reservations count toward the quota even if SMTP fails. Expired/in-doubt sends are NEVER retried automatically.
CREATE FUNCTION public.broadcast_claim(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v_rate integer; v_allowed integer; v_now timestamptz := clock_timestamp(); v public.broadcast_deliveries%ROWTYPE; v_attempt bigint; v_result jsonb := '[]'::jsonb; v_campaign public.broadcast_campaigns%ROWTYPE; v_contact public.broadcast_contacts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(2147483001, 9001);
  SELECT max_per_hour INTO v_rate FROM public.broadcast_settings WHERE id=1 AND enabled=true FOR UPDATE;
  IF NOT FOUND THEN RETURN v_result; END IF;
  -- If a worker died after SMTP accepted a message, do NOT resend an uncertain delivery.
  UPDATE public.broadcast_send_attempts a SET outcome='unknown',error='Worker timed out; verify SMTP before manual retry'
  FROM public.broadcast_deliveries d WHERE d.active_attempt_id=a.id AND d.status='sending' AND d.claimed_at < v_now - interval '10 minutes' AND a.outcome='reserved';
  UPDATE public.broadcast_deliveries SET status='failed',last_error='Delivery outcome unknown after worker timeout; manual review required', active_attempt_id=NULL
  WHERE status='sending' AND claimed_at < v_now - interval '10 minutes';
  -- Don't leave no-longer-eligible recipients stuck in queue.
  UPDATE public.broadcast_deliveries d SET status='skipped',last_error='Contact no longer eligible'
  FROM public.broadcast_contacts c WHERE d.contact_id=c.id AND d.status IN ('queued','retry') AND (c.consent_status<>'subscribed' OR c.email<>d.recipient_email);
  UPDATE public.broadcast_campaigns ca SET status='completed',completed_at=v_now,updated_at=v_now
  WHERE ca.status IN ('queued','running') AND NOT EXISTS (
    SELECT 1 FROM public.broadcast_deliveries d WHERE d.campaign_id=ca.id AND d.status IN ('queued','retry','sending')
  );
  SELECT greatest(0,v_rate-count(*)::integer) INTO v_allowed FROM public.broadcast_send_attempts WHERE attempted_at>v_now-interval '60 minutes';
  v_allowed := least(v_allowed,greatest(0,least(coalesce(p_limit,10),20)));
  FOR v IN
    SELECT d.* FROM public.broadcast_deliveries d
    JOIN public.broadcast_campaigns ca ON ca.id=d.campaign_id
    JOIN public.broadcast_contacts co ON co.id=d.contact_id
    WHERE d.status IN ('queued','retry') AND d.next_attempt_at<=v_now
      AND ca.status IN ('queued','running') AND (ca.scheduled_at IS NULL OR ca.scheduled_at<=v_now)
      AND co.consent_status='subscribed' AND co.email=d.recipient_email
    ORDER BY d.id LIMIT v_allowed FOR UPDATE OF d SKIP LOCKED
  LOOP
    INSERT INTO public.broadcast_send_attempts(delivery_id,attempted_at) VALUES(v.id,v_now) RETURNING id INTO v_attempt;
    UPDATE public.broadcast_deliveries SET status='sending',claimed_at=v_now,active_attempt_id=v_attempt,attempts=attempts+1 WHERE id=v.id;
    UPDATE public.broadcast_campaigns SET status='running',updated_at=v_now WHERE id=v.campaign_id AND status='queued';
    SELECT * INTO v_campaign FROM public.broadcast_campaigns WHERE id=v.campaign_id;
    SELECT * INTO v_contact FROM public.broadcast_contacts WHERE id=v.contact_id;
    v_result := v_result || jsonb_build_array(jsonb_build_object('id',v.id,'attempt_id',v_attempt,'campaign_id',v.campaign_id,
      'email',v.recipient_email,'contact_id',v.contact_id,'subject',v_campaign.subject,'html',v_campaign.html,
      'company_name',v_contact.company_name,'pic_name',v_contact.pic_name,'position',v_contact.position,
      'unsubscribe_token',v_contact.unsubscribe_token));
  END LOOP;
  RETURN v_result;
END $fn$;

CREATE FUNCTION public.broadcast_finish(p_delivery bigint,p_attempt bigint,p_success boolean,p_error text DEFAULT '') RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v public.broadcast_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.broadcast_deliveries WHERE id=p_delivery FOR UPDATE;
  IF NOT FOUND OR v.status<>'sending' OR v.active_attempt_id IS DISTINCT FROM p_attempt THEN RETURN; END IF;
  UPDATE public.broadcast_send_attempts SET outcome=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,error=left(coalesce(p_error,''),500) WHERE id=p_attempt;
  UPDATE public.broadcast_deliveries SET status=CASE
      WHEN p_success THEN 'sent'
      WHEN EXISTS (SELECT 1 FROM public.broadcast_contacts c WHERE c.id=v.contact_id AND (c.consent_status<>'subscribed' OR c.email<>v.recipient_email)) THEN 'skipped'
      WHEN v.attempts>=4 THEN 'failed' ELSE 'retry' END,
    sent_at=CASE WHEN p_success THEN now() ELSE NULL END,
    next_attempt_at=CASE WHEN p_success THEN next_attempt_at ELSE now()+make_interval(mins => LEAST(60, (power(3,LEAST(v.attempts,4))::integer))) END,
    active_attempt_id=NULL, last_error=CASE WHEN p_success THEN '' ELSE left(coalesce(p_error,'SMTP failed'),500) END WHERE id=v.id;
  IF NOT EXISTS (SELECT 1 FROM public.broadcast_deliveries WHERE campaign_id=v.campaign_id AND status IN ('queued','retry','sending')) THEN
    UPDATE public.broadcast_campaigns SET status='completed',completed_at=now(),updated_at=now()
    WHERE id=v.campaign_id AND status IN ('queued','running');
  END IF;
END $fn$;

CREATE FUNCTION public.broadcast_campaign_control(p_campaign bigint,p_action text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE v public.broadcast_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.broadcast_campaigns WHERE id=p_campaign FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.vr_fail(404,'Campaign not found'); END IF;
  IF p_action='pause' AND v.status IN ('queued','running') THEN
    UPDATE public.broadcast_campaigns SET status='paused',updated_at=now() WHERE id=p_campaign;
  ELSIF p_action='resume' AND v.status='paused' THEN
    UPDATE public.broadcast_campaigns SET status='queued',updated_at=now() WHERE id=p_campaign;
  ELSIF p_action='cancel' AND v.status IN ('queued','running','paused') THEN
    UPDATE public.broadcast_campaigns SET status='cancelled',updated_at=now() WHERE id=p_campaign;
    UPDATE public.broadcast_deliveries SET status='cancelled' WHERE campaign_id=p_campaign AND status IN ('queued','retry');
  ELSE
    PERFORM public.vr_fail(409,'Invalid campaign action for current status');
  END IF;
END $fn$;

-- Callable only by service-role server code, never directly through public/client auth keys.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('broadcast_contact_save','broadcast_unsubscribe','broadcast_launch','broadcast_claim','broadcast_finish','broadcast_campaign_control') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.sig);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon',f.sig); END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated',f.sig); END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig); END IF;
  END LOOP;
END $$;

-- CSV import: skip duplicates, do not overwrite existing subscription decisions; report row counts.
CREATE FUNCTION public.broadcast_import_contacts(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE r jsonb; inserted integer:=0; duplicates integer:=0; rejected integer:=0; err text; examples jsonb:='[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>250 THEN PERFORM public.vr_fail(422,'Invalid import batch (max 250 contacts)'); END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    BEGIN
      IF EXISTS (SELECT 1 FROM public.broadcast_contacts WHERE email=lower(btrim(coalesce(r->>'email','')))) THEN
        duplicates:=duplicates+1;
      ELSE
        PERFORM public.broadcast_contact_save(r);
        inserted:=inserted+1;
      END IF;
    EXCEPTION WHEN unique_violation THEN duplicates:=duplicates+1;
      WHEN OTHERS THEN
        rejected:=rejected+1;
        IF jsonb_array_length(examples)<8 THEN
          GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
          examples:=examples || jsonb_build_array(jsonb_build_object('email',left(coalesce(r->>'email',''),100),'error',left(err,180)));
        END IF;
    END;
  END LOOP;
  RETURN jsonb_build_object('inserted',inserted,'duplicates',duplicates,'rejected',rejected,'errors',examples);
END $fn$;
REVOKE ALL ON FUNCTION public.broadcast_import_contacts(jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON FUNCTION public.broadcast_import_contacts(jsonb) FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON FUNCTION public.broadcast_import_contacts(jsonb) FROM authenticated; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN GRANT EXECUTE ON FUNCTION public.broadcast_import_contacts(jsonb) TO service_role; END IF;
END $$;
