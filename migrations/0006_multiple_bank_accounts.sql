-- VORA: multiple administrator-managed payment accounts + immutable invoice instructions.
-- Apply after 0005_document_numbering.sql. Back up the database first.
BEGIN;
CREATE TABLE IF NOT EXISTS bank_accounts (
 id SERIAL PRIMARY KEY,
 bank_name VARCHAR(120) NOT NULL,
 account_number VARCHAR(60) NOT NULL,
 account_holder VARCHAR(200) NOT NULL,
 currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
 branch VARCHAR(150) DEFAULT '',
 swift_code VARCHAR(25) DEFAULT '',
 notes VARCHAR(250) DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 is_default BOOLEAN NOT NULL DEFAULT FALSE,
 position INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW(),
 updated_at TIMESTAMPTZ DEFAULT NOW(),
 CONSTRAINT uq_bank_name_number UNIQUE(bank_name, account_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_one_active_preferred_per_currency
 ON bank_accounts(currency) WHERE is_default IS TRUE AND active IS TRUE;
CREATE TABLE IF NOT EXISTS invoice_bank_instructions (
 id SERIAL PRIMARY KEY,
 invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
 bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
 bank_name VARCHAR(120) NOT NULL,
 account_number VARCHAR(60) NOT NULL,
 account_holder VARCHAR(200) NOT NULL,
 currency VARCHAR(8) NOT NULL,
 branch VARCHAR(150) DEFAULT '',
 swift_code VARCHAR(25) DEFAULT '',
 position INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT uq_invoice_bank_selection UNIQUE (invoice_id, bank_account_id)
);
CREATE INDEX IF NOT EXISTS ix_invoice_bank_instructions_invoice ON invoice_bank_instructions (invoice_id, position);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receiving_bank_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receiving_bank_snapshot JSON;
-- Legacy settings.bank_account is retained for audit and should be manually migrated through Admin > Bank Accounts.
COMMIT;
