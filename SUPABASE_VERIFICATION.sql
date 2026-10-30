-- ============================================================================
-- VORA: post-setup verification. READ-ONLY: it changes nothing.
-- Run in Supabase Dashboard -> SQL Editor after SUPABASE_MANUAL_SETUP.sql (or after `npm run db:migrate -- --apply`).
-- It returns one row per check. Every row must say PASS (INFO rows are informational, WARN needs a look).
-- Any FAIL means the database is not safe to point the application at.
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.vora_verify()
RETURNS TABLE (check_name text, status text, detail text) LANGUAGE plpgsql AS $fn$
DECLARE
  expected_tables text[] := ARRAY['app_secrets','articles','audit_logs','bank_accounts','counters','coverage','customers','deliveries','delivery_items','delivery_proof_photos','delivery_proofs','document_seals',
    'document_verification_tokens','documents','email_job_attachments','email_jobs','email_rules','email_templates','faqs','invoice_bank_instructions','invoice_delivery_notes','invoice_items',
    'invoices','lead_activities','leads','login_attempts','mail_config','media','navigation_items','pages','payments','prepayment_receipts',
    'quotation_approvals','quotation_items','quotations','receipts','revisions','sections','seo_redirects','settings','users'];
  expected_events text[] := ARRAY['lead_admin','lead_customer','lead_reply','invoice_customer','receipt_customer',
    'payment_confirmed','quotation_approval_request','quotation_approved_admin','quotation_customer_approved_admin','quotation_validated_customer','prepayment_receipt_customer','delivery_received_customer','delivery_received_admin'];
  missing text; n bigint; v text;
