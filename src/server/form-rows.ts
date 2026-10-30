/**
 * The rows of an editable table (client component ItemsTable) arrive as repeated fields: `item_description`, `item_quantity`, ... one value per
 * row, in row order. This puts them back together. A value longer than `max` is cut at `max + 1`, so that the service refuses it instead of
 * quietly keeping a shortened text.
 */
export function rowsFromForm<K extends string>(form: FormData, prefix: string, columns: Record<K, number>): Array<Record<K, string>> {
  const names = Object.keys(columns) as K[]
  const lists = names.map((c) => form.getAll(`${prefix}_${c}`).map((v) => (typeof v === 'string' ? v.replaceAll('\u0000', '') : '')))
  const count = Math.min(Math.max(0, ...lists.map((l) => l.length)), 300)
  return Array.from({ length: count }, (_, i) => Object.fromEntries(names.map((c, k) => [c, (lists[k][i] ?? '').slice(0, columns[c] + 1)])) as Record<K, string>)
}
