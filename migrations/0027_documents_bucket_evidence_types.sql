-- The private documents bucket must accept the files the application stores in it.
-- Migration 0013 created `vora-documents` with application/pdf as its ONLY allowed type, but proof-of-delivery evidence is stored there too:
-- the receiver's signature (image/png) and the photos of the goods (image/jpeg). Supabase Storage refused those uploads, so no proof of delivery
-- could be recorded ("Private document storage failed"). 0013 never changes a bucket that already exists, so this migration does it.
--
-- What it does, and only this, to the bucket named below:
--   * adds application/pdf, image/png and image/jpeg to its allowed types, keeping every type that is already allowed;
--   * leaves a bucket that has NO type restriction (NULL) alone: it already accepts everything;
--   * keeps the bucket PRIVATE and keeps its file-size limit;
--   * creates the bucket (private) if it is missing.
-- It can be run again at any time. If the server uses another bucket name (environment variable SUPABASE_DOCUMENTS_BUCKET), change the name in
-- the first line below to that bucket's id before running it.
DO $$
DECLARE
  v_bucket constant text := 'vora-documents';
  v_needed constant text[] := ARRAY['application/pdf', 'image/png', 'image/jpeg'];
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema not present: in the Supabase dashboard (Storage) make bucket % private and allow %', v_bucket, array_to_string(v_needed, ', ');
    RETURN;
  END IF;
  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (v_bucket, v_bucket, FALSE, 10485760, v_needed)
      ON CONFLICT (id) DO NOTHING;
    UPDATE storage.buckets
       SET public = FALSE,
           allowed_mime_types = (SELECT array_agg(DISTINCT t ORDER BY t) FROM unnest(allowed_mime_types || v_needed) AS t)
     WHERE id = v_bucket AND allowed_mime_types IS NOT NULL;
    UPDATE storage.buckets SET public = FALSE WHERE id = v_bucket;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'this Supabase storage schema has no per-bucket type list: allow % for bucket % in the dashboard', array_to_string(v_needed, ', '), v_bucket;
  END;
END $$;