BEGIN
  -- 1. Schema ---------------------------------------------------------------
  SELECT string_agg(t, ', ') INTO missing FROM unnest(expected_tables) t
    WHERE to_regclass('public.' || t) IS NULL;
  RETURN QUERY SELECT 'tables exist', CASE WHEN missing IS NULL THEN 'PASS' ELSE 'FAIL' END,
    COALESCE('missing: ' || missing, array_length(expected_tables, 1) || ' application tables present');

  SELECT string_agg(c.relname, ', ') INTO missing FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  RETURN QUERY SELECT 'row level security enabled on every public table', CASE WHEN missing IS NULL THEN 'PASS' ELSE 'FAIL' END,
    COALESCE('RLS OFF (Data API exposure!): ' || missing, 'all public tables locked to the server-side connection');

  SELECT count(*) INTO n FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');
  RETURN QUERY SELECT 'anon/authenticated have no table privileges', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END,
    n || ' grant(s) to anon/authenticated on public tables';

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public';
  RETURN QUERY SELECT 'no row level security policies defined', CASE WHEN n = 0 THEN 'PASS' ELSE 'WARN' END,
    n || ' policies (the app uses a server-side role, so none are needed)';

  SELECT string_agg(table_name || '.' || column_name, ', ') INTO missing FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name LIKE '%\_minor' AND data_type <> 'bigint';
  RETURN QUERY SELECT 'money columns are 64-bit', CASE WHEN missing IS NULL THEN 'PASS' ELSE 'FAIL' END,
    COALESCE('not bigint (amounts above IDR 2.1 billion would fail): ' || missing, 'every *_minor column holds amounts above IDR 2.1 billion');

  -- 2. Integrity guards for document identifiers ------------------------------
  FOREACH v IN ARRAY ARRAY['invoices.number','quotations.number','receipts.number','prepayment_receipts.number','documents.number','leads.reference','leads.public_code','customers.public_code'] LOOP
    SELECT count(*) INTO n FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (i.indkey)
      WHERE i.indisunique AND i.indnatts = 1 AND t.relname = split_part(v, '.', 1) AND a.attname = split_part(v, '.', 2);
    RETURN QUERY SELECT 'unique constraint ' || v, CASE WHEN n > 0 THEN 'PASS' ELSE 'FAIL' END, n || ' unique index(es)';
  END LOOP;

  -- 3. Migration history ------------------------------------------------------
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RETURN QUERY SELECT 'migration history', 'WARN', 'schema_migrations table absent (fine if you ran the SQL files by hand)';
  ELSE
    EXECUTE 'SELECT count(*), max(name) FROM schema_migrations' INTO n, v;
    RETURN QUERY SELECT 'migration history', CASE WHEN n >= 26 THEN 'PASS' ELSE 'FAIL' END, n || ' migrations recorded (26 expected), latest ' || COALESCE(v, 'none');
  END IF;

  -- 4. Seed data the application depends on ------------------------------------
  RETURN QUERY SELECT 'approved public email', CASE WHEN EXISTS (SELECT 1 FROM settings WHERE key = 'email' AND btrim(value) <> '') THEN 'PASS' ELSE 'FAIL' END,
    COALESCE((SELECT value FROM settings WHERE key = 'email'), 'not set');
  RETURN QUERY SELECT 'approved public address', CASE WHEN EXISTS (SELECT 1 FROM settings WHERE key = 'address' AND btrim(value) <> '') THEN 'PASS' ELSE 'FAIL' END,
    COALESCE((SELECT value FROM settings WHERE key = 'address'), 'not set');
  RETURN QUERY SELECT 'no telephone/WhatsApp setting published', CASE WHEN NOT EXISTS (SELECT 1 FROM settings WHERE key IN ('phone','whatsapp') AND btrim(value) <> '') THEN 'PASS' ELSE 'WARN' END,
    'public contact is email + address only';

  SELECT string_agg(e, ', ') INTO missing FROM unnest(expected_events) e WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE key = e);
  RETURN QUERY SELECT 'email templates seeded', CASE WHEN missing IS NULL THEN 'PASS' ELSE 'FAIL' END, COALESCE('missing: ' || missing, '13 of 13 events');
  SELECT string_agg(e, ', ') INTO missing FROM unnest(expected_events) e WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE key = e);
  RETURN QUERY SELECT 'email rules seeded', CASE WHEN missing IS NULL THEN 'PASS' ELSE 'FAIL' END, COALESCE('missing: ' || missing, '13 of 13 events (all start disabled until enabled in /admin/mail)');

  -- 5. Storage ---------------------------------------------------------------------
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN QUERY SELECT 'storage buckets', 'WARN', 'storage schema not found (not a Supabase database?)';
  ELSE
    EXECUTE $q$SELECT count(*) FROM storage.buckets WHERE id = 'vora-media' AND public$q$ INTO n;
    RETURN QUERY SELECT 'bucket vora-media exists and is public', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n || ' match';
    EXECUTE $q$SELECT count(*) FROM storage.buckets WHERE id = 'vora-documents' AND NOT public$q$ INTO n;
    RETURN QUERY SELECT 'bucket vora-documents exists and is PRIVATE', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n || ' match';
  END IF;

  -- 5b. The database functions the application calls -----------------------------------
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname IN ('invoice_create', 'payment_confirm', 'receipt_void', 'quotation_create', 'document_create', 'lead_create', 'article_save', 'page_save', 'vr_next_number', 'mail_claim', 'delivery_submit_proof', 'lead_convert', 'mail_enqueue');
  RETURN QUERY SELECT 'database functions installed', CASE WHEN n = 13 THEN 'PASS' ELSE 'FAIL' END, n || ' of 13 key functions found (apply migrations 0024, 0025 and 0026)';
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND (p.proname LIKE 'vr\_%' OR p.proname ~ '^(customer|bank|invoice|prepayment|payment|receipt|quotation|approval|mail|lead|article|page|section|document|delivery)_')
      AND (has_function_privilege('public', p.oid, 'execute') OR has_function_privilege('anon', p.oid, 'execute') OR has_function_privilege('authenticated', p.oid, 'execute'));
  RETURN QUERY SELECT 'functions closed to public, anon and signed-in users', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n || ' function(s) executable by a public role';
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND (p.prosecdef OR NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%'))
      AND (p.proname LIKE 'vr\_%' OR p.proname ~ '^(customer|bank|invoice|prepayment|payment|receipt|quotation|approval|mail|lead|article|page|section|document|delivery)_');
  RETURN QUERY SELECT 'functions: invoker rights and a pinned search_path', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n || ' function(s) are SECURITY DEFINER or lack a fixed search_path';

  -- 6. State (informational) --------------------------------------------------------
  SELECT count(*) INTO n FROM users WHERE role = 'admin' AND active AND auth_user_id IS NOT NULL;
  RETURN QUERY SELECT 'active admin accounts (able to sign in)', CASE WHEN n > 0 THEN 'PASS' ELSE 'INFO' END,
    CASE WHEN n > 0 THEN n || ' active admin account(s)' ELSE '0: add the user in Authentication > Users, then run: select public.promote_admin(''their@email'');' END;
  SELECT count(*) INTO n FROM users WHERE role = 'admin' AND active AND auth_user_id IS NULL;
  RETURN QUERY SELECT 'every admin is linked to a Supabase Auth account', CASE WHEN n = 0 THEN 'PASS' ELSE 'WARN' END,
    n || ' admin row(s) without an Auth account cannot sign in (re-run promote_admin for them)';
  SELECT count(*) INTO n FROM users WHERE role <> 'admin';
  RETURN QUERY SELECT 'every account holds the admin role', CASE WHEN n = 0 THEN 'PASS' ELSE 'WARN' END,
    n || ' account(s) with another role have NO access to the portal (the portal has one role: admin)';
  SELECT count(*) INTO n FROM users WHERE email ~* '(example|invalid|demo)';
  RETURN QUERY SELECT 'no demo/test accounts', CASE WHEN n = 0 THEN 'PASS' ELSE 'WARN' END, n || ' suspicious account(s)';
  RETURN QUERY SELECT 'data volume', 'INFO',
    (SELECT count(*) FROM customers) || ' customers, ' || (SELECT count(*) FROM invoices) || ' invoices, ' ||
    (SELECT count(*) FROM payments) || ' payments, ' || (SELECT count(*) FROM receipts) || ' receipts';
  RETURN QUERY SELECT 'server', 'INFO', split_part(version(), ' on ', 1) || ', timezone ' || current_setting('TimeZone');
END
$fn$;

SELECT * FROM pg_temp.vora_verify();
