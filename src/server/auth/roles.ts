/** Server-side permission model. `*` grants everything. */
export type Permission = 'content' | 'crm' | 'finance' | 'settings'
export type Role = 'superadmin' | 'admin' | 'editor' | 'sales' | 'finance' | 'viewer'

export const ROLES: Record<Role, ReadonlySet<Permission | '*'>> = {
  superadmin: new Set(['*']),
  admin: new Set(['content', 'crm', 'finance', 'settings']),
  editor: new Set(['content']),
  sales: new Set(['crm']),
  finance: new Set(['finance']),
  viewer: new Set(),
}

export const ROLE_NAMES = Object.keys(ROLES) as Role[]

export function can(role: string, permission?: Permission): boolean {
  const grants = ROLES[role as Role]
  if (!grants) return false
  return !permission || grants.has('*') || grants.has(permission)
}
