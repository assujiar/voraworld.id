-- The company's NPWP (tax ID), supplied by the company owner on 2026-10-30 from the NPWP card of PT Satu Arah International.
-- It is printed in the header and in the issuer block of every generated document (invoice, receipt, price agreement letter...).
-- An NPWP that the administrator has already entered is preserved.
INSERT INTO settings (key, value, updated_at)
VALUES ('tax_id', '1000 0000 1178 2812', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW()
  WHERE settings.value IS NULL OR BTRIM(settings.value) = '';
