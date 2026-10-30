import { afterEach, describe, expect, it } from 'vitest'
import { assertConfig, databaseUrl, maxUploadBytes, publicBaseUrl, supabasePublishableKey, supabaseSecretKey, supabaseUrl } from '@/server/env'

const KEYS = ['APP_ENV', 'NODE_ENV', 'VERCEL', 'DATABASE_URL', 'POSTGRES_URL', 'PUBLIC_BASE_URL', 'NEXT_PUBLIC_APP_URL', 'MAX_UPLOAD_BYTES',
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } })
const set = (o: Record<string, string | undefined>) => { for (const [k, v] of Object.entries(o)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
const good = { APP_ENV: 'production', DATABASE_URL: 'postgresql://u:p@db.example:6543/postgres', PUBLIC_BASE_URL: 'https://voraworld.id', VERCEL: undefined,
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', POSTGRES_URL: undefined, NEXT_PUBLIC_APP_URL: undefined,
  SUPABASE_URL: undefined, SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, SUPABASE_ANON_KEY: undefined, SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }

describe('startup configuration check', () => {
  it('accepts a sound production configuration', () => { set(good); expect(() => assertConfig()).not.toThrow() })
  it('needs a PostgreSQL DATABASE_URL in every environment', () => {
    set({ ...good, DATABASE_URL: undefined }); expect(() => assertConfig()).toThrow('database connection is required')
    set({ ...good, DATABASE_URL: 'mysql://x' }); expect(() => assertConfig()).toThrow('PostgreSQL')
    set({ APP_ENV: 'development', DATABASE_URL: 'postgresql://localhost/x' }); expect(() => assertConfig()).not.toThrow()
  })
  it('requires the final https address in production, because it is printed into every QR code', () => {
    for (const bad of ['http://voraworld.id', 'voraworld.id', 'ftp://x']) { set({ ...good, PUBLIC_BASE_URL: bad }); expect(() => assertConfig(), bad).toThrow('HTTPS PUBLIC_BASE_URL') }
    set({ ...good, PUBLIC_BASE_URL: '' }); expect(() => assertConfig()).not.toThrow()                           // left empty: the permanent domain
    set({ ...good, PUBLIC_BASE_URL: 'http://localhost:3000' }); expect(() => assertConfig()).not.toThrow()      // a production build on a developer machine
    set({ ...good, PUBLIC_BASE_URL: 'http://localhost:3000', VERCEL: '1' }); expect(() => assertConfig()).toThrow('HTTPS PUBLIC_BASE_URL')
    set({ ...good, PUBLIC_BASE_URL: 'http://localhost.evil.example' }); expect(() => assertConfig()).toThrow('HTTPS PUBLIC_BASE_URL')
  })
  it('needs the Supabase project address and publishable key, because sign-in is Supabase Auth', () => {
    set({ ...good, NEXT_PUBLIC_SUPABASE_URL: undefined }); expect(() => assertConfig()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
    set({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined }); expect(() => assertConfig()).toThrow('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    set({ ...good, APP_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: undefined }); expect(() => assertConfig()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })
  it('asks for no application session secret: Supabase Auth owns sessions', () => {
    set(good); expect(() => assertConfig()).not.toThrow()
    expect(process.env.SESSION_SECRET).toBeUndefined()
  })
  it('accepts the names the Vercel Supabase integration already sets', () => {
    set({ ...good, NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, SUPABASE_URL: 'https://abc.supabase.co/rest/v1/', SUPABASE_ANON_KEY: 'legacy-anon' })
    expect(() => assertConfig()).not.toThrow()
    expect(supabaseUrl()).toBe('https://abc.supabase.co')            // a value pasted with a path still works
    expect(supabasePublishableKey()).toBe('legacy-anon')
    set({ SUPABASE_SERVICE_ROLE_KEY: 'legacy-secret', SUPABASE_SECRET_KEY: undefined }); expect(supabaseSecretKey()).toBe('legacy-secret')
    set({ SUPABASE_SECRET_KEY: 'sb_secret_new' }); expect(supabaseSecretKey()).toBe('sb_secret_new')
  })
  it('falls back to POSTGRES_URL and drops the extra parameters of the integration URL that a PostgreSQL server would reject', () => {
    set({ ...good, DATABASE_URL: undefined, POSTGRES_URL: 'postgres://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x' })
    expect(() => assertConfig()).not.toThrow()
    expect(databaseUrl()).toBe('postgres://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require')
    set({ DATABASE_URL: 'postgresql://u:p@db.example:6543/postgres' }); expect(databaseUrl()).toBe('postgresql://u:p@db.example:6543/postgres')
  })
  it('refuses a Vercel deployment that is not in production mode', () => {
    set({ ...good, VERCEL: '1', APP_ENV: 'development' }); expect(() => assertConfig()).toThrow('APP_ENV=production')
    set({ ...good, VERCEL: '1', APP_ENV: undefined, NODE_ENV: 'production' }); expect(() => assertConfig()).not.toThrow()
  })
})

describe('other settings', () => {
  it('caps uploads below the Vercel request limit unless overridden', () => {
    set({ VERCEL: '1', MAX_UPLOAD_BYTES: undefined }); expect(maxUploadBytes()).toBe(4_000_000)
    set({ VERCEL: undefined, MAX_UPLOAD_BYTES: undefined }); expect(maxUploadBytes()).toBe(10 * 1024 * 1024)
    set({ MAX_UPLOAD_BYTES: '1234567.9' }); expect(maxUploadBytes()).toBe(1234567)
    set({ MAX_UPLOAD_BYTES: 'junk' }); expect(maxUploadBytes()).toBeGreaterThan(1_000_000)
  })
  it('trims the trailing slash from the public base URL', () => {
    set({ PUBLIC_BASE_URL: 'https://voraworld.id///' }); expect(publicBaseUrl()).toBe('https://voraworld.id')
    set({ PUBLIC_BASE_URL: undefined, APP_ENV: 'development' }); expect(publicBaseUrl()).toBe('http://localhost:3000')
  })
  it('defaults to the permanent domain in production, never to a hosting address', () => {
    set({ PUBLIC_BASE_URL: undefined, NEXT_PUBLIC_APP_URL: undefined, APP_ENV: 'production' }); expect(publicBaseUrl()).toBe('https://voraworld.id')
    set({ NEXT_PUBLIC_APP_URL: 'https://staging.voraworld.id/' }); expect(publicBaseUrl()).toBe('https://staging.voraworld.id')
  })
})
