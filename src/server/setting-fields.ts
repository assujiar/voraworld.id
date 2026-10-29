/** Editable public settings (shown on /admin/settings). */
export const SETTING_FIELDS: Array<[string, string]> = [
  ['legal_name', 'Legal company name'], ['company_description', 'Company profile public text'], ['email', 'Public email'], ['address', 'Public address'],
  ['hours', 'Operating hours'], ['linkedin', 'LinkedIn URL'], ['instagram', 'Instagram URL'], ['privacy', 'Approved privacy notice HTML'],
  ['terms', 'Approved terms HTML'], ['ga4_id', 'GA4 measurement ID (optional)'], ['gtm_id', 'GTM ID (optional)'],
]
export const SETTING_KEYS = SETTING_FIELDS.map(([k]) => k)
export const WIDE_SETTINGS = ['company_description', 'address', 'privacy', 'terms']
