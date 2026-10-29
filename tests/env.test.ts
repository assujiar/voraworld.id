import { afterEach, describe, expect, it } from 'vitest'
import { assertConfig, maxUploadBytes, publicBaseUrl, sessionSecret } from '@/server/env'

const KEYS = ['APP_ENV', 'NODE_ENV', 'VERCEL', 'DATABASE_URL', 'PUBLIC_BASE_URL', 'SESSION_SECRET', 'MAX_UPLOAD_BYTES']
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } })
const set = (o: Record<string, string | undefined>) => { for (const [k, v] of Object.entries(o)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
const good = { APP_ENV: 'production', DATABASE_URL: 'postgresql://u:p@db.example:6543/postgres', PUBLIC_BASE_URL: 'https://voraworld.id', SESSION_SECRET: 'x'.repeat(40), VERCEL: undefined }

describe('startup configuration check', () => {
  it('accepts a sound production configuration', () => { set(good); expect(() => assertConfig()).not.toThrow() })
  it('needs a PostgreSQL DATABASE_URL in every environment', () => {
    set({ ...good, DATABASE_URL: undefined }); expect(() => assertConfig()).toThrow('DATABASE_URL is required')
    set({ ...good, DATABASE_URL: 'mysql://x' }); expect(() => assertConfig()).toThrow('PostgreSQL')
    set({ APP_ENV: 'development', DATABASE_URL: 'postgresql://localhost/x' }); expect(() => assertConfig()).not.toThrow()
  })
  it('requires the final https address in production, because it is printed into every QR code', () => {
    for (const bad of ['http://voraworld.id', 'voraworld.id', '', 'ftp://x']) { set({ ...good, PUBLIC_BASE_URL: bad }); expect(() => assertConfig(), bad).toThrow('HTTPS PUBLIC_BASE_URL') }
    set({ ...good, PUBLIC_BASE_URL: 'http://localhost:3000' }); expect(() => assertConfig()).not.toThrow()      // a production build on a developer machine
    set({ ...good, PUBLIC_BASE_URL: 'http://localhost:3000', VERCEL: '1' }); expect(() => assertConfig()).toThrow('HTTPS PUBLIC_BASE_URL')
    set({ ...good, PUBLIC_BASE_URL: 'http://localhost.evil.example' }); expect(() => assertConfig()).toThrow('HTTPS PUBLIC_BASE_URL')
  })
  it('requires a long random session secret in production', () => {
    for (const bad of ['', 'short', 'replace-me-with-a-long-random-value-0000000000']) { set({ ...good, SESSION_SECRET: bad }); expect(() => assertConfig(), bad).toThrow('SESSION_SECRET') }
    set({ ...good, APP_ENV: 'development', SESSION_SECRET: undefined }); expect(() => assertConfig()).not.toThrow()
    expect(sessionSecret()).toContain('local-development')
    set({ ...good, SESSION_SECRET: undefined }); expect(() => sessionSecret()).toThrow('required in production')
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
    set({ PUBLIC_BASE_URL: undefined }); expect(publicBaseUrl()).toBe('http://localhost:3000')
  })
})
