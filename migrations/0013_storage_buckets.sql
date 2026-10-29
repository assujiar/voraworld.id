-- Supabase Storage buckets used by the application. Safe to run on plain PostgreSQL: it does nothing when the
-- Supabase `storage` schema is absent, and it never changes a bucket that already exists.
--   vora-media      PUBLIC  read: website illustrations and article images uploaded in the admin portal.
--   vora-documents  PRIVATE     : manually stamped receipts and customer-signed quotation approvals.
-- The application reaches both buckets with the server-side service-role key (which bypasses storage RLS), so
-- no storage.objects policies are created: anonymous and authenticated API clients get no write access at all.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema not present; create buckets vora-media (public) and vora-documents (private) manually';
    RETURN;
  END IF;
  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('vora-media', 'vora-media', TRUE, 7000000, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
           ('vora-documents', 'vora-documents', FALSE, 10485760, ARRAY['application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN undefined_column THEN
    -- Older Supabase storage schema without per-bucket limits.
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('vora-media', 'vora-media', TRUE), ('vora-documents', 'vora-documents', FALSE)
    ON CONFLICT (id) DO NOTHING;
  END;
END $$;
