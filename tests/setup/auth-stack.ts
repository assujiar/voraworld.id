import { execFileSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { createServer as createHttpServer, request as httpRequest, type Server } from 'node:http'
import { createServer as createNetServer, type AddressInfo, type Server as NetServer } from 'node:net'
import postgres from 'postgres'
import { admin, adminUrl, withDatabase } from './admin'

/**
 * A real Supabase Auth (GoTrue, the same server hosted Supabase runs) for the tests, in Docker, on its own throw-away database, behind a small
 * gateway that serves it under /auth/v1 exactly where the Supabase client expects it. Nothing here is a stand-in for the behaviour under test:
 * passwords, sessions, refresh, logout and the recovery email all come from GoTrue. Only the mail server is a sink that keeps what GoTrue sends.
 * Needs a running Docker daemon.
 */
export const GOTRUE_IMAGE = 'supabase/gotrue:v2.197.0'

export interface SinkMail { to: string; subject: string; body: string }

export interface AuthStack {
  /** What NEXT_PUBLIC_SUPABASE_URL is in the test: the gateway. */
  url: string
  publishableKey: string
  secretKey: string
  jwtSecret: string
  /** The database GoTrue keeps its `auth` schema in (superuser address), so a test can run VORA's migrations next to it, as on Supabase. */
  databaseUrl: string
  /** Messages GoTrue tried to email (password recovery), newest last. */
  mails: SinkMail[]
  stop(): Promise<void>
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
/** HS256 JWT like the `anon` and `service_role` keys of a Supabase project. */
export function signKey(role: 'anon' | 'service_role', secret: string): string {
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'vora-test', iat: 1_700_000_000, exp: 4_100_000_000 })}`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createNetServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => { const { port } = s.address() as AddressInfo; s.close(() => resolve(port)) })
  })
}

/** Just enough SMTP to receive one message per connection and keep it. */
function mailSink(mails: SinkMail[]): Promise<{ server: NetServer; port: number }> {
  return new Promise((resolve) => {
    const server = createNetServer((socket) => {
      socket.setEncoding('utf8')
      let data = '', mode: 'command' | 'data' = 'command', buffer = '', to = ''
      socket.write('220 sink ESMTP\r\n')
      socket.on('data', (chunk: string) => {
        buffer += chunk
        for (;;) {
          if (mode === 'data') {
            const end = buffer.indexOf('\r\n.\r\n')
            if (end < 0) return
            data = buffer.slice(0, end); buffer = buffer.slice(end + 5); mode = 'command'
            const decoded = data.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
            mails.push({ to, subject: /^Subject: (.*)$/mi.exec(data)?.[1] ?? '', body: decoded })
            socket.write('250 queued\r\n')
            continue
          }
          const nl = buffer.indexOf('\r\n')
          if (nl < 0) return
          const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 2)
          const cmd = line.slice(0, 4).toUpperCase()
          if (cmd === 'EHLO' || cmd === 'HELO') socket.write('250 sink\r\n')
          else if (cmd === 'MAIL') socket.write('250 ok\r\n')
          else if (cmd === 'RCPT') { to = /<([^>]*)>/.exec(line)?.[1] ?? ''; socket.write('250 ok\r\n') }
          else if (cmd === 'DATA') { mode = 'data'; socket.write('354 go ahead\r\n') }
          else if (cmd === 'QUIT') { socket.write('221 bye\r\n'); socket.end(); return }
          else socket.write('250 ok\r\n')
        }
      })
      socket.on('error', () => undefined)
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as AddressInfo).port }))
  })
}

/** Serves GoTrue under /auth/v1 on the gateway port, the way a Supabase project does. */
function gateway(gotruePort: number, port: number, mails: SinkMail[]): Promise<Server> {
  return new Promise((resolve) => {
    const server = createHttpServer((req, res) => {
      // Test-only: lets a test worker read (GET) or clear (DELETE) the messages GoTrue tried to send.
      if (req.url === '/__mails') {
        if (req.method === 'DELETE') mails.length = 0
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(mails)); return
      }
      // GoTrue writes the links in its emails as <origin>/verify?...; the hosted service answers them under /auth/v1 too.
      const m = /^\/auth\/v1(\/.*)?$/.exec(req.url ?? '') ?? /^(\/verify(?:\?.*)?)$/.exec(req.url ?? '')
      if (!m) { res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}'); return }
      const upstream = httpRequest({ host: '127.0.0.1', port: gotruePort, path: m[1] || '/', method: req.method, headers: { ...req.headers, host: `127.0.0.1:${gotruePort}` } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      })
      upstream.on('error', () => { res.writeHead(502).end() })
      req.pipe(upstream)
    })
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export async function startAuthStack(): Promise<AuthStack> {
  try { docker('info', '--format', '{{.ServerVersion}}') } catch {
    throw new Error('The sign-in tests run a real Supabase Auth (GoTrue) in Docker: start the Docker daemon first')
  }
  try { docker('image', 'inspect', GOTRUE_IMAGE) } catch { docker('pull', '-q', GOTRUE_IMAGE) }

  const id = randomBytes(4).toString('hex')
  const dbName = `vora_gotrue_${id}`
  const a = admin()
  await a.unsafe(`create database ${dbName}`)
  // The roles a Supabase database has; GoTrue's migrations expect them. Created once per server, shared by every throw-away database.
  await a.unsafe(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
    if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login password 'gotrue' noinherit createrole; end if;
  end $$`)
  await a.end({ timeout: 5 })
  const dbAdmin = postgres(withDatabase(adminUrl(), dbName), { max: 1, onnotice: () => undefined })
  await dbAdmin.unsafe(`create schema if not exists auth authorization supabase_auth_admin; alter role supabase_auth_admin set search_path = auth; grant usage on schema auth to anon, authenticated, service_role`)
  await dbAdmin.end({ timeout: 5 })

  const jwtSecret = randomBytes(32).toString('hex')
  const gotruePort = await freePort()
  const gatewayPort = await freePort()
  const mails: SinkMail[] = []
  const sink = await mailSink(mails)
  const server = new URL(adminUrl())
  const dbHost = server.hostname === 'localhost' ? '127.0.0.1' : server.hostname
  const container = `vora-gotrue-${id}`
  const env: Record<string, string> = {
    GOTRUE_API_HOST: '127.0.0.1', GOTRUE_API_PORT: String(gotruePort), API_EXTERNAL_URL: `http://127.0.0.1:${gatewayPort}/auth/v1`,
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:gotrue@${dbHost}:${server.port || '5432'}/${dbName}?sslmode=disable`, GOTRUE_DB_NAMESPACE: 'auth',
    GOTRUE_SITE_URL: 'http://localhost:3000', GOTRUE_URI_ALLOW_LIST: 'http://localhost:*/**,https://localhost:*/**',
    GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated',
    // The production setting: nobody can register; accounts are created by an administrator.
    GOTRUE_DISABLE_SIGNUP: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'false',
    GOTRUE_SMTP_HOST: '127.0.0.1', GOTRUE_SMTP_PORT: String(sink.port), GOTRUE_SMTP_ADMIN_EMAIL: 'auth@vora.test', GOTRUE_SMTP_SENDER_NAME: 'VORA test',
    GOTRUE_RATE_LIMIT_EMAIL_SENT: '100000', GOTRUE_RATE_LIMIT_TOKEN_REFRESH: '100000', GOTRUE_RATE_LIMIT_VERIFY: '100000', GOTRUE_RATE_LIMIT_OTP: '100000',
    GOTRUE_PASSWORD_MIN_LENGTH: '8',
  }
  const run = ['run', '-d', '--rm', '--name', container, '--network', 'host', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), GOTRUE_IMAGE]
  docker(...run)

  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://127.0.0.1:${gotruePort}/health`)).ok) break } catch { /* starting */ }
    if (i > 120) { const logs = (() => { try { return docker('logs', container) } catch { return '' } })(); throw new Error('GoTrue did not start:\n' + logs.slice(-1500)) }
    await new Promise((r) => setTimeout(r, 250))
  }
  const gw = await gateway(gotruePort, gatewayPort, mails)

  return {
    url: `http://127.0.0.1:${gatewayPort}`,
    publishableKey: signKey('anon', jwtSecret),
    secretKey: signKey('service_role', jwtSecret),
    jwtSecret,
    databaseUrl: withDatabase(adminUrl(), dbName),
    mails,
    async stop() {
      gw.close(); sink.server.close()
      try { docker('rm', '-f', container) } catch { /* already gone */ }
      const b = admin()
      await b.unsafe(`drop database if exists ${dbName} with (force)`)
      await b.end({ timeout: 5 })
    },
  }
}
