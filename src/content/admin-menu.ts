/** Sidebar categories. Every signed-in account has the single admin role, so every link is shown. */
export const ADMIN_MENU: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  { title: 'Sales', links: [{ label: 'Leads', href: '/admin/leads' }] },
  { title: 'Finance', links: [
    { label: 'Customers', href: '/admin/customers' }, { label: 'Quotations', href: '/admin/quotations' }, { label: 'Invoices', href: '/admin/invoices' },
    { label: 'Receipts', href: '/admin/receipts' }, { label: 'Bank Accounts', href: '/admin/bank-accounts' },
  ] },
  { title: 'Website', links: [
    { label: 'Pages & Sections', href: '/admin/pages' }, { label: 'Articles', href: '/admin/articles' }, { label: 'FAQs', href: '/admin/faq' },
    { label: 'Media Library', href: '/admin/media' }, { label: 'Navigation', href: '/admin/navigation' }, { label: 'Coverage', href: '/admin/coverage' },
    { label: 'SEO & Redirects', href: '/admin/seo' },
  ] },
  { title: 'System', links: [
    { label: 'Site Settings', href: '/admin/settings' }, { label: 'SMTP & Email Rules', href: '/admin/mail' }, { label: 'Audit Log', href: '/admin/audit' },
  ] },
]
