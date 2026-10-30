import postgres, { type Sql } from 'postgres'

/**
 * Direct SQL on this test file's database, for the test code only: it prepares fixtures and checks what the application really stored.
 * The application itself never opens a database connection; it reaches the database through the Data API (supabase-js), which is what
 * the tests exercise. The camelCase column names and numeric money columns match what the application receives.
 */
declare global {
  // eslint-disable-next-line no-var
  var __voraTestSql: Sql | undefined
}

function connect(): Sql {
  const url = ((globalThis as Record<string, unknown>).__voraTestDatabaseUrl ?? process.env.HTTP_DATABASE_URL) as string | undefined
  if (!url) throw new Error('The test database is not set up: is tests/setup/per-file.ts loaded?')
  return postgres(url, {
    prepare: false, max: 5, idle_timeout: 20, onnotice: () => {},
    transform: { column: { to: postgres.fromCamel, from: postgres.toCamel } },
    types: { bigint: { to: 20, from: [20], parse: (x: string) => Number(x), serialize: (x: unknown) => String(x) } },
  })
}

export const getSql = (): Sql => (globalThis.__voraTestSql ??= connect())
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_t, _this, args) => (getSql() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const target = getSql() as unknown as Record<string | symbol, unknown>
    const value = target[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
  },
}) as Sql
export const closeTestSql = async () => { if (globalThis.__voraTestSql) { await globalThis.__voraTestSql.end({ timeout: 5 }); globalThis.__voraTestSql = undefined } }
