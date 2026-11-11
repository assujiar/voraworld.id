/** Shared, server-side canonicalization. SQL migration 0032 implements the same rules for existing CRM records. */
export type VisitorIdentity = { name: string; company: string; email: string; phone: string }
export type NormalizedIdentity = VisitorIdentity & { emailKey: string; phoneKey: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[0-9][0-9\s().-]{4,38}[0-9]$/
const clean = (raw: unknown, max: number): string => typeof raw === 'string'
  ? raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, max + 1)
  : ''

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase().replace(/^mailto:/, '')
  const index = email.lastIndexOf('@')
  if (index === -1) return email
  const local = email.slice(0, index)
  const domain = email.slice(index + 1)
  // Google's documented Gmail aliases; never remove dots or plus-tags for other domains.
  return domain === 'gmail.com' || domain === 'googlemail.com'
    ? `${local.split('+')[0].replaceAll('.', '')}@gmail.com`
    : email
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('620') && digits.length >= 11 && digits.length <= 16) return `62${digits.slice(3)}`
  if (digits.startsWith('08') && digits.length >= 10 && digits.length <= 14) return `62${digits.slice(1)}`
  if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 13) return `62${digits}`
  return digits
}

export function parseVisitorIdentity(payload: Record<string, unknown>): NormalizedIdentity | null {
  const name = clean(payload.name, 140)
  const company = clean(payload.company, 200)
  const email = clean(payload.email, 200).toLowerCase()
  const phone = clean(payload.phone, 40)
  if (name.length < 2 || name.length > 140 || company.length < 2 || company.length > 200 ||
    !EMAIL.test(email) || email.length > 200 || !PHONE.test(phone)) return null
  const emailKey = normalizeEmail(email)
  const phoneKey = normalizePhone(phone)
  if (!EMAIL.test(emailKey) || phoneKey.length < 7 || phoneKey.length > 15) return null
  return { name, company, email, phone, emailKey, phoneKey }
}
