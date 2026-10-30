-- PROPOSAL ONLY. NOT APPLIED. NOT in migrations/ on purpose, so neither the test runner nor `npm run db:migrate` can pick it up.
-- To adopt it: the owner reviews it, it is copied to migrations/0029_archive_metadata.sql, `npm run gen:schema` regenerates src/server/schema.ts,
-- and only then may application code read the new columns. Until then nothing in the code base selects any column named here.
--
-- Additive and idempotent. Every statement can be run twice. Nothing rewrites existing rows or existing publication dates.

-- 1. Article archive metadata. `published_at` stays the actual first publication timestamp; the editorial period is a separate bucket.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS translation_group_id uuid;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS editorial_year      smallint;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS editorial_quarter   smallint;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_alt           text NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_caption       text NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS sources             jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_editorial_period_check') THEN
    ALTER TABLE articles ADD CONSTRAINT articles_editorial_period_check
      CHECK ((editorial_year IS NULL AND editorial_quarter IS NULL) OR (editorial_year BETWEEN 2000 AND 2100 AND editorial_quarter BETWEEN 1 AND 4));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_sources_is_array') THEN
    ALTER TABLE articles ADD CONSTRAINT articles_sources_is_array CHECK (jsonb_typeof(sources) = 'array');
  END IF;
END $$;

-- One English and one Indonesian entry per translation group; a slug stays unique within its language.
CREATE UNIQUE INDEX IF NOT EXISTS articles_translation_group_locale_key ON articles (translation_group_id, locale) WHERE translation_group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS articles_locale_slug_key ON articles (locale, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS articles_editorial_period_idx ON articles (editorial_year, editorial_quarter) WHERE status = 'published';

-- 2. Republishing must not move the first publication date (article_save in 0024 sets published_at = now() on every publish).
--    The only change to the existing body is `coalesce(published_at, now())` and the optional new fields.
CREATE OR REPLACE FUNCTION article_save(p_actor integer, p_id integer, p jsonb, p_action text) RETURNS integer
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_old articles%ROWTYPE; v_id integer := p_id; v_status text;
BEGIN
  v_status := CASE p_action WHEN 'publish' THEN 'published' WHEN 'unpublish' THEN 'draft' END;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_old FROM articles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM vr_fail(404, 'Article not found'); END IF;
    INSERT INTO revisions (resource, resource_id, snapshot, author_id) VALUES ('article', p_id, vr_article_snapshot(v_old)::json, p_actor);
    UPDATE articles SET title = p->>'title', slug = p->>'slug', excerpt = p->>'excerpt', body = p->>'body', category = p->>'category', tags = p->>'tags', locale = p->>'locale',
           author = p->>'author', seo_title = p->>'seo_title', seo_description = p->>'seo_description',
           cover_alt = coalesce(p->>'cover_alt', cover_alt), cover_caption = coalesce(p->>'cover_caption', cover_caption),
           updated_at = now() WHERE id = p_id;
    IF v_status = 'published' THEN UPDATE articles SET status = 'published', published_at = coalesce(published_at, now()) WHERE id = p_id;
    ELSIF v_status = 'draft' THEN UPDATE articles SET status = 'draft' WHERE id = p_id; END IF;
  ELSE
    INSERT INTO articles (title, slug, excerpt, body, category, tags, locale, author, seo_title, seo_description, status, published_at, cover_alt, cover_caption)
      VALUES (p->>'title', p->>'slug', p->>'excerpt', p->>'body', p->>'category', p->>'tags', p->>'locale', p->>'author', p->>'seo_title', p->>'seo_description',
              coalesce(v_status, 'draft'), CASE WHEN v_status = 'published' THEN now() END, coalesce(p->>'cover_alt', ''), coalesce(p->>'cover_caption', '')) RETURNING id INTO v_id;
  END IF;
  PERFORM vr_audit(p_actor, CASE WHEN p_action = 'publish' THEN 'publish' ELSE 'update' END, 'article', v_id, p->>'title');
  RETURN v_id;
END
$fn$;

-- 3. FAQ language. NULL keeps today's meaning (shown in both languages); 'en' or 'id' limits a question to one.
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS locale text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'faqs_locale_check') THEN
    ALTER TABLE faqs ADD CONSTRAINT faqs_locale_check CHECK (locale IS NULL OR locale IN ('en', 'id'));
  END IF;
END $$;

-- 4. Footer description and Indonesian legal text need no migration: they are `settings` keys
--    (footer_description_en, footer_description_id, privacy_id, terms_id), editable in the admin portal today.

-- Run BEFORE applying (read only). The unique index on (locale, slug) fails if production already holds a duplicate; this must return no rows:
--   SELECT locale, slug, count(*) FROM articles WHERE slug IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
--
-- Verification after applying (read only):
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'articles' AND column_name IN
--     ('translation_group_id','editorial_year','editorial_quarter','cover_alt','cover_caption','sources','reviewed_at') ORDER BY 1;
--   SELECT count(*) FROM articles WHERE published_at IS NOT NULL;   -- unchanged by this migration
-- Rollback: columns and indexes can be dropped; restore article_save from migrations/0024_data_api.sql.
