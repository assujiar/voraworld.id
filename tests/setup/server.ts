import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { join } from 'node:path'
import postgres, { type Sql } from 'postgres'
import { runMigrations } from '../../scripts/lib/migrations'
import { STORAGE_KEY, fakeStorage, storageUrl } from '../http/fake-storage'
import { admin, adminUrl, withDatabase } from './admin'

export interface TestServer {
  /** Where tests send requests, e.g. http://localhost:3210 */
  base: string
  databaseUrl: string
  storageUrl: string
  storageKey: string
  cronSecret: string
  sessionSecret: string
  /** Stops the server and the storage stand-in and drops the database. */
  stop(): Promise<void>
}

export interface StartOptions {
  port: number
  /** Prefix of the throw-away database name. */
  prefix: string
  /** The origin printed into QR codes and emails. Use https when emails are inspected: the sanitiser drops http:// links. */
  publicBaseUrl?: string
  /** Runs once on the fresh, migrated database before the server starts. */
  seed?: (db: Sql) => Promise<void>
}

/**
 * A real production-mode server (`next start` on the existing build) on a fresh database that was built only from
 * migrations/, with a stand-in for Supabase Storage. Shared by the HTTP suite and the browser suite.
 */
export async function startTestServer({ port, prefix, publicBaseUrl, seed }: StartOptions): Promise<TestServer> {
  const name = `${prefix}_${randomBytes(4).toString('hex')}`
  const a = admin()
  await a.unsafe(`create database ${name}`)
  await a.end({ timeout: 5 })
  const databaseUrl = withDatabase(adminUrl(), name)
  const db = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    await runMigrations(db, { apply: true })
    if (seed) await seed(db)
  } finally {
    await db.end({ timeout: 5 })
  }

  const storage: Server = await fakeStorage()
  const base = `http://localhost:${port}`
  const cronSecret = 'c'.repeat(40)
  const sessionSecret = 'http-test-secret-that-is-long-enough-0123456789abcdef'
  const env = {
    ...process.env,
    NODE_ENV: 'production' as const,
    DATABASE_URL: databaseUrl,
    PUBLIC_BASE_URL: publicBaseUrl ?? base,
    SESSION_SECRET: sessionSecret,
    MAIL_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    CRON_SECRET: cronSecret,
    SUPABASE_URL: storageUrl(storage),
    SUPABASE_SERVICE_ROLE_KEY: STORAGE_KEY,
  }
  // Run Next directly (not through npx) so SIGTERM reaches the server itself and nothing is left running.
  const proc: ChildProcess = spawn(process.execPath, [join(process.cwd(), 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  proc.stdout?.on('data', (d) => (log += d))
  proc.stderr?.on('data', (d) => (log += d))

  const stop = async () => {
    proc.kill('SIGTERM')
    storage.close()
    const b = admin()
    await b.unsafe(`drop database if exists ${name} with (force)`)
    await b.end({ timeout: 5 })
  }

  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/robots.txt`)).ok) break } catch { /* not up yet */ }
    if (proc.exitCode !== null || i >= 120) {
      await stop()
      throw new Error(`next start did not come up on port ${port}:\n${log}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return { base, databaseUrl, storageUrl: storageUrl(storage), storageKey: STORAGE_KEY, cronSecret, sessionSecret, stop }
}
