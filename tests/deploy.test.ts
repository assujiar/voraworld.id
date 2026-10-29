import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? (n === 'node_modules' || n === '.next' ? [] : walk(p)) : [p]
})
/** Set by the platform, never by the person deploying. */
const PLATFORM = new Set(['NODE_ENV', 'VERCEL', 'NEXT_RUNTIME'])

function variablesRead(roots: string[]): Set<string> {
  const found = new Set<string>()
  for (const root of roots) for (const f of existsSync(root) && statSync(root).isDirectory() ? walk(root) : [root]) {
    if (!/\.(ts|tsx|mts|js|mjs)$/.test(f)) continue
    for (const m of read(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) found.add(m[1])
  }
  return found
}
const documented = () => new Set([...read('.env.example').matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]))

describe('.env.example', () => {
  it('documents every variable the application, the scripts and the database test setup read', () => {
    const missing = [...variablesRead(['src', 'scripts', 'tests/setup', 'next.config.ts'])].filter((v) => !PLATFORM.has(v) && !documented().has(v))
    expect(missing).toEqual([])
  })
  it('lists nothing the code never reads (stale entries mislead the person deploying)', () => {
    const read_ = variablesRead(['src', 'scripts', 'tests', 'next.config.ts'])
    expect([...documented()].filter((v) => !read_.has(v))).toEqual([])
  })
  it('holds no real secret: secrets are blank or obvious placeholders, and the session secret placeholder is refused in production', () => {
    const lines = Object.fromEntries([...read('.env.example').matchAll(/^([A-Z][A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2]]))
    for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'MAIL_ENCRYPTION_KEY', 'CRON_SECRET', 'SUPABASE_URL']) expect(lines[k], k).toBe('')
    expect(lines.SESSION_SECRET).toMatch(/^replace-/)
    expect(lines.DATABASE_URL).toMatch(/localhost/)
    expect(read('.env.example')).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]{10,}|postgres\.[a-z]{20}/)
  })
  it('explains how to generate the encryption key in the format the code expects (32 random bytes, base64)', () => {
    expect(read('.env.example')).toContain('openssl rand -base64 32')
  })
})

describe('vercel.json', () => {
  const config = JSON.parse(read('vercel.json'))
  it('uses the zero-config Next.js project settings (no legacy builds/routes that switch them off)', () => {
    expect(config.framework).toBe('nextjs')
    for (const legacy of ['builds', 'routes', 'version', 'functions', 'rewrites']) expect(config, legacy).not.toHaveProperty(legacy)
  })
  it('schedules one daily retry of queued email, against a route that exists and requires the cron secret', () => {
    expect(config.crons).toEqual([{ path: '/internal/mail/dispatch', schedule: '0 3 * * *' }])
    expect(config.crons[0].schedule.split(' ')).toHaveLength(5)
    const route = read('src/app/internal/mail/dispatch/route.ts')
    expect(route).toContain('CRON_SECRET'); expect(route).toContain('401')
  })
  it('gives the routes that render PDFs and send mail more than the default run time', () => {
    for (const f of ['src/app/(admin)/layout.tsx', 'src/app/(docs)/layout.tsx', 'src/app/(site)/[locale]/layout.tsx', 'src/app/internal/mail/dispatch/route.ts']) expect(read(f), f).toMatch(/export const maxDuration = \d+/)
  })
})

describe('package.json', () => {
  const pkg = JSON.parse(read('package.json'))
  it('pins every dependency to an exact version', () => {
    for (const section of ['dependencies', 'devDependencies']) for (const [name, range] of Object.entries(pkg[section] as Record<string, string>)) expect(range, `${section}.${name}`).toMatch(/^\d+\.\d+\.\d+$/)
  })
  it('needs a Node version Next.js supports and exposes the scripts the guides name', () => {
    expect(pkg.engines.node).toMatch(/>=20\.9/)
    for (const s of ['dev', 'build', 'start', 'test', 'test:http', 'db:migrate', 'users', 'build:setup-sql', 'gen:schema', 'typecheck']) expect(pkg.scripts[s], s).toBeTruthy()
  })
  it('keeps test tooling out of the runtime dependencies, and the PDF/QR/mail libraries in', () => {
    for (const d of ['next', 'react', 'react-dom', 'postgres', 'pdf-lib', 'unpdf', 'qrcode', 'nodemailer', 'sanitize-html']) expect(pkg.dependencies, d).toHaveProperty(d)
    for (const d of ['vitest', '@playwright/test', 'typescript', 'tsx']) expect(pkg.dependencies, d).not.toHaveProperty(d)
  })
})

describe('repository hygiene', () => {
  const tracked = (() => { try { return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean) } catch { return null } })()
  it('tracks no environment file, key, dump or archive', () => {
    if (!tracked) return
    expect(tracked.filter((f) => /(^|\/)\.env(\..*)?$/.test(f) && f !== '.env.example')).toEqual([])
    expect(tracked.filter((f) => /\.(pem|key|p12|pfx|zip|tar|gz|dump|bak)$/i.test(f))).toEqual([])
    expect(tracked.filter((f) => /^(\.local-storage|\.next|node_modules)\//.test(f))).toEqual([])
  })
  it('ignores local secrets and build output', () => {
    const ignore = read('.gitignore')
    for (const entry of ['.env', '.env.*', '!.env.example', 'node_modules/', '.next/', '.vercel/']) expect(ignore).toContain(entry)
  })
  it('contains no leftover Python runtime', () => {
    if (!tracked) return
    expect(tracked.filter((f) => /\.py$|^requirements.*\.txt$|^Dockerfile$|^pytest\.ini$|^\.python-version$/.test(f))).toEqual([])
  })
})
