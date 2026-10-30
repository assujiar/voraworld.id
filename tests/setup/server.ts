import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { join } from 'node:path'
import postgres, { type Sql } from 'postgres'
import { runMigrations } from '../../scripts/lib/migrations'
import type { AddressInfo } from 'node:net'
import { fakeStorage, storageUrl } from '../http/fake-storage'
import { admin, adminUrl, withDatabase } from './admin'
import { startAuthStack, type AuthStack } from './auth-stack'
import { prepareSupabaseRoles, startRest, type RestStack } from './rest-stack'
import { ensureAuthAccount } from '../helpers/auth'

export interface TestServer {
  /** Where tests send requests, e.g. http://localhost:3210 */
  base: string
  databaseUrl: string
  storageUrl: string
  storageKey: string
  cronSecret: string
  /** The Supabase Auth (GoTrue) this server signs people in with. */
  auth: AuthStack
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
  seed?: (db: Sql, auth: AuthStack) => Promise<void>
}

/** A portal account: a real Supabase Auth account (confirmed, as from the dashboard) plus its row in public.users. */
export async function addPortalAccount(db: Sql, auth: AuthStack, email: string, password: string, role = 'admin'): Promise<number> {
  const authId = await ensureAuthAccount(email, password, { url: auth.url, secretKey: auth.secretKey })
  const [u] = await db`insert into users (email, role, auth_user_id, active) values (${email}, ${role}, ${authId}, true)
                       on conflict (email) do update set role = excluded.role, auth_user_id = excluded.auth_user_id, active = true returning id`
  return u.id as number
}

/**
 * A real production-mode server (`next start` on the existing build) on a fresh database that was built only from
 * migrations/, with a stand-in for Supabase Storage. Shared by the HTTP suite and the browser suite.
 */
export async function startTestServer({ port, prefix, publicBaseUrl, seed }: StartOptions): Promise<TestServer> {
  const name = `${prefix}_${randomBytes(4).toString('hex')}`
  const auth = await startAuthStack()
  const a = admin()
  await a.unsafe(`create database ${name}`)
  await a.end({ timeout: 5 })
  const databaseUrl = withDatabase(adminUrl(), name)
  await prepareSupabaseRoles(databaseUrl)                        // the roles and default privileges of a Supabase project, before the migrations
  const db = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    await runMigrations(db, { apply: true })
    if (seed) await seed(db, auth)
  } finally {
    await db.end({ timeout: 5 })
  }

  const storage: Server = await fakeStorage(auth.secretKey)      // the project's one secret key opens both Auth admin and Storage, as on Supabase
  // The Data API: a real PostgREST on this database, behind one address that also reaches Auth and Storage, as a Supabase project's address does.
  const rest: RestStack = await startRest({ database: name, jwtSecret: auth.jwtSecret, authUrl: auth.url, storagePort: (storage.address() as AddressInfo).port })
  const base = `http://localhost:${port}`
  const cronSecret = 'c'.repeat(40)
  const env = {
    ...process.env,
    NODE_ENV: 'production' as const,
    PUBLIC_BASE_URL: publicBaseUrl ?? base,
    NEXT_PUBLIC_SUPABASE_URL: rest.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: auth.publishableKey,
    SUPABASE_SECRET_KEY: auth.secretKey,
    MAIL_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    CRON_SECRET: cronSecret,
  }
  // Run Next directly (not through npx) so SIGTERM reaches the server itself and nothing is left running.
  const proc: ChildProcess = spawn(process.execPath, [join(process.cwd(), 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  const keep = (d: Buffer) => { log += d; if (process.env.E2E_SERVER_LOG) process.stderr.write(d) }       // E2E_SERVER_LOG=1 shows what the server under test prints
  proc.stdout?.on('data', keep)
  proc.stderr?.on('data', keep)

  const stop = async () => {
    proc.kill('SIGTERM')
    await rest.stop()
    storage.close()
    await auth.stop()
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
  return { base, databaseUrl, storageUrl: storageUrl(storage), storageKey: auth.secretKey, cronSecret, auth, stop }
}
