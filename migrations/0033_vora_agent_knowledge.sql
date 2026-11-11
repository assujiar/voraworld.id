-- VORA Virtual Agent: admin-managed, versioned and published knowledge.
-- Never grant anonymous or authenticated clients access to editable knowledge or private attachments.
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL DEFAULT 'company' CHECK (category IN ('company','services','operations','incoterms','customs','documentation','faq','other')),
  title_en varchar(200) NOT NULL DEFAULT '',
  title_id varchar(200) NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_id text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  attachment_name varchar(255),
  attachment_key text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_revision integer NOT NULL DEFAULT 0,
  created_by bigint REFERENCES users(id) ON DELETE SET NULL,
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_knowledge_en_length CHECK (length(body_en) <= 80000),
  CONSTRAINT agent_knowledge_id_length CHECK (length(body_id) <= 80000),
  CONSTRAINT agent_knowledge_language_pair CHECK (
    ((length(btrim(title_en)) > 0) = (length(btrim(body_en)) > 0))
    AND ((length(btrim(title_id)) > 0) = (length(btrim(body_id)) > 0))
  )
);
CREATE INDEX IF NOT EXISTS agent_knowledge_status_idx ON agent_knowledge(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_knowledge_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES agent_knowledge(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  actor_id bigint REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('save','publish','unpublish','archive','restore')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, revision)
);
CREATE INDEX IF NOT EXISTS agent_knowledge_revisions_doc_idx ON agent_knowledge_revisions(document_id, revision DESC);

CREATE TABLE IF NOT EXISTS agent_knowledge_chunks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES agent_knowledge(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','id')),
  chunk_number integer NOT NULL,
  heading text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  source_url text NOT NULL DEFAULT '',
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(heading,'') || ' ' || coalesce(content,''))) STORED,
  UNIQUE(document_id, locale, chunk_number)
);
CREATE INDEX IF NOT EXISTS agent_knowledge_chunks_search_idx ON agent_knowledge_chunks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS agent_knowledge_chunks_doc_idx ON agent_knowledge_chunks(document_id, locale);

ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_chunks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON agent_knowledge, agent_knowledge_revisions, agent_knowledge_chunks FROM anon;
    REVOKE ALL ON SEQUENCE agent_knowledge_id_seq, agent_knowledge_revisions_id_seq, agent_knowledge_chunks_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON agent_knowledge, agent_knowledge_revisions, agent_knowledge_chunks FROM authenticated;
    REVOKE ALL ON SEQUENCE agent_knowledge_id_seq, agent_knowledge_revisions_id_seq, agent_knowledge_chunks_id_seq FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON agent_knowledge, agent_knowledge_revisions, agent_knowledge_chunks TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE agent_knowledge_id_seq, agent_knowledge_revisions_id_seq, agent_knowledge_chunks_id_seq TO service_role;
  END IF;
END $$;

