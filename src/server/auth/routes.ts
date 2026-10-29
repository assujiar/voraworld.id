import type { Permission } from './roles'

/**
 * Which permission each admin URL needs. Used by middleware (to answer 401/403 before any page code runs)
 * and checked against the filesystem by tests, so a new admin page cannot ship without an entry.
 * `null` = any signed-in user. Longest prefix wins.
 */
const TABLE: Array<[string, Permission | null]> = [
  ['/admin/leads', 'crm'],
  ['/admin/customers', 'finance'],
  ['/admin/bank-accounts', 'finance'],
  ['/admin/quotations', 'finance'],
  ['/admin/quotation-approvals', 'finance'],
  ['/admin/invoices', 'finance'],
  ['/admin/payments', 'finance'],
  ['/admin/receipts', 'finance'],
  ['/admin/articles', 'content'],
  ['/admin/pages', 'content'],
  ['/admin/faq', 'content'],
  ['/admin/media', 'content'],
  ['/admin/navigation', 'content'],
  ['/admin/coverage', 'settings'],
  ['/admin/seo', 'settings'],
  ['/admin/settings', 'settings'],
  ['/admin/mail', 'settings'],
  ['/admin/audit', 'settings'],
  ['/admin', null],
]

export function adminPermission(pathname: string): Permission | null | undefined {
  const hit = TABLE.filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/')).sort((a, b) => b[0].length - a[0].length)[0]
  return hit ? hit[1] : undefined
}

export const ADMIN_PERMISSION_PREFIXES = TABLE.map(([p]) => p)
