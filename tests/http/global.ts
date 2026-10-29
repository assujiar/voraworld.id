import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { runMigrations } from '../../scripts/lib/migrations'
import { admin, adminUrl, withDatabase } from '../setup/admin'

let server: ChildProcess | undefined
const name = `vora_http_${randomBytes(4).toString('hex')}`

export default async function setup() {
  const port = 3200 + Math.floor(Math.random() * 500)
  const a = admin()
  await a.unsafe(`create database ${name}`)
  await a.end({ timeout: 5 })
  const db = postgres(withDatabase(adminUrl(), name), { max: 1, onnotice: () => {} })
  await runMigrations(db, { apply: true })
  await db.end({ timeout: 5 })

  const env = {
    ...process.env,
    NODE_ENV: 'production' as const,
    DATABASE_URL: withDatabase(adminUrl(), name),
    PUBLIC_BASE_URL: `http://localhost:${port}`,
    SESSION_SECRET: 'http-test-secret-that-is-long-enough-0123456789abcdef',
    MAIL_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    CRON_SECRET: 'c'.repeat(40),
    VORA_LOCAL_STORAGE_DIR: `/tmp/vora-http-${name}`,
  }
  const proc = spawn('npx', ['next', 'start', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  server = proc
  let log = ''
  proc.stdout?.on('data', (d) => (log += d))
  proc.stderr?.on('data', (d) => (log += d))
  const base = `http://localhost:${port}`
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/robots.txt`)).ok) break } catch { /* not up yet */ }
    if (proc.exitCode !== null) throw new Error('next start exited early:\n' + log)
    await new Promise((r) => setTimeout(r, 500))
  }
  process.env.HTTP_BASE_URL = base
  process.env.HTTP_DATABASE_URL = env.DATABASE_URL
  process.env.HTTP_CRON_SECRET = env.CRON_SECRET
  return async () => {
    server?.kill('SIGTERM')
    const b = admin()
    await b.unsafe(`drop database if exists ${name} with (force)`)
    await b.end({ timeout: 5 })
  }
}
