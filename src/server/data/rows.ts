import { DATE_COLUMNS } from '../schema'

/** `invoice_id` -> `invoiceId`, the shape rows have always had in this code base. */
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/**
 * A row from the Data API as the application uses it: camelCase property names, and a Date wherever the column holds a point in time
 * (the API sends those as ISO text). Nested JSON columns are left exactly as stored.
 */
export function toRow(table: string | undefined, raw: Record<string, unknown>): Record<string, unknown> {
  const instants = table ? DATE_COLUMNS[table] : undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const name = camel(key)
    out[name] = typeof value === 'string' && instants?.includes(name) ? new Date(value) : value
  }
  return out
}

export const toRows = (table: string | undefined, raw: unknown): Array<Record<string, unknown>> =>
  Array.isArray(raw) ? raw.map((r) => toRow(table, r as Record<string, unknown>)) : []

/** A value written to the API: a Date becomes ISO text. Everything else is sent as it is. */
export function toWire(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toWire)
  return value
}

export const toWireRow = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, toWire(v)]))
