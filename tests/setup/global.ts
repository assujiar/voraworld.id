import { runMigrations } from '../../scripts/lib/migrations'
import postgres from 'postgres'
import { admin, withDatabase, adminUrl } from './admin'

export const TEMPLATE = 'vora_test_template'

/** Builds ONE migrated template database; every test file then clones it in milliseconds. */
export default async function setup() {
  const a = admin()
  await a.unsafe(`drop database if exists ${TEMPLATE} with (force)`)
  await a.unsafe(`create database ${TEMPLATE}`)
  const t = postgres(withDatabase(adminUrl(), TEMPLATE), { max: 1, onnotice: () => {} })
  try {
    await runMigrations(t, { apply: true })
  } finally {
    await t.end({ timeout: 5 })
  }
  await a.end({ timeout: 5 })
  return async () => {
    const b = admin()
    await b.unsafe(`drop database if exists ${TEMPLATE} with (force)`)
    await b.end({ timeout: 5 })
  }
}
