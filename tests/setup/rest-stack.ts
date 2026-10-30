import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer as createHttpServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createServer as createNetServer, type AddressInfo } from 'node:net'
import postgres from 'postgres'
import { admin, adminUrl, withDatabase } from './admin'
import { signKey } from './auth-stack'

/**
 * A real PostgREST (the server behind Supabase's Data API and supabase-js `.from()` / `.rpc()`), in Docker, on one database, behind a gateway that
 * serves it under /rest/v1 as a Supabase project does. Everything that is not the Data API (Auth, Storage) is forwarded to the services given.
 * The roles, grants and default privileges are the ones of a Supabase database, so a missing GRANT or REVOKE shows up here and not in production.
 */
export const POSTGREST_IMAGE = 'postgrest/postgrest:v16.5'

export interface RestStack {
  /** What NEXT_PUBLIC_SUPABASE_URL is: Data API under /rest/v1, Auth under /auth/v1, Storage under /storage/v1. */
  url: string
  /** Asks PostgREST to re-read the schema (after a test changed it). */
  reload(): Promise<void>
  stop(): Promise<void>
}

/** The roles of a Supabase project and the default privileges that make a new table or function reachable by them. Idempotent; run before the migrations. */
export async function prepareSupabaseRoles(databaseUrl: string): Promise<void> {
  const a = admin()
  await a.unsafe(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login password 'authenticator' noinherit; end if;
  end $$`)
  await a.unsafe(`grant anon, authenticated, service_role to authenticator`)
  await a.end({ timeout: 5 })
  const db = postgres(databaseUrl, { max: 1, onnotice: () => undefined })
  // What Supabase sets up in every project's public schema: everything new is reachable by the API roles until a migration takes it away.
  await db.unsafe(`grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role`)
  await db.end({ timeout: 5 })
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createNetServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => { const { port } = s.address() as AddressInfo; s.close(() => resolve(port)) })
  })
}

function forward(req: IncomingMessage, res: ServerResponse, host: string, port: number, path: string): void {
  const upstream = httpRequest({ host, port, path, method: req.method, headers: { ...req.headers, host: `${host}:${port}` } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
  req.pipe(upstream)
}

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export interface RestOptions {
  /** Name of the (already created and prepared) database PostgREST serves. */
  database: string
  jwtSecret: string
  /** The Auth stack's gateway: every path that is not the Data API or Storage goes there. */
  authUrl: string
  /** A Storage service (port on 127.0.0.1) to serve under /storage/v1, if the test needs one. */
  storagePort?: number
}

export async function startRest({ database, jwtSecret, authUrl, storagePort }: RestOptions): Promise<RestStack> {
  try { docker('image', 'inspect', POSTGREST_IMAGE) } catch { docker('pull', '-q', POSTGREST_IMAGE) }
  const id = randomBytes(4).toString('hex')
  const container = `vora-rest-${id}`
  const restPort = await freePort()
  const server = new URL(adminUrl())
  const dbHost = server.hostname === 'localhost' ? '127.0.0.1' : server.hostname
  const env: Record<string, string> = {
    PGRST_DB_URI: `postgres://authenticator:authenticator@${dbHost}:${server.port || '5432'}/${database}`,
    PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: jwtSecret,
    PGRST_DB_MAX_ROWS: '1000',                                   // Supabase's default: a list longer than this is silently cut, so the code must page
    PGRST_DB_POOL: '4', PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(restPort),
    PGRST_LOG_LEVEL: 'warn',
  }
  docker('run', '-d', '--rm', '--name', container, '--network', 'host', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), POSTGREST_IMAGE)

  const anon = signKey('anon', jwtSecret)
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://127.0.0.1:${restPort}/`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })).status < 500) break } catch { /* starting */ }
    if (i > 200) {
      const logs = (() => { try { return docker('logs', container) } catch { return '' } })()
      try { docker('rm', '-f', container) } catch { /* gone */ }
      throw new Error('PostgREST did not start:\n' + logs.slice(-1500))
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  const auth = new URL(authUrl)
  const gatewayPort = await freePort()
  const gw: Server = createHttpServer((req, res) => {
    const url = req.url ?? '/'
    const rest = /^\/rest\/v1(\/.*)?$/.exec(url)
    if (rest) return forward(req, res, '127.0.0.1', restPort, rest[1] || '/')
    if (storagePort && /^\/storage\/v1(\/|\?|$)/.test(url)) return forward(req, res, '127.0.0.1', storagePort, url)
    forward(req, res, auth.hostname, Number(auth.port), url)
  })
  await new Promise<void>((resolve) => gw.listen(gatewayPort, '127.0.0.1', () => resolve()))

  return {
    url: `http://127.0.0.1:${gatewayPort}`,
    async reload() {
      const a = admin()
      await a.unsafe(`select pg_notify('pgrst', 'reload schema')`)
      await a.end({ timeout: 5 })
      await new Promise((r) => setTimeout(r, 400))
    },
    async stop() {
      gw.close()
      try { docker('rm', '-f', container) } catch { /* already gone */ }
    },
  }
}

/** Removes containers a crashed run left behind. */
export function removeStrayContainers(): void {
  try {
    const ids = docker('ps', '-aq', '--filter', 'name=vora-rest-')
    if (ids) docker('rm', '-f', ...ids.split('\n'))
  } catch { /* no docker or nothing to remove */ }
}

export { withDatabase }
