-- A quotation carries its own Terms of Payment and its own Terms & Conditions. The printed quotation and the customer
-- approval page show both, so the customer knows exactly what the signature accepts; `notes` stays for anything extra.
-- Existing quotations get an empty text: nothing is invented for them, and the documents simply leave the sections out.
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms_conditions TEXT NOT NULL DEFAULT '';
