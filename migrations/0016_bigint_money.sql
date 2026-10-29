-- Money columns were 32-bit integers (maximum 2,147,483,647 minor units). A single freight invoice above
-- IDR 2.1 billion would have failed to save. Widen every *_minor column to 64-bit. Values are unchanged.
ALTER TABLE invoices          ALTER COLUMN discount_minor     TYPE bigint;
ALTER TABLE invoices          ALTER COLUMN subtotal_minor     TYPE bigint;
ALTER TABLE invoices          ALTER COLUMN tax_minor          TYPE bigint;
ALTER TABLE invoices          ALTER COLUMN withholding_minor  TYPE bigint;
ALTER TABLE invoices          ALTER COLUMN total_minor        TYPE bigint;
ALTER TABLE invoices          ALTER COLUMN outstanding_minor  TYPE bigint;
ALTER TABLE invoice_items     ALTER COLUMN price_minor        TYPE bigint;
ALTER TABLE invoice_items     ALTER COLUMN amount_minor       TYPE bigint;
ALTER TABLE quotations        ALTER COLUMN subtotal_minor     TYPE bigint;
ALTER TABLE quotations        ALTER COLUMN tax_minor          TYPE bigint;
ALTER TABLE quotations        ALTER COLUMN total_minor        TYPE bigint;
ALTER TABLE quotation_items   ALTER COLUMN price_minor        TYPE bigint;
ALTER TABLE quotation_items   ALTER COLUMN amount_minor       TYPE bigint;
ALTER TABLE payments          ALTER COLUMN amount_minor       TYPE bigint;
