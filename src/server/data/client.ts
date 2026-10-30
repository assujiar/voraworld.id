import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseSecretKey, supabaseUrl } from '../env'

/**
 * The server's connection to the database: the Supabase Data API (PostgREST) with the project's SECRET key. It is the only way application
 * code reaches the database; there is no connection string. The key bypasses row level security, so it exists only here, on the server,
 * and is never put in a NEXT_PUBLIC_ variable or sent to a browser. The tables themselves are closed to the public (anon) and
 * signed-in (authenticated) API roles: see migrations 0011 and 0024.
 */
const TIMEOUT_MS = 20_000
let cached: { id: string; client: SupabaseClient } | undefined

export function data(): SupabaseClient {
  const url = supabaseUrl()
  const key = supabaseSecretKey()
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set: the database is reached through the Supabase Data API')
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set: the server needs the project\'s secret key to reach the database')
  const id = `${url}|${key}`
  if (cached?.id !== id) {
    cached = {
      id,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        // A request that never answers must not hold a serverless function until its own limit.
        global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) }) },
      }),
    }
  }
  return cached.client
}
