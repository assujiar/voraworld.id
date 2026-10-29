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
