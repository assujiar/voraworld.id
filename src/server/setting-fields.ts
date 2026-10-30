/** Editable public settings (shown on /admin/settings). */
export const SETTING_FIELDS: Array<[string, string]> = [
  ['legal_name', 'Legal company name'], ['tax_id', 'NPWP (tax ID), printed on documents'], ['company_description', 'Company profile public text'], ['email', 'Public email'], ['address', 'Public address (also printed on documents)'],
  ['hours', 'Operating hours'], ['linkedin', 'LinkedIn URL'], ['instagram', 'Instagram URL'], ['privacy', 'Approved privacy notice HTML'],
  ['terms', 'Approved terms HTML'], ['ga4_id', 'GA4 measurement ID (optional)'], ['gtm_id', 'GTM ID (optional)'],
  // Text that the new-quotation form starts from (each quotation keeps its own copy, so later changes never alter an issued one).
  ['quotation_payment_terms', 'Quotations: default terms of payment'], ['quotation_terms', 'Quotations: default terms and conditions'],
]
export const SETTING_KEYS = SETTING_FIELDS.map(([k]) => k)
export const WIDE_SETTINGS = ['company_description', 'address', 'privacy', 'terms', 'quotation_payment_terms', 'quotation_terms']
