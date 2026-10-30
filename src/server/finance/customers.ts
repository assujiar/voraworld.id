import { many, rpc } from '../data'
import { ActionError } from '../errors'
import { emailAddress } from '../mail/address'
import { CURRENCIES } from './parse'

export interface CustomerInput {
  name: string; email: string; address: string; taxId: string; currency: string; termsDays: string
  /** The company's general number (the contact person has their own below). */
  phone: string
  picName: string; picPosition: string; picEmail: string; picPhone: string
}

/** Fields the tests and older callers may leave out. */
export type CustomerFields = Pick<CustomerInput, 'name' | 'email' | 'address' | 'taxId' | 'currency' | 'termsDays'> & Partial<CustomerInput>

const PHONE = /^[0-9+()\-\s.]{6,60}$/
const clean = (value: string | undefined, max: number, label: string): string => {
  const v = String(value ?? '').replace(/\u0000/g, '').trim()
  if (v.length > max) throw new ActionError(`${label} is too long (at most ${max} characters)`)
  return v
}
function phoneOf(value: string | undefined, label: string): string {
  const v = clean(value, 60, label)
  if (v && !PHONE.test(v)) throw new ActionError(`${label} may hold only digits, spaces, + ( ) - and .`)
  return v
}
function emailOf(value: string | undefined, label: string): string {
  const v = clean(value, 200, label)
  if (!v) return ''
  try { return emailAddress(v) } catch { throw new ActionError(`${label} is not a valid address`) }
}

/** Validates what was typed into the customer form and gives the database function its payload. */
export function customerPayload(input: CustomerFields): Record<string, unknown> {
  const name = clean(input.name, 200, 'Customer name')
  if (!name) throw new ActionError('Customer name required')
  const currency = (CURRENCIES as readonly string[]).includes(input.currency) ? input.currency : 'IDR'
  const terms = Number.parseInt(input.termsDays, 10)
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) throw new ActionError('Invalid payment terms')
  return {
    name, email: emailOf(input.email, 'Billing email'), phone: phoneOf(input.phone, 'The company phone number'), address: String(input.address ?? '').slice(0, 3000),
    tax_id: clean(input.taxId, 100, 'Tax identifier'), currency, terms_days: terms,
    pic_name: clean(input.picName, 160, 'The contact person\'s name'), pic_position: clean(input.picPosition, 160, 'The contact person\'s position'),
    pic_email: emailOf(input.picEmail, 'The contact person\'s email'), pic_phone: phoneOf(input.picPhone, 'The contact person\'s phone number'),
  }
}

export interface CustomerMatch { id: number; name: string; publicCode: string | null; email: string; why: string }

const normalName = (v: string) => v.toLowerCase().replace(/\b(pt|cv|tbk|ud|pd|co|ltd|inc|llc)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
const digits = (v: string) => v.replace(/\D+/g, '')

/**
 * Customers that look like the one being typed: the same company name (ignoring PT/CV and punctuation), the same billing or contact email, the same
 * tax identifier or the same contact phone. Nothing is merged: the people are shown the matches and decide.
 */
export async function findCustomerMatches(input: Pick<CustomerFields, 'name' | 'email' | 'taxId' | 'picEmail' | 'picPhone' | 'phone'>, exceptId: number | null = null): Promise<CustomerMatch[]> {
  const rows = await many('customers', (q) => q.order('id'), 'id,name,email,tax_id,phone,pic_email,pic_phone,public_code')
  const name = normalName(input.name ?? '')
  const mails = [input.email, input.picEmail].map((e) => (e ?? '').trim().toLowerCase()).filter(Boolean)
  const tax = digits(input.taxId ?? '')
  const phones = [input.phone, input.picPhone].map((p) => digits(p ?? '')).filter((p) => p.length >= 7)
  const out: CustomerMatch[] = []
  for (const r of rows) {
    if (exceptId !== null && r.id === exceptId) continue
    const why: string[] = []
    if (name && normalName(r.name as string) === name) why.push('the same company name')
    const theirMails = [r.email, r.picEmail].map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean)
    if (mails.some((m) => theirMails.includes(m))) why.push('the same email address')
    if (tax.length >= 8 && digits(String(r.taxId ?? '')) === tax) why.push('the same tax identifier')
    const theirPhones = [r.phone, r.picPhone].map((p) => digits(String(p ?? ''))).filter(Boolean)
    if (phones.some((p) => theirPhones.includes(p))) why.push('the same phone number')
    if (why.length) out.push({ id: r.id as number, name: r.name as string, publicCode: (r.publicCode as string | null) ?? null, email: String(r.email ?? ''), why: why.join(', ') })
  }
  return out
}

/**
 * Creates or updates a customer. The permanent owner code (used in every document number) is allocated once. A NEW customer that matches an
 * existing one is refused with the matches named, unless `acknowledgeDuplicates` says the person looked at them: nothing is merged silently.
 */
export async function saveCustomer(actorId: number, id: number | null, input: CustomerFields, opts: { acknowledgeDuplicates?: boolean } = {}): Promise<number> {
  const p = customerPayload(input)
  if (id === null && !opts.acknowledgeDuplicates) {
    const matches = await findCustomerMatches({ name: input.name, email: input.email, taxId: input.taxId, picEmail: input.picEmail, picPhone: input.picPhone, phone: input.phone })
    if (matches.length) {
      throw new ActionError(`A similar customer already exists: ${matches.slice(0, 3).map((m) => `${m.name}${m.publicCode ? ` (${m.publicCode})` : ''}, ${m.why}`).join('; ')}. Use that customer, or tick "This is a different customer" and save again.`, 409)
    }
  }
  return rpc<number>('customer_save', { p_actor: actorId, p_id: id, p })
}
