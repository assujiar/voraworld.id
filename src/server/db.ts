import postgres, { type Sql, type TransactionSql } from 'postgres'
import { onVercel } from './env'

export type Db = Sql | TransactionSql

declare global {
  // eslint-disable-next-line no-var
  var __voraSql: Sql | undefined
}

function connect(): Sql {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return postgres(url, {
    // Supabase's transaction pooler (PgBouncer, port 6543) does not support prepared statements.
    prepare: false,
    // A serverless instance handles one request at a time and the Supabase pooler already multiplexes
    // connections, so keep a single connection there instead of hoarding idle ones.
    max: onVercel() ? 1 : Number(process.env.DB_POOL_MAX || 10),
    idle_timeout: 20,
    connect_timeout: 15,
    // Return camelCase properties; `sql(obj)` helpers write snake_case columns.
    transform: { column: { to: postgres.fromCamel, from: postgres.toCamel } },
    // Money columns are bigint (8 bytes). Return them as JS numbers: IDR amounts stay far below 2^53.
    types: { bigint: { to: 20, from: [20], parse: (x: string) => Number(x), serialize: (x: unknown) => String(x) } },
    // Never log server notices (they can contain row data).
    onnotice: () => {},
  })
}

/** Lazily created, shared across hot reloads and across requests of one serverless instance. */
export function getSql(): Sql {
  if (!globalThis.__voraSql) globalThis.__voraSql = connect()
  return globalThis.__voraSql
}

/** `sql` proxy so callers can write sql`select …` without calling getSql() everywhere. */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_t, _this, args) => (getSql() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const target = getSql() as unknown as Record<string | symbol, unknown>
    const value = target[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
  },
}) as Sql

export async function closeSql(): Promise<void> {
  if (globalThis.__voraSql) {
    await globalThis.__voraSql.end({ timeout: 5 })
    globalThis.__voraSql = undefined
  }
}

/** Runs `fn` in a transaction. Rows locked with `for update` stay locked until it returns. */
export async function tx<T>(fn: (t: TransactionSql) => Promise<T>): Promise<T> {
  return (await getSql().begin(fn)) as T
}
