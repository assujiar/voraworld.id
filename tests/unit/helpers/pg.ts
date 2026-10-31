import { randomBytes } from 'node:crypto'
import postgres, { type Sql } from 'postgres'
import { runMigrations } from '../../../scripts/lib/migrations'

/**
 * A throw-away database migrated from scratch, for tests of the SQL itself. It needs a local PostgreSQL (TEST_DATABASE_ADMIN_URL, default localhost:5432)
 * but, unlike the suites in tests/*.test.ts, neither Docker nor PostgREST: the functions are called as SQL, as the Data API would call them.
 */
const ADMIN = process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'

export async function postgresAvailable(): Promise<boolean> {
  const a = postgres(ADMIN, { max: 1, onnotice: () => {}, connect_timeout: 3 })
  try { await a`select 1`; return true } catch { return false } finally { await a.end({ timeout: 2 }).catch(() => undefined) }
}

export async function freshDatabase(): Promise<{ sql: Sql; url: string; drop: () => Promise<void> }> {
  const name = `vora_u_${randomBytes(5).toString('hex')}`
  const a = postgres(ADMIN, { max: 1, onnotice: () => {} })
  await a.unsafe(`create database ${name}`)
  await a.unsafe(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$`)
  const u = new URL(ADMIN); u.pathname = '/' + name
  const sql = postgres(u.toString(), { max: 2, onnotice: () => {} })
  await sql.unsafe(`grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role`)
  await runMigrations(sql, { apply: true })
  return { sql, url: u.toString(), drop: async () => { await sql.end({ timeout: 5 }); await a.unsafe(`drop database if exists ${name} with (force)`); await a.end({ timeout: 5 }) } }
}
