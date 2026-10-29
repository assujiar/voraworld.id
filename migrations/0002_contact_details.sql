-- VORA approved contact details supplied by the company owner on 2026-10-29.
-- Run ONCE AFTER migrations/0001_initial_postgres.sql.
-- Existing non-empty administrator edits are preserved.
BEGIN;
INSERT INTO settings (key, value, updated_at)
VALUES
  ('email', 'info@voraworld.id', NOW()),
  ('address', 'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW()
  WHERE settings.value IS NULL OR BTRIM(settings.value) = '';
COMMIT;
