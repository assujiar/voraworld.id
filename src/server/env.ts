/**
 * Runtime configuration. Everything the app reads from the environment goes through here, so `.env.example`
 * can be checked against it (tests/env-example.test.ts).
 */
export type AppEnv = 'production' | 'development' | 'test'

export function appEnv(): AppEnv {
  const explicit = process.env.APP_ENV
  if (explicit === 'production' || explicit === 'development' || explicit === 'test') return explicit
  if (process.env.NODE_ENV === 'test') return 'test'
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

export const isProd = () => appEnv() === 'production'
export const onVercel = () => Boolean(process.env.VERCEL)

/** Upload ceiling in bytes. Vercel rejects request bodies above 4.5 MB before they reach the app. */
export function maxUploadBytes(): number {
  const override = Number(process.env.MAX_UPLOAD_BYTES)
  if (Number.isFinite(override) && override > 0) return Math.floor(override)
  return onVercel() ? 4_000_000 : 10 * 1024 * 1024
}

export function publicBaseUrl(fallback = 'http://localhost:3000'): string {
  return (process.env.PUBLIC_BASE_URL || fallback).replace(/\/+$/, '')
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET || ''
  if (secret) return secret
  if (isProd()) throw new Error('SESSION_SECRET is required in production')
  return 'local-development-not-for-production-only-secret'
}

/** Fails loudly, once, at server start-up when production is misconfigured. */
export function assertConfig(): void {
  if (onVercel() && appEnv() !== 'production') {
    throw new Error('Vercel deployments must run with APP_ENV=production (or leave APP_ENV unset)')
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) throw new Error('DATABASE_URL must be a PostgreSQL URL')
  if (!isProd()) return
  // The address is printed into the QR code of every document and never changes afterwards, so it must be the final https
  // domain. A loopback address is accepted only off Vercel, so a production build can be run on a developer machine.
  const base = process.env.PUBLIC_BASE_URL || ''
  const loopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) && !onVercel()
  if (!base.startsWith('https://') && !loopback) {
    throw new Error('Production requires an HTTPS PUBLIC_BASE_URL (it is printed into document QR codes)')
  }
  const secret = process.env.SESSION_SECRET || ''
  if (secret.length < 32 || secret.startsWith('replace-')) {
    throw new Error('SESSION_SECRET must contain >=32 random characters in production')
  }
}
