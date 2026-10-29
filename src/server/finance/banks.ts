import { tx, type Db } from '../db'
import { recordAudit } from '../audit'
import { ActionError, isUnique } from '../errors'
import type { BankAccountsRow } from '../schema'

export interface BankInput { bankName: string; accountNumber: string; accountHolder: string; currency: string; branch: string; swiftCode: string; notes: string; makeDefault?: boolean }

/** What an invoice or payment keeps of a bank account: a frozen copy, so later edits never alter issued documents. */
export const bankSnapshot = (b: Pick<BankAccountsRow, 'bankName' | 'accountNumber' | 'accountHolder' | 'currency' | 'branch' | 'swiftCode'>) => ({
  bank_name: b.bankName ?? '', account_number: b.accountNumber ?? '', account_holder: b.accountHolder ?? '',
  currency: b.currency ?? '', branch: b.branch ?? '', swift_code: b.swiftCode ?? '',
})

const NUMBER = /^[0-9A-Za-z-]{5,60}$/
const SWIFT = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/

function clean(input: BankInput) {
  const bankName = input.bankName.trim().slice(0, 120)
  const accountNumber = input.accountNumber.trim().replace(/\s+/g, '').slice(0, 60)
  const accountHolder = input.accountHolder.trim().slice(0, 200)
  const swiftCode = input.swiftCode.trim().toUpperCase().slice(0, 25)
  if (!bankName || !accountHolder || !NUMBER.test(accountNumber) || (swiftCode && !SWIFT.test(swiftCode))) {
    throw new ActionError('Bank, account holder, account number or SWIFT is invalid')
  }
  return { bankName, accountNumber, accountHolder, swiftCode, branch: input.branch.trim().slice(0, 150), notes: input.notes.trim().slice(0, 250) }
}

export async function createBank(actorId: number, input: BankInput): Promise<number> {
  const currency = input.currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new ActionError('Currency must be a 3-letter code')
  const c = clean(input)
  try {
    return await tx(async (t) => {
      // One preferred account per currency: the first account for a currency is preferred automatically.
      const [{ n }] = await t`select count(*)::int as n from bank_accounts where currency = ${currency} and is_default and active`
      const primary = Boolean(input.makeDefault) || n === 0
      if (primary) await t`update bank_accounts set is_default = false where currency = ${currency} and is_default`
      const [{ position }] = await t`select count(*)::int + 1 as position from bank_accounts`
      const [row] = await t`insert into bank_accounts (bank_name, account_number, account_holder, currency, branch, swift_code, notes, active, is_default, position)
        values (${c.bankName}, ${c.accountNumber}, ${c.accountHolder}, ${currency}, ${c.branch}, ${c.swiftCode}, ${c.notes}, true, ${primary}, ${position}) returning id`
      await recordAudit(t, actorId, 'create', 'bank-account', row.id as number, `${c.bankName} / ${currency}`)
      return row.id as number
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Bank account already exists', 409)
    throw e
  }
}

export type BankAction = 'save' | 'default' | 'disable' | 'enable'

async function otherDefault(t: Db, currency: string, exceptId: number) {
  const [row] = await t`select id from bank_accounts where currency = ${currency} and is_default and active and id <> ${exceptId}`
  return row
}

export async function updateBank(actorId: number, id: number, action: BankAction, input?: BankInput): Promise<void> {
  try {
    await tx(async (t) => {
      const [bank] = await t`select * from bank_accounts where id = ${id} for update`
      if (!bank) throw new ActionError('Bank account not found', 404)
      const currency = bank.currency as string
      if (action === 'default') {
        if (!bank.active) throw new ActionError('An inactive account cannot be the preferred account', 409)
        await t`update bank_accounts set is_default = false where currency = ${currency} and is_default and id <> ${id}`
        await t`update bank_accounts set is_default = true, updated_at = now() where id = ${id}`
      } else if (action === 'disable') {
        await t`update bank_accounts set active = false, is_default = false, updated_at = now() where id = ${id}`
      } else if (action === 'enable') {
        const takeover = !(await otherDefault(t, currency, id))
        await t`update bank_accounts set active = true, is_default = ${takeover}, updated_at = now() where id = ${id}`
      } else if (action === 'save') {
        if (!input) throw new ActionError('Invalid bank details')
        const c = clean(input)
        await t`update bank_accounts set bank_name = ${c.bankName}, account_number = ${c.accountNumber}, account_holder = ${c.accountHolder},
                branch = ${c.branch}, swift_code = ${c.swiftCode}, notes = ${c.notes}, updated_at = now() where id = ${id}`
      } else {
        throw new ActionError('Invalid action')
      }
      await recordAudit(t, actorId, action, 'bank-account', id, String(bank.bankName))
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Bank account already exists', 409)
    throw e
  }
}
