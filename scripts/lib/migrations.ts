import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres, { type Sql } from 'postgres'

export const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'migrations')

export interface Migration {
  name: string
  number: string
  sql: string
  sha256: string
}

export function readMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((name) => {
      const sqlText = readFileSync(join(dir, name), 'utf8')
      return { name, number: name.slice(0, 4), sql: sqlText, sha256: createHash('sha256').update(readFileSync(join(dir, name))).digest('hex') }
    })
}

export function connectionUrl(raw = process.env.DATABASE_URL || ''): string {
  if (!/^postgres(ql)?:\/\//.test(raw)) throw new Error('DATABASE_URL must be a PostgreSQL URL')
  return raw
}

export interface RunOptions {
  apply?: boolean
  baseline?: string
  log?: (line: string) => void
}

/** Same behaviour as the former Python runner: ordered, recorded, dry-run by default, refuses unknown databases. */
export async function runMigrations(sql: Sql, opts: RunOptions = {}): Promise<{ applied: string[]; pending: string[]; baselined: string[] }> {
  const log = opts.log ?? (() => {})
  const files = readMigrations()
  if (!files.length) throw new Error('No migrations found')
  const out = { applied: [] as string[], pending: [] as string[], baselined: [] as string[] }
  const tracked = (await sql`select to_regclass('public.schema_migrations') is not null as ok`)[0].ok as boolean
  if (!tracked) {
    const populated = (await sql`select to_regclass('public.users') is not null as ok`)[0].ok as boolean
    if (populated && !opts.baseline) {
      throw new Error('Database already has VORA tables but no schema_migrations record. Check which migrations it contains, then re-run with --baseline NNNN.')
    }
    if (opts.apply || opts.baseline) {
      await sql`create table schema_migrations (name text primary key, sha256 text not null, applied_at timestamptz not null default now())`
      await sql`alter table schema_migrations enable row level security`
    }
  }
  const done = new Map<string, string>()
  if (tracked || opts.apply || opts.baseline) {
    for (const row of await sql`select name, sha256 from schema_migrations`) done.set(row.name as string, row.sha256 as string)
  }
  for (const file of files) {
    if (done.has(file.name)) {
      if (done.get(file.name) !== file.sha256) log(`WARNING ${file.name} changed since it was applied`)
      continue
    }
    if (opts.baseline && file.number <= opts.baseline) {
      await sql`insert into schema_migrations (name, sha256) values (${file.name}, ${file.sha256})`
      out.baselined.push(file.name); log(`baselined ${file.name}`)
      continue
    }
    if (!opts.apply) { out.pending.push(file.name); log(`pending  ${file.name}`); continue }
    await sql.begin(async (t) => {
      await t.unsafe(file.sql)
      await t`insert into schema_migrations (name, sha256) values (${file.name}, ${file.sha256})`
    })
    out.applied.push(file.name); log(`applied  ${file.name}`)
  }
  return out
}

export function openSql(url = connectionUrl(), max = 1): Sql {
  return postgres(url, { prepare: false, max, onnotice: () => {} })
}
