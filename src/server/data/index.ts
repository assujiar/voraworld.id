import type { PostgrestFilterBuilder, PostgrestQueryBuilder } from '@supabase/supabase-js'
import { data } from './client'
import { failure } from './errors'
import { toRow, toRows, toWireRow } from './rows'

export { data } from './client'
export { failure } from './errors'
export { toRow, toRows } from './rows'

/**
 * The Data API as the rest of the server uses it. Reads and plain writes go through supabase-js; every operation that needs more than one
 * statement to stay consistent (locks, numbering, ledgers) is a PostgreSQL function called with `rpc()` (migration 0024).
 *
 * Column names in filters, ordering, select lists and written values are the database's own (snake_case). Rows come back camelCase, with
 * Date objects for points in time, exactly as the SQL driver used to return them.
 */
export type Row = Record<string, unknown>
// The builder's generic types describe a typed database; this code base has none, so the chain is deliberately loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Filter = PostgrestFilterBuilder<any, any, any, any, any, any, any>
/** Adds filters, ordering and limits to a query. Synchronous on purpose: a query builder is a thenable, so awaiting it would run it. */
export type Build = (q: Filter) => Filter

/** Supabase caps a response at 1000 rows by default; a list that may be longer is read in pages of this size. */
export const PAGE = 1000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from_ = (table: string): PostgrestQueryBuilder<any, any, any, any, any> => data().from(table)

async function run<T>(q: PromiseLike<{ data: T | null; error: { code?: string; message: string; details?: string; hint?: string } | null }>): Promise<T | null> {
  const { data: rows, error } = await q
  if (error) throw failure(error)
  return rows
}

/** The first matching row, or undefined. */
export async function one(table: string, build: Build = (q) => q, columns = '*'): Promise<Row | undefined> {
  const rows = await run<unknown[]>(build(from_(table).select(columns)).limit(1) as never)
  return toRows(table, rows)[0]
}

/** Every matching row. Reads page by page when the caller sets no limit, so a long table is never silently cut at 1000 rows. */
export async function many(table: string, build: Build = (q) => q, columns = '*', limit?: number): Promise<Row[]> {
  if (limit !== undefined) return toRows(table, await run<unknown[]>(build(from_(table).select(columns)).limit(limit) as never))
  const out: Row[] = []
  for (let start = 0; ; start += PAGE) {
    const rows = toRows(table, await run<unknown[]>(build(from_(table).select(columns)).range(start, start + PAGE - 1) as never))
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

/** One page of a list: `size` rows starting at row number `from` (0-based). */
export async function slice(table: string, build: Build, columns: string, from: number, size: number): Promise<Row[]> {
  return toRows(table, await run<unknown[]>(build(from_(table).select(columns)).range(from, from + size - 1) as never))
}

/** How many rows match (the database counts them; nothing is transferred). */
export async function count(table: string, build: Build = (q) => q): Promise<number> {
  const { count: n, error } = await (build(from_(table).select('id', { count: 'exact', head: true })) as unknown as PromiseLike<{ count: number | null; error: { code?: string; message: string } | null }>)
  if (error) throw failure(error)
  return n ?? 0
}

/** Inserts one row or several and returns what was stored. A unique violation surfaces as an error with `code === '23505'`. */
export async function insert(table: string, values: Row | Row[]): Promise<Row[]> {
  const list = Array.isArray(values) ? values : [values]
  return toRows(table, await run<unknown[]>(from_(table).insert(list.map(toWireRow)).select() as never))
}

export async function update(table: string, values: Row, build: (q: Filter) => Filter): Promise<Row[]> {
  return toRows(table, await run<unknown[]>(build(from_(table).update(toWireRow(values)) as never).select() as never))
}

export async function upsert(table: string, values: Row | Row[], onConflict: string, ignoreDuplicates = false): Promise<Row[]> {
  const list = Array.isArray(values) ? values : [values]
  return toRows(table, await run<unknown[]>(from_(table).upsert(list.map(toWireRow), { onConflict, ignoreDuplicates }).select() as never))
}

export async function remove(table: string, build: (q: Filter) => Filter): Promise<Row[]> {
  return toRows(table, await run<unknown[]>(build(from_(table).delete() as never).select() as never))
}

/**
 * Calls a database function. `args` use the function's own parameter names (`p_...`). A rule raised inside it (SQLSTATE VR4xx) arrives as an
 * ActionError with that status. The result is returned as the function gave it: a scalar, or JSON (object keys are the ones the function chose).
 */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data: result, error } = await data().rpc(fn, args as never)
  if (error) throw failure(error)
  return result as T
}

/** An RPC result that is a JSON object, as a camelCase row (`table` makes its timestamps Dates). */
export async function rpcRow(fn: string, args: Record<string, unknown> = {}, table?: string): Promise<Row> {
  return toRow(table, await rpc<Record<string, unknown>>(fn, args))
}

/**
 * A text-search pattern for `ilike` in a PostgREST `or()` filter. The pattern's own `%`, `_` and `\` are escaped so they match literally, and the
 * value is double-quoted so commas and parentheses typed by a visitor cannot change the filter.
 */
export function ilikeValue(text: string): string {
  const pattern = '%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  return '"' + pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

const snakeToCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** `%text%` for `.ilike()`, with the pattern's own `%`, `_` and `\` escaped so they match literally. */
export const ilikePattern = (text: string) => '%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

/**
 * Adds columns of a related table to each row (what a SQL join gave): `related` is read once for all rows, by the foreign key in `fk`
 * (camelCase name of the row's property). `columns` maps a related column (snake_case) to the property it is stored under on the row.
 * A row whose foreign key is empty, or whose related row is gone, gets undefined for those properties.
 */
export async function withRelated(rows: Row[], related: string, fk: string, columns: Record<string, string>, key = 'id'): Promise<Row[]> {
  const ids = [...new Set(rows.map((r) => r[fk]).filter((v) => v !== null && v !== undefined))] as Array<string | number>
  if (!ids.length) return rows.map((r) => ({ ...r }))
  const found = new Map<unknown, Row>()
  for (let i = 0; i < ids.length; i += 200) {
    for (const r of await many(related, (q) => q.in(key, ids.slice(i, i + 200)), [key, ...Object.keys(columns)].join(','))) found.set(r[snakeToCamel(key)], r)
  }
  return rows.map((r) => {
    const match = found.get(r[fk])
    return { ...r, ...Object.fromEntries(Object.entries(columns).map(([col, prop]) => [prop, match?.[snakeToCamel(col)]])) }
  })
}

/**
 * The `or()` clause that matches rows whose own text columns, or whose related rows' text columns (found through a foreign key), contain
 * `text` (case-insensitive, wildcards typed by the person match literally). Null when there is nothing to search for:
 * `const clause = await searchClause(q, ['name'])` then `(f) => (clause ? f.or(clause) : f)`.
 */
export async function searchClause(text: string, own: string[], joined: Array<{ table: string; columns: string[]; fk: string }> = []): Promise<string | null> {
  if (!text) return null
  const value = ilikeValue(text)
  const parts = own.map((c) => `${c}.ilike.${value}`)
  for (const j of joined) {
    const ids = (await many(j.table, (f) => f.or(j.columns.map((c) => `${c}.ilike.${value}`).join(',')), 'id', 500)).map((r) => r.id as number)
    if (ids.length) parts.push(`${j.fk}.in.(${ids.join(',')})`)
  }
  return parts.join(',')
}
