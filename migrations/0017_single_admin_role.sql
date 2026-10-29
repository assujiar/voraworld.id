-- The portal now has ONE role, `admin`, with access to every menu.
-- Accounts created by the earlier multi-role version as `superadmin` become `admin`. Any other legacy role
-- (editor, sales, finance, viewer) is left untouched and simply has NO access: the application denies every
-- role except `admin`. To grant such a person access, run:  npm run users -- create EMAIL   (or an UPDATE of users.role).
UPDATE users SET role = 'admin' WHERE role = 'superadmin';
