import { tx } from '../db'
import { recordAudit } from '../audit'
import { ActionError } from '../errors'
import { emailAddress } from '../mail/address'
import { ensurePublicCode } from '../numbering'
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
  return tx(async (t) => {
    let customerId = id
    if (id) {
      const [c] = await t`select id, currency from customers where id = ${id} for update`
      if (!c) throw new ActionError('Customer not found', 404)
      if (c.currency !== currency) {
        const [used] = await t`select (select count(*) from invoices where customer_id = ${id}) + (select count(*) from quotations where customer_id = ${id}) as n`
        if (Number(used.n) > 0) throw new ActionError('Currency cannot change on a customer that already has quotations or invoices', 409)
      }
      await t`update customers set name = ${name}, email = ${email}, address = ${input.address.slice(0, 3000)}, tax_id = ${input.taxId.trim().slice(0, 100)},
              currency = ${currency}, terms_days = ${terms} where id = ${id}`
    } else {
      const [row] = await t`insert into customers (name, email, phone, address, tax_id, currency, terms_days)
        values (${name}, ${email}, '', ${input.address.slice(0, 3000)}, ${input.taxId.trim().slice(0, 100)}, ${currency}, ${terms}) returning id`
      customerId = row.id as number
    }
    await ensurePublicCode(t, 'customers', customerId!)
    await recordAudit(t, actorId, 'upsert', 'customer', customerId!, name)
    return customerId!
  })
}