-- Publishing is atomic: no public request can ever retrieve half-rebuilt chunks.
-- Locks the document, validates language fields, rebuilds chunks and records a revision.
CREATE OR REPLACE FUNCTION agent_knowledge_publish(p_id bigint, p_actor bigint, p_expected_revision integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d agent_knowledge%ROWTYPE;
DECLARE language text;
DECLARE heading text;
DECLARE body text;
DECLARE n integer;
DECLARE new_revision integer;
BEGIN
  SELECT * INTO d FROM agent_knowledge WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Knowledge article not found' USING ERRCODE='22023'; END IF;
  IF d.revision <> p_expected_revision THEN RAISE EXCEPTION 'Knowledge article changed; refresh before publishing' USING ERRCODE='22023'; END IF;
  IF length(btrim(d.body_en)) < 30 AND length(btrim(d.body_id)) < 30 THEN
    RAISE EXCEPTION 'Enter at least 30 characters of content in one language' USING ERRCODE='22023';
  END IF;
  IF length(btrim(d.body_en)) BETWEEN 1 AND 29 OR length(btrim(d.body_id)) BETWEEN 1 AND 29 THEN
    RAISE EXCEPTION 'Each provided language needs at least 30 characters' USING ERRCODE='22023';
  END IF;
  DELETE FROM agent_knowledge_chunks WHERE document_id=p_id;
  FOR language IN SELECT unnest(ARRAY['en','id']) LOOP
    heading := CASE WHEN language='en' THEN d.title_en ELSE d.title_id END;
    body := CASE WHEN language='en' THEN d.body_en ELSE d.body_id END;
    IF length(btrim(body)) > 0 THEN
      -- Overlapping slices keep paragraph boundaries near chunk edges searchable.
      FOR n IN SELECT generate_series(0, greatest(0, ceil(length(body)::numeric / 1000)::integer - 1)) LOOP
        INSERT INTO agent_knowledge_chunks(document_id,locale,chunk_number,heading,content,category,source_url)
        VALUES(p_id,language,n,heading,substr(body, greatest(1,n*1000 - 129), 1130),d.category,d.source_url);
      END LOOP;
    END IF;
  END LOOP;
  new_revision := d.revision+1;
  UPDATE agent_knowledge SET status='published',revision=new_revision,published_revision=new_revision,updated_at=now(),updated_by=p_actor,published_at=now() WHERE id=p_id;
  INSERT INTO agent_knowledge_revisions(document_id,revision,snapshot,actor_id,action)
  VALUES(p_id,new_revision,to_jsonb(d) || jsonb_build_object('status','published','revision',new_revision),p_actor,'publish');
  RETURN new_revision;
END $$;
REVOKE ALL ON FUNCTION agent_knowledge_publish(bigint,bigint,integer) FROM PUBLIC;

-- Public agent calls this RPC only through the server's service-role credentials.
-- Returns published excerpts, not drafts, document metadata or private files.
CREATE OR REPLACE FUNCTION agent_search_knowledge(p_query text, p_locale text, p_limit integer DEFAULT 6)
RETURNS TABLE(id bigint, document_id bigint, title text, snippet text, category text, source_url text, language text, score real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
WITH terms AS (
  SELECT DISTINCT w AS term FROM regexp_split_to_table(lower(left(coalesce(p_query,''),1000)), '[^[:alnum:]]+') AS w
  WHERE (length(w) BETWEEN 3 AND 36 OR w IN ('dg','bl','hs')) AND w NOT IN ('the','and','for','from','with','yang','untuk','dari','dengan','kami','anda','your','apa','bisa','how','can','this','that','have','ada')
  LIMIT 18
), query AS (
  SELECT CASE WHEN count(*)=0 THEN NULL::tsquery
    ELSE to_tsquery('simple',string_agg(quote_literal(term),' | ')) END AS q FROM terms
), ranked AS (
  SELECT c.id,c.document_id,c.heading AS title,c.content AS snippet,c.category,c.source_url,c.locale AS language,
   (ts_rank_cd(c.search_vector,q.q) + CASE WHEN c.locale=p_locale THEN 1 ELSE 0.10 END)::real AS score,
   row_number() OVER (PARTITION BY c.document_id ORDER BY ts_rank_cd(c.search_vector,q.q) DESC,c.id ASC) AS rn
  FROM agent_knowledge_chunks c JOIN agent_knowledge d ON d.id=c.document_id CROSS JOIN query q
  WHERE d.status='published' AND (c.locale=p_locale OR NOT EXISTS (
    SELECT 1 FROM agent_knowledge_chunks native WHERE native.document_id=c.document_id AND native.locale=p_locale
  )) AND q.q IS NOT NULL AND c.search_vector @@ q.q
)
SELECT ranked.id,ranked.document_id,ranked.title,left(ranked.snippet,1200),ranked.category,ranked.source_url,ranked.language,ranked.score
FROM ranked WHERE rn<=2 ORDER BY score DESC,id ASC LIMIT greatest(1,least(coalesce(p_limit,6),10));
$$;
REVOKE ALL ON FUNCTION agent_search_knowledge(text,text,integer) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON FUNCTION agent_knowledge_publish(bigint,bigint,integer) FROM anon;
    REVOKE ALL ON FUNCTION agent_search_knowledge(text,text,integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON FUNCTION agent_knowledge_publish(bigint,bigint,integer) FROM authenticated;
    REVOKE ALL ON FUNCTION agent_search_knowledge(text,text,integer) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION agent_knowledge_publish(bigint,bigint,integer) TO service_role;
    GRANT EXECUTE ON FUNCTION agent_search_knowledge(text,text,integer) TO service_role;
  END IF;
END $$;

-- Allow DOCX source uploads in the existing private VORA documents bucket.
-- Keep every previously allowed type and leave an unrestricted bucket untouched.
DO $$
DECLARE v_bucket constant text := 'vora-documents';
DECLARE v_mime constant text := 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'No Supabase Storage schema. Create a private documents bucket allowing PDF/DOCX before uploading knowledge.';
    RETURN;
  END IF;
  BEGIN
    UPDATE storage.buckets
      SET allowed_mime_types = (SELECT array_agg(DISTINCT t ORDER BY t) FROM unnest(allowed_mime_types || ARRAY[v_mime]) AS t)
      WHERE id=v_bucket AND allowed_mime_types IS NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'Update the private bucket MIME list manually to allow DOCX';
  END;
END $$;
