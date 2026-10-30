import type { Locale } from './index'

/**
 * The short description under the logo in the footer, used until the owner saves their own in Settings (footer_description_en / _id).
 * It is deliberately separate from the long company profile (About page) and says only what is already stated publicly: the brand, the operating
 * company and the five services. Nothing about size, age, coverage or credentials.
 */
export const FOOTER_DESCRIPTION: Record<Locale, string> = {
  en: 'VORA is a logistics brand operated by PT Satu Arah International in Jakarta. We coordinate international freight, domestic distribution, customs requirements, warehousing and project cargo.',
  id: 'VORA adalah brand logistik di bawah PT Satu Arah International, Jakarta. Kami mengoordinasikan international freight, distribusi domestik, kebutuhan kepabeanan, warehousing, dan project cargo.',
}
