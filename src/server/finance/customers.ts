import { rpc } from '../data'
import { ActionError } from '../errors'
import { emailAddress } from '../mail/address'
import { CURRENCIES } from './parse'

export interface CustomerInput { name: string; email: string; address: string; taxId: string; currency: string; termsDays: string }

/** Creates or updates a customer. The permanent owner code (used in every document number) is allocated once. */
export async function saveCustomer(actorId: number, id: number | null, input: CustomerInput): Promise<number> {
  const name = input.name.trim().slice(0, 200)
  if (!name) throw new ActionError('Customer name required')
  let email = input.email.trim().slice(0, 200)
  if (email) {
    try { email = emailAddress(email) } catch { throw new ActionError('Billing email is not a valid address') }
  }
  const currency = (CURRENCIES as readonly string[]).includes(input.currency) ? input.currency : 'IDR'
  const terms = Number.parseInt(input.termsDays, 10)
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) throw new ActionError('Invalid payment terms')
  return rpc<number>('customer_save', {
    p_actor: actorId, p_id: id,
    p: { name, email, address: input.address.slice(0, 3000), tax_id: input.taxId.trim().slice(0, 100), currency, terms_days: terms },
  })
}
