import { randomBytes } from 'node:crypto'
import { afterAll } from 'vitest'
import { admin, adminUrl, withDatabase } from './admin'
import { TEMPLATE } from './global'

// Each test file gets its own database cloned from the migrated template, so files can run in parallel and
// never see each other's rows. DATABASE_URL is set before any application module is imported.
const name = `vora_t_${randomBytes(6).toString('hex')}`
const a = admin()
await a.unsafe(`create database ${name} template ${TEMPLATE}`)
await a.end({ timeout: 5 })
process.env.DATABASE_URL = withDatabase(adminUrl(), name)

afterAll(async () => {
  try {
    const { closeSql } = await import('../../src/server/db')
    await closeSql()
  } catch { /* module may never have been loaded */ }
  const b = admin()
  await b.unsafe(`drop database if exists ${name} with (force)`)
  await b.end({ timeout: 5 })
})
