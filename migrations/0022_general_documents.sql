-- General documents: letters, billing letters, statements, powers of attorney, certification and assignment letters, certificates.
-- One table for all of them. What differs between the types (the form, the wording, the layout) lives in the application
-- (src/content/document-types.ts); `fields` holds what was typed, `kind` says which type it is. Every document has a number
-- (KIND-VORA-OWNER-YYYYMM-RANDOM5, the owner being the customer it is for or the company itself) and a QR verification link.
-- Status: draft (editable) -> issued (frozen) -> void. RLS is enabled with no policies, so the Supabase Data API cannot read it.
CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  number        VARCHAR(70)  NOT NULL UNIQUE,
  kind          VARCHAR(30)  NOT NULL,
  language      VARCHAR(2)   NOT NULL DEFAULT 'id' CHECK (language IN ('id', 'en')),
  status        VARCHAR(10)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  customer_id   INTEGER REFERENCES customers (id),
  subject       VARCHAR(240) NOT NULL DEFAULT '',
  recipient     VARCHAR(240) NOT NULL DEFAULT '',
  document_date VARCHAR(10)  NOT NULL,                  -- YYYY-MM-DD, like every other date the documents carry
  fields        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_by    INTEGER REFERENCES users (id),
  issued_by     INTEGER REFERENCES users (id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  issued_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_documents_kind_status ON documents (kind, status);
CREATE INDEX IF NOT EXISTS ix_documents_customer ON documents (customer_id);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE documents FROM anon;
    REVOKE ALL ON SEQUENCE documents_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE documents FROM authenticated;
    REVOKE ALL ON SEQUENCE documents_id_seq FROM authenticated;
  END IF;
END $$;
