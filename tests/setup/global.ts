import { runMigrations } from '../../scripts/lib/migrations'
import postgres from 'postgres'
import { admin, withDatabase, adminUrl } from './admin'
import { startAuthStack } from './auth-stack'
import { prepareSupabaseRoles, removeStrayContainers } from './rest-stack'

export const TEMPLATE = 'vora_test_template'

declare module 'vitest' {
  export interface ProvidedContext { authDatabaseUrl: string; authUrl: string; authJwtSecret: string }
}

/** Builds ONE migrated template database; every test file then clones it in milliseconds. */
export default async function setup({ provide }: { provide: (key: 'authDatabaseUrl' | 'authUrl' | 'authJwtSecret', value: string) => void }) {
  const a = admin()
  await a.unsafe(`drop database if exists ${TEMPLATE} with (force)`)
  await a.unsafe(`create database ${TEMPLATE}`)
  await prepareSupabaseRoles(withDatabase(adminUrl(), TEMPLATE))      // the roles and default privileges of a Supabase project, before the first migration
  const t = postgres(withDatabase(adminUrl(), TEMPLATE), { max: 1, onnotice: () => {} })
  try {
    await runMigrations(t, { apply: true })
  } finally {
    await t.end({ timeout: 5 })
  }
  await a.end({ timeout: 5 })
  // A real Supabase Auth for the whole run: workers inherit these when they start.
  const auth = await startAuthStack()
  process.env.NEXT_PUBLIC_SUPABASE_URL = auth.url
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = auth.publishableKey
  process.env.SUPABASE_SECRET_KEY = auth.secretKey
  provide('authDatabaseUrl', auth.databaseUrl)
  provide('authUrl', auth.url)
  provide('authJwtSecret', auth.jwtSecret)
  return async () => {
    removeStrayContainers()
    await auth.stop()
    const b = admin()
    await b.unsafe(`drop database if exists ${TEMPLATE} with (force)`)
    await b.end({ timeout: 5 })
  }
}
