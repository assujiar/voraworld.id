import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import postgres from 'postgres'
import { runMigrations } from '../../scripts/lib/migrations'
import { admin, adminUrl, withDatabase } from '../setup/admin'

let server: ChildProcess | undefined
let storage: Server | undefined
const STORAGE_KEY = 'sb_secret_httpTestKey_0123456789abcdef'

/**
 * A stand-in for Supabase Storage that enforces the rules the real service enforces and that this code has to respect:
 * a new-style `sb_secret_` key is accepted in `apikey` only (never as a Bearer token: "Invalid JWT"), private buckets need
 * the key, only the media bucket is publicly readable, and an upload never overwrites (`x-upsert: false`).
 */
function fakeStorage(): Promise<Server> {
  const objects = new Map<string, { type: string; body: Buffer }>()
  const server = createServer((req, res) => {
    const reply = (status: number, body: string, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(body) }
    const m = /^\/storage\/v1\/object\/(public\/)?([^/]+)\/(.+)$/.exec(new URL(req.url!, 'http://x').pathname)
    if (!m) return reply(404, '{"message":"not found"}')
    const [, pub, bucket, key] = m
    const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1]
    if (pub) {
      const o = bucket === 'vora-media' ? objects.get(`${bucket}/${key}`) : undefined
      return o ? reply(200, o.body as unknown as string, o.type) : reply(400, '{"message":"Bucket not found"}')
    }
    if (bearer && !bearer.startsWith('eyJ')) return reply(401, '{"message":"Invalid JWT"}')
    if (req.headers.apikey !== STORAGE_KEY) return reply(401, '{"message":"Invalid API key"}')
    if (req.method === 'POST') {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        if (objects.has(`${bucket}/${key}`) && req.headers['x-upsert'] !== 'true') return reply(409, '{"message":"The resource already exists"}')
        objects.set(`${bucket}/${key}`, { type: String(req.headers['content-type'] ?? 'application/octet-stream'), body: Buffer.concat(chunks) })
        reply(200, JSON.stringify({ Key: `${bucket}/${key}` }))
      })
      return
    }
    const o = objects.get(`${bucket}/${key}`)
    return o ? reply(200, o.body as unknown as string, o.type) : reply(404, '{"message":"Object not found"}')
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}
const name = `vora_http_${randomBytes(4).toString('hex')}`

export default async function setup() {
  const port = 3200 + Math.floor(Math.random() * 500)
  const a = admin()
  await a.unsafe(`create database ${name}`)
  await a.end({ timeout: 5 })
  const db = postgres(withDatabase(adminUrl(), name), { max: 1, onnotice: () => {} })
  await runMigrations(db, { apply: true })
  await db.end({ timeout: 5 })

  storage = await fakeStorage()
  const storageUrl = `http://127.0.0.1:${(storage.address() as AddressInfo).port}`
  const env = {
    ...process.env,
    NODE_ENV: 'production' as const,
    DATABASE_URL: withDatabase(adminUrl(), name),
    PUBLIC_BASE_URL: `http://localhost:${port}`,
    SESSION_SECRET: 'http-test-secret-that-is-long-enough-0123456789abcdef',
    MAIL_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    CRON_SECRET: 'c'.repeat(40),
    SUPABASE_URL: storageUrl,
    SUPABASE_SERVICE_ROLE_KEY: STORAGE_KEY,
  }
  // Run Next directly (not through npx) so SIGTERM reaches the server itself and nothing is left running.
  const proc = spawn(process.execPath, [join(process.cwd(), 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
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
  process.env.HTTP_SESSION_SECRET = env.SESSION_SECRET
  process.env.HTTP_SUPABASE_URL = storageUrl
  process.env.HTTP_SUPABASE_KEY = STORAGE_KEY
  return async () => {
    server?.kill('SIGTERM')
    storage?.close()
    const b = admin()
    await b.unsafe(`drop database if exists ${name} with (force)`)
    await b.end({ timeout: 5 })
  }
}
