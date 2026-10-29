/** Regenerates src/server/schema.ts from a freshly migrated database. Run: npm run gen:schema */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { runMigrations } from './lib/migrations'
import { renderSchemaTypes } from './lib/schema-types'

async function main() {
  const admin = process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
  const name = `vora_schema_${Date.now()}`
  const a = postgres(admin, { max: 1, onnotice: () => {} })
  await a.unsafe(`create database ${name}`)
  const u = new URL(admin); u.pathname = '/' + name
  const db = postgres(u.toString(), { max: 1, onnotice: () => {} })
  try {
    await runMigrations(db, { apply: true })
    writeFileSync(resolve(__dirname, '..', 'src/server/schema.ts'), await renderSchemaTypes(db))
    console.log('wrote src/server/schema.ts')
  } finally {
    await db.end({ timeout: 5 })
    await a.unsafe(`drop database if exists ${name} with (force)`)
    await a.end({ timeout: 5 })
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
