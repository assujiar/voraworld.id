import { describe, expect, it } from 'vitest'
import { readMigrations } from '../scripts/lib/migrations'
import { sql } from './helpers/db'
import { EVENTS, EVENT_KEYS } from '@/server/mail/events'

describe('migrations', () => {
  it('are numbered contiguously from 0001', () => {
    const numbers = readMigrations().map((m) => Number(m.number))
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
  })

  it('produce RLS-protected tables and seeded settings in a fresh database', async () => {
    const [{ unprotected }] = await sql`select count(*)::int as unprotected from pg_tables where schemaname = 'public' and not rowsecurity`
    expect(unprotected).toBe(0)
    const settings = await sql`select key, value from settings where key in ('email', 'address') order by key`
    expect(settings.map((r) => r.key)).toEqual(['address', 'email'])
  })
})

describe('seeded email templates', () => {
  it('equal, on a database built only from the migrations, the wording the code defines (0008/0009 seeded older text; 0018 aligns it)', async () => {
    const rows = await sql`select key, subject, html from email_templates order by key`
    expect(rows.map((r) => r.key)).toEqual([...EVENT_KEYS].sort())
    for (const r of rows) expect({ subject: r.subject, html: r.html }, r.key as string).toEqual(EVENTS[r.key as string])
    expect((await sql`select key from email_rules where enabled`).length).toBe(0)       // every notification starts switched off
  })
})

describe('generated row types', () => {
  it('match the migrated database (run `npm run gen:schema` after changing migrations)', async () => {
    const { readFileSync } = await import('node:fs')
    const { renderSchemaTypes } = await import('../scripts/lib/schema-types')
    const postgres = (await import('postgres')).default
    const raw = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })  // no camelCase transform: the generator wants column names
    try {
      expect(await renderSchemaTypes(raw)).toBe(readFileSync('src/server/schema.ts', 'utf8'))
    } finally {
      await raw.end({ timeout: 5 })
    }
  })
})
