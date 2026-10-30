import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { build } from '../scripts/build-manual-setup'
import { readMigrations, runMigrations } from '../scripts/lib/migrations'
import { sql } from './helpers/db'
import { admin, adminUrl, withDatabase } from './setup/admin'

const SETUP = readFileSync('SUPABASE_MANUAL_SETUP.sql', 'utf8')
const VERIFY = readFileSync('SUPABASE_VERIFICATION.sql', 'utf8')
const name = `vora_manual_${randomBytes(5).toString('hex')}`
let db: postgres.Sql | undefined

afterAll(async () => {
  await db?.end({ timeout: 5 })
  const a = admin(); await a.unsafe(`drop database if exists ${name} with (force)`); await a.end({ timeout: 5 })
})

async function catalog(c: postgres.Sql) {
  const q = (text: string) => c.unsafe(text).then((r) => r.map((x) => JSON.stringify(x)))
  return {
    columns: await q(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name <> 'schema_migrations' order by 1, 2`),
    indexes: await q(`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename <> 'schema_migrations' order by 1`),
    constraints: await q(`select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def from pg_constraint where connamespace = 'public'::regnamespace and conrelid::regclass::text <> 'schema_migrations' order by 1, 2`),
    rls: await q(`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1`),
    seeds: await q(`select 'settings' as t, key, value from settings union all select 'templates', key, subject || html from email_templates union all select 'rules', key, enabled::text from email_rules order by 1, 2`),
  }
}

describe('SUPABASE_MANUAL_SETUP.sql', () => {
  it('is exactly what the builder produces from the migrations (run `npm run build:setup-sql` after adding one)', () => {
    expect(SETUP).toBe(build())
    expect(SETUP).toContain(`migrations/0001..${readMigrations().at(-1)!.number}`)
  })

  it('creates no demo data: no users, customers, invoices or leads', () => {
    const outsideFunctions = SETUP.replace(/\$fn\$[\s\S]*?\$fn\$/g, '')        // the database functions insert rows when they are called, not when the script runs
    expect(outsideFunctions).not.toMatch(/INSERT INTO (users|customers|invoices|leads|payments|receipts|quotations)\b/i)
  })

  it('applied to an EMPTY database gives the same schema, security and seed data as the migrations, and the runner sees nothing left to do', async () => {
    const a = admin(); await a.unsafe(`create database ${name}`); await a.end({ timeout: 5 })
    db = postgres(withDatabase(adminUrl(), name), { max: 1, onnotice: () => {} })
    await db.unsafe(SETUP)
    const raw = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
    try {
      const [fromSetup, fromMigrations] = [await catalog(db), await catalog(raw)]
      for (const key of Object.keys(fromSetup) as Array<keyof typeof fromSetup>) expect(fromSetup[key], key).toEqual(fromMigrations[key])
    } finally { await raw.end({ timeout: 5 }) }
    const status = await runMigrations(db, { apply: false })
    expect(status.pending).toEqual([])
    expect((await db`select count(*)::int as n from schema_migrations`)[0].n).toBe(readMigrations().length)
    expect((await db`select count(*)::int as n from users`)[0].n).toBe(0)
  })

  it('is safe to paste twice by mistake only up to the point where it refuses (it is not meant to be re-run)', async () => {
    await expect(db!.unsafe(SETUP)).rejects.toThrow()          // plain CREATE TABLE: a second run fails instead of damaging data
    await db!.unsafe('ROLLBACK')                                // the failed script leaves its transaction open; a SQL-editor session would end here
    expect((await db!`select count(*)::int as n from schema_migrations`)[0].n).toBe(readMigrations().length)
  })
})

describe('SUPABASE_VERIFICATION.sql', () => {
  const run = async (c: postgres.Sql) => {
    const results = await c.unsafe(VERIFY) as unknown as Array<Record<string, string>> & { length: number }
    const rows = (Array.isArray((results as unknown as Array<unknown>)[0]) ? (results as unknown as Array<Array<Record<string, string>>>).at(-1)! : results) as Array<Record<string, string>>
    return Object.fromEntries(rows.map((r) => [r.check_name, r]))
  }
  it('passes on a database built from the setup script, with only the expected notes', async () => {
    const checks = await run(db!)
    const failing = Object.values(checks).filter((r) => r.status === 'FAIL')
    expect(failing, JSON.stringify(failing)).toEqual([])
    for (const n of ['tables exist', 'row level security enabled on every public table', 'anon/authenticated have no table privileges', 'money columns are 64-bit', 'migration history', 'email templates seeded', 'approved public email', 'approved public address'])
      expect(checks[n]?.status, n).toBe('PASS')
    expect(checks['migration history'].detail).toContain(`${readMigrations().length} migrations recorded`)
    expect(checks['active admin accounts (able to sign in)'].status).toBe('INFO')          // until the first admin is created
    expect(checks['active admin accounts (able to sign in)'].detail).toContain('promote_admin')
    expect(checks['storage buckets'].status).toBe('WARN')                // plain PostgreSQL has no storage schema; Supabase does
  })
  it('notices an unprotected table, a missing seed and a 32-bit money column', async () => {
    await db!.unsafe(`alter table faqs disable row level security; delete from email_templates where key = 'lead_reply'; alter table invoices alter column total_minor type integer`)
    const checks = await run(db!)
    expect(checks['row level security enabled on every public table'].status).toBe('FAIL')
    expect(checks['email templates seeded'].status).toBe('FAIL')
    expect(checks['money columns are 64-bit'].status).toBe('FAIL')
    expect(checks['row level security enabled on every public table'].detail).toContain('faqs')
  })
  it('counts the admins who can sign in, and flags accounts with any other role or without a Supabase Auth account', async () => {
    await db!.unsafe(`alter table invoices alter column total_minor type bigint; alter table faqs enable row level security`)
    await db!`insert into users (email, role, auth_user_id) values ('a@x.invalid', 'admin', gen_random_uuid()), ('b@x.invalid', 'finance', gen_random_uuid()), ('c@x.invalid', 'admin', null)`
    const checks = await run(db!)
    expect(checks['active admin accounts (able to sign in)']).toMatchObject({ status: 'PASS' })
    expect(checks['every admin is linked to a Supabase Auth account'].status).toBe('WARN')
    expect(checks['every account holds the admin role'].status).toBe('WARN')
    expect(checks['no demo/test accounts'].status).toBe('WARN')
  })
})

describe('this suite itself', () => {
  it('runs against a database that has the same number of migrations as the files', async () => {
    expect((await sql`select count(*)::int as n from schema_migrations`)[0].n).toBe(readMigrations().length)
  })
})
