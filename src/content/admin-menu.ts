/**
 * Sidebar categories, arranged by the work a person does. Every signed-in account has the single admin role, so every link is shown.
 * Proof of delivery lives on each delivery note, payments on each invoice, and pre-payment receipts beside the official receipts: no menu is
 * made for a screen that does not exist.
 */
export const ADMIN_MENU: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  { title: 'Sales & Customers', links: [{ label: 'Leads', href: '/admin/leads' }, { label: 'Customers', href: '/admin/customers' }, { label: 'Quotations', href: '/admin/quotations' }] },
  { title: 'Delivery', links: [{ label: 'Delivery Notes & Proof', href: '/admin/deliveries' }] },
  { title: 'Finance', links: [
    { label: 'Invoices & Payments', href: '/admin/invoices' }, { label: 'Receipts', href: '/admin/receipts' }, { label: 'Bank Accounts', href: '/admin/bank-accounts' },
  ] },
  { title: 'Documents', links: [{ label: 'Letters, Agreements & Seals', href: '/admin/documents' }, { label: 'Signers', href: '/admin/signers' }] },
  { title: 'Website & Content', links: [
    { label: 'Pages & Sections', href: '/admin/pages' }, { label: 'Articles', href: '/admin/articles' }, { label: 'FAQs', href: '/admin/faq' },
    { label: 'Media Library', href: '/admin/media' }, { label: 'Navigation', href: '/admin/navigation' }, { label: 'Coverage', href: '/admin/coverage' },
    { label: 'SEO & Redirects', href: '/admin/seo' },
  ] },
  { title: 'Settings', links: [
    { label: 'Company Information', href: '/admin/settings' }, { label: 'Email & Notifications', href: '/admin/mail' }, { label: 'Activity Log', href: '/admin/audit' },
  ] },
]
