-- VORA unified document numbering and quotation storage.
-- Apply after 0004; backup DB first. Old issued numbers are not rewritten.
BEGIN;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS public_code VARCHAR(12);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS public_code VARCHAR(12);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reference VARCHAR(90);
UPDATE customers SET public_code = 'C' || UPPER(SUBSTRING(MD5('customer:'||id::text||':'||clock_timestamp()::text||':'||random()::text),1,10)) WHERE public_code IS NULL;
UPDATE leads SET public_code = 'L' || UPPER(SUBSTRING(MD5('lead:'||id::text||':'||clock_timestamp()::text||':'||random()::text),1,10)) WHERE public_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_public_code ON customers (public_code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_public_code ON leads (public_code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_reference ON leads (reference);
CREATE TABLE IF NOT EXISTS quotations (
 id SERIAL PRIMARY KEY,
 number VARCHAR(90) NOT NULL UNIQUE,
 customer_id INTEGER REFERENCES customers(id),
 lead_id INTEGER REFERENCES leads(id),
 status VARCHAR(20) DEFAULT 'draft',
 currency VARCHAR(8) DEFAULT 'IDR',
 issued_at VARCHAR(10) NOT NULL,
 valid_until VARCHAR(10) NOT NULL,
 notes TEXT DEFAULT '',
 tax_percent VARCHAR(20) DEFAULT '0',
 subtotal_minor INTEGER DEFAULT 0,
 tax_minor INTEGER DEFAULT 0,
 total_minor INTEGER DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW(),
 CONSTRAINT quote_one_recipient CHECK ((customer_id IS NOT NULL AND lead_id IS NULL) OR (lead_id IS NOT NULL AND customer_id IS NULL))
);
CREATE TABLE IF NOT EXISTS quotation_items (
 id SERIAL PRIMARY KEY,
 quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
 description VARCHAR(500) NOT NULL,
 unit VARCHAR(30) DEFAULT 'unit',
 quantity VARCHAR(30) NOT NULL,
 price_minor INTEGER NOT NULL,
 amount_minor INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS ix_quotations_lead ON quotations(lead_id);
COMMIT;
