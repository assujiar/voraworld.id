import type { LineInput } from '../money'
import { ActionError } from '../errors'

export const CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'JPY'] as const
export const MAX_LINES = 100

/**
 * Line items typed one per line as `description | quantity | unit price | unit` (unit optional).
 * Only the syntax is checked here; amounts are validated and calculated by `calcLines`.
 */
export function parseLines(raw: string): LineInput[] {
  const lines: LineInput[] = []
  for (const row of raw.split(/\r?\n/)) {
    if (!row.trim()) continue
    const f = row.split('|').map((s) => s.trim())
    if (f.length !== 3 && f.length !== 4) throw new ActionError('Line items must be: description | quantity | unit price | unit')
    if (!f[0]) throw new ActionError('Every line item needs a description')
    lines.push({ description: f[0], quantity: f[1], price: f[2], unit: f[3] || 'unit' })
  }
  if (lines.length < 1 || lines.length > MAX_LINES) throw new ActionError(`Document requires 1–${MAX_LINES} line items`)
  return lines
}

/** Maps the calculation errors thrown by the money module to a message shown on the form. */
export function moneyErrors<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof ActionError) throw e
    throw new ActionError(e instanceof Error ? e.message : 'Invalid amount')
  }
}

/** One row of the charge table (quotation or invoice): what the person typed in its four editable cells. */
export interface ChargeRow { description: string; quantity: string; unit: string; price: string }

/**
 * Rows of the editable charge table. A row left completely empty is ignored; a row with something in it must be complete. Only the shape is
 * checked here; quantities and prices are validated and calculated, in exact decimal arithmetic, by `calcLines`.
 */
export function chargeLines(rows: ChargeRow[]): LineInput[] {
  const lines: LineInput[] = []
  for (const [i, r] of rows.entries()) {
    const description = String(r.description ?? '').replace(/\u0000/g, '').trim()
    const quantity = String(r.quantity ?? '').trim(), price = String(r.price ?? '').trim(), unit = String(r.unit ?? '').trim()
    if (!description && !quantity && !price && !unit) continue
    const n = `Row ${i + 1}`
    if (!description) throw new ActionError(`${n}: write the description`)
    if (description.length > 500) throw new ActionError(`${n}: the description is too long (at most 500 characters)`)
    if (!quantity) throw new ActionError(`${n}: write the quantity`)
    if (!price) throw new ActionError(`${n}: write the unit price`)
    if (unit.length > 30) throw new ActionError(`${n}: the unit is too long (at most 30 characters)`)
    lines.push({ description, quantity, price, unit: unit || 'unit' })
  }
  if (lines.length < 1 || lines.length > MAX_LINES) throw new ActionError(`Add 1 to ${MAX_LINES} charge items`)
  return lines
}
