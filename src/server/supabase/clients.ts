import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabasePublishableKey, supabaseUrl } from '../env'
import { sessionCookieOptions } from './cookie-options'

/**
 * The two ways the server talks to Supabase Auth, both with the publishable key only.
 *
 *  - supabaseForRequest(): acts AS the signed-in visitor, with the cookies of the current request (Server Components, Server Actions, route
 *    handlers). It is what signs people in and out and what proves who is signed in.
 *  - supabaseFromCookieHeader(): the same, read-only, from a raw Cookie header (a route handler that only has a Request).
 * Accounts are created by an administrator in the Supabase dashboard, so the application needs no privileged key to run sign-in.
 */
export async function supabaseForRequest() {
  const store = await cookies()
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // A Server Component cannot set cookies; the middleware refreshes the session before such a page renders.
        try { for (const { name, value, options } of list) store.set(name, value, sessionCookieOptions(options)) } catch { /* nothing to do */ }
      },
    },
  })
}

export function supabaseFromCookieHeader(header: string | null | undefined) {
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: { getAll: async () => (parseCookieHeader(header ?? '') as Array<{ name: string; value: string }>), setAll: () => { /* read-only */ } },
  })
}
