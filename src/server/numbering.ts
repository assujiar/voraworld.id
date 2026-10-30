import { randomBytes, randomInt } from 'node:crypto'
import type { Db } from './db'
import { today } from './dates'
import { DOCUMENT_PREFIXES } from '../content/document-types'

export type OwnerTable = 'customers' | 'leads'

/** Stable, random per-customer/lead reference (C/L + 10 hex). Never derived from name or email. */
export async function ensurePublicCode(db: Db, table: OwnerTable, id: number): Promise<string> {
  const prefix = table === 'customers' ? 'C' : 'L'
  const [existing] = await db`select public_code from ${db(table)} where id = ${id}`
  if (!existing) throw new Error('Owner not found')
  if (existing.publicCode) return existing.publicCode as string
  for (let i = 0; i < 60; i++) {
    const candidate = prefix + randomBytes(5).toString('hex').toUpperCase()
    const taken = await db`select 1 from ${db(table)} where public_code = ${candidate}`
    if (taken.length) continue
    // `public_code is null` makes concurrent allocators converge on whichever code was stored first.
    const [row] = await db`update ${db(table)} set public_code = ${candidate} where id = ${id} and public_code is null returning public_code`
    if (row) return row.publicCode as string
    const [again] = await db`select public_code from ${db(table)} where id = ${id}`
    if (again?.publicCode) return again.publicCode as string
  }
  throw new Error('Cannot allocate a unique owner code')
}

/** Stable, random code of the company itself (V + 10 hex): the owner of documents that are not for one customer. Stored once in the settings. */
export async function ensureCompanyCode(db: Db): Promise<string> {
  const read = async () => (await db`select value from settings where key = 'company_code'`)[0]?.value as string | undefined
  const existing = await read()
  if (existing && /^V[A-F0-9]{10}$/.test(existing)) return existing
  await db`insert into settings (key, value, updated_at) values ('company_code', ${'V' + randomBytes(5).toString('hex').toUpperCase()}, now()) on conflict (key) do nothing`
  const code = await read()
  if (!code || !/^V[A-F0-9]{10}$/.test(code)) throw new Error('Cannot allocate the company code')
  return code
}

const KINDS: Record<string, { table: string; column: string }> = {
  INV: { table: 'invoices', column: 'number' },
  RCP: { table: 'receipts', column: 'number' },
  PPR: { table: 'prepayment_receipts', column: 'number' },
  QUO: { table: 'quotations', column: 'number' },
  RFQ: { table: 'leads', column: 'reference' },
  INQ: { table: 'leads', column: 'reference' },
  // General documents (letters, certificates...): one table, one prefix per type.
  ...Object.fromEntries(DOCUMENT_PREFIXES.map((prefix) => [prefix, { table: 'documents', column: 'number' }])),
}

/**
 * KIND-VORA-OWNER-YYYYMM-RANDOM5. The last five digits are random, not a running counter.
 * A transaction-scoped advisory lock serialises allocation per (kind, owner, month); the unique index on the
 * column remains the ultimate guard. Must be called inside the transaction that inserts the document.
 */
export async function nextNumber(db: Db, kind: string, ownerCode: string, date?: string): Promise<string> {
  kind = kind.toUpperCase()
  const spec = KINDS[kind]
  if (!spec) throw new Error('Unsupported document kind')
  if (!/^[CLV][A-F0-9]{10}$/.test(ownerCode ?? '')) throw new Error('Invalid owner code')
  const day = date ?? today()   // the business date in Jakarta, so a lead logged just after midnight there gets the right month
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) throw new Error('Invalid date')
  const period = day.slice(0, 4) + day.slice(5, 7)
  const scope = `${kind}-VORA-${ownerCode}-${period}-`
  await db`select pg_advisory_xact_lock(hashtext(${scope}))`
  for (let i = 0; i < 160; i++) {
    const candidate = scope + String(randomInt(0, 100000)).padStart(5, '0')
    const taken = await db`select 1 from ${db(spec.table)} where ${db(spec.column)} = ${candidate}`
    if (!taken.length) return candidate
  }
  throw new Error('Could not allocate a unique five-digit document number')
}
