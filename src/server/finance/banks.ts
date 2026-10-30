import { rpc } from '../data'
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
  return { bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, swift_code: swiftCode, branch: input.branch.trim().slice(0, 150), notes: input.notes.trim().slice(0, 250) }
}

export async function createBank(actorId: number, input: BankInput): Promise<number> {
  const currency = input.currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new ActionError('Currency must be a 3-letter code')
  const c = clean(input)
  try {
    return await rpc<number>('bank_create', { p_actor: actorId, p: { ...c, currency, make_default: Boolean(input.makeDefault) } })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Bank account already exists', 409)
    throw e
  }
}

export type BankAction = 'save' | 'default' | 'disable' | 'enable'

export async function updateBank(actorId: number, id: number, action: BankAction, input?: BankInput): Promise<void> {
  if (action === 'save' && !input) throw new ActionError('Invalid bank details')
  const p = action === 'save' ? clean(input!) : null
  try {
    await rpc('bank_update', { p_actor: actorId, p_id: id, p_action: action, p })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Bank account already exists', 409)
    throw e
  }
}
