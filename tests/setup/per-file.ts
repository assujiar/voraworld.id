import { randomBytes } from 'node:crypto'
import { afterAll, inject } from 'vitest'
import { admin, adminUrl, withDatabase } from './admin'
import { TEMPLATE } from './global'
import { startRest } from './rest-stack'

// Each test file gets its own database cloned from the migrated template, so files can run in parallel and
// never see each other's rows. DATABASE_URL is set before any application module is imported.
const name = `vora_t_${randomBytes(6).toString('hex')}`
const a = admin()
await a.unsafe(`create database ${name} template ${TEMPLATE}`)
await a.end({ timeout: 5 })
process.env.DATABASE_URL = withDatabase(adminUrl(), name)
// The same database for the test code itself, which reads and prepares rows directly (tests/helpers/db.ts).
;(globalThis as Record<string, unknown>).__voraTestDatabaseUrl = process.env.DATABASE_URL

// Its own Data API: a real PostgREST on this file's database, in front of the shared Supabase Auth (see rest-stack.ts).
const rest = await startRest({ database: name, jwtSecret: inject('authJwtSecret'), authUrl: inject('authUrl') })
process.env.NEXT_PUBLIC_SUPABASE_URL = rest.url

afterAll(async () => {
  await rest.stop()
  try {
    const { closeTestSql } = await import('../helpers/db')
    await closeTestSql()
  } catch { /* module may never have been loaded */ }
  const b = admin()
  await b.unsafe(`drop database if exists ${name} with (force)`)
  await b.end({ timeout: 5 })
})
