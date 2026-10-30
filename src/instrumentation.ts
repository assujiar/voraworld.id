/**
 * Runs once when the server starts. A production deployment with a missing or unsafe setting (Supabase address and keys, https address) must fail at once and say why in the logs, not serve pages that break later.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { assertConfig } = await import('./server/env')
  assertConfig()
}
