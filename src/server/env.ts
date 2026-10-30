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

/** The permanent address of the site. It is printed into the QR code of every document, so it is a constant, not a guess from the hosting URL. */
export const PRODUCTION_ORIGIN = 'https://voraworld.id'

/** `PUBLIC_BASE_URL` (or `NEXT_PUBLIC_APP_URL`) overrides it, for staging or for a different domain; in production the default is the permanent domain. */
export function publicBaseUrl(fallback = 'http://localhost:3000'): string {
  const configured = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  return isProd() ? PRODUCTION_ORIGIN : fallback
}

/** Only the origin: a value pasted from the dashboard as `https://xxxx.supabase.co/rest/v1/` still works. */
function origin(value: string | undefined): string {
  if (!value) return ''
  try { return new URL(value).origin } catch { return value.replace(/\/+$/, '') }
}

/** The Supabase project: `NEXT_PUBLIC_SUPABASE_URL`, or `SUPABASE_URL` (the Vercel integration sets both). */
export const supabaseUrl = (): string => origin(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)

/** The publishable (or legacy anon) key: what the sign-in client sends. Safe to expose; it grants nothing the database policies do not allow. */
export const supabasePublishableKey = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

/** The secret (or legacy service_role) key. Server only, never in a NEXT_PUBLIC_ variable, never sent to the browser. */
export const supabaseSecretKey = (): string => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** Fails loudly, once, at server start-up when production is misconfigured. */
export function assertConfig(): void {
  if (onVercel() && appEnv() !== 'production') {
    throw new Error('Vercel deployments must run with APP_ENV=production (or leave APP_ENV unset)')
  }
  if (!supabaseUrl()) throw new Error('NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is required: sign-in uses Supabase Auth')
  if (!supabasePublishableKey()) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_PUBLISHABLE_KEY / the legacy anon key) is required: sign-in uses Supabase Auth')
  if (!supabaseSecretKey()) throw new Error('SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) is required: the server reads and writes the database through the Supabase Data API')
  if (!isProd()) return
  // The address is printed into the QR code of every document and never changes afterwards, so it must be the final https
  // domain. A loopback address is accepted only off Vercel, so a production build can be run on a developer machine.
  const base = publicBaseUrl()
  const loopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) && !onVercel()
  if (!base.startsWith('https://') && !loopback) {
    throw new Error('Production requires an HTTPS PUBLIC_BASE_URL (it is printed into document QR codes)')
  }
}
