/**
 * The portal has exactly one role, `admin`, and it can open every menu and perform every action.
 * Any other value in `users.role` (for example a row left over from the earlier multi-role version) has NO access:
 * the safe default for an unknown role is to deny.
 */
export const ADMIN_ROLE = 'admin'
export const isAdminRole = (role: string | null | undefined): boolean => role === ADMIN_ROLE
