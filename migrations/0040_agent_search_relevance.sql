-- VORA Agent knowledge search relevance.
-- 1) A heading match outranks a body match (weights A and B), so the article about a topic beats one that only mentions it.
-- 2) Common question words in Indonesian and English no longer drive matches ("dan", "saya", "cara", "what", "need" ...).
-- The signature and return columns are unchanged, so the application and existing grants keep working.
ALTER TABLE public.agent_knowledge_chunks DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.agent_knowledge_chunks ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(heading,'')), 'A') || setweight(to_tsvector('simple', coalesce(content,'')), 'B')
) STORED;
CREATE INDEX IF NOT EXISTS agent_knowledge_chunks_search_idx ON public.agent_knowledge_chunks USING GIN(search_vector);

CREATE OR REPLACE FUNCTION public.agent_search_knowledge(p_query text, p_locale text, p_limit integer DEFAULT 6)
RETURNS TABLE(id bigint, document_id bigint, title text, snippet text, category text, source_url text, language text, score real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
WITH terms AS (
  SELECT DISTINCT w AS term FROM regexp_split_to_table(lower(left(coalesce(p_query,''),1000)), '[^[:alnum:]]+') AS w
  WHERE (length(w) BETWEEN 3 AND 36 OR w IN ('dg','bl','hs')) AND w NOT IN (
    'the','and','for','from','with','your','how','can','this','that','have','what','which','where','when','why','who','does','did','are','was','were',
    'will','would','should','could','about','into','onto','need','want','please','tell','some','any','all','not','but','its','our','you','they','them',
    'their','there','than','then','also','been','being','more','most','much','many','very','just','like','such','only','over','under','between',
    'indonesia','indonesian',
    'yang','untuk','dari','dengan','kami','anda','apa','bisa','ada','saya','aku','mau','ingin','itu','ini','dan','atau','adalah','akan','agar',
    'bagaimana','berapa','cara','dalam','pada','para','sudah','belum','juga','tidak','harus','perlu','apakah','kapan','dimana','mengapa','kenapa',
    'jadi','kalau','jika','saat','lagi','sangat','dapat','oleh','bagi','antar','tentang','seperti','mohon','tolong','minta','bantu','sama','lebih',
    'kita','mereka','yaitu','serta','sebagai','karena','hanya','masih','buat','bila'
  )
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
