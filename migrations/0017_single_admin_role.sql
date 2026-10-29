-- The portal now has ONE role, `admin`, with access to every menu.
-- Accounts created by the earlier multi-role version as `superadmin` become `admin`. Any other legacy role
-- (editor, sales, finance, viewer) is left untouched and simply has NO access: the application denies every
-- role except `admin`. To grant such a person access, run:  UPDATE users SET role = 'admin' WHERE email = '...';
-- (`npm run users -- create` refuses an email that already exists and prints this statement for you.)
UPDATE users SET role = 'admin' WHERE role = 'superadmin';
