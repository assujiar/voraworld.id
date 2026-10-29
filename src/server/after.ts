import { after } from 'next/server'

/** Runs `fn` after the response has been sent (so slow work, such as SMTP, never delays the visitor). */
export function afterResponse(fn: () => Promise<unknown>): void {
  const safe = () => fn().catch((e) => console.error('background task failed', e instanceof Error ? e.message : e))
  try {
    after(safe)
  } catch {
    // Outside a request (scripts, tests): just run it.
    void safe()
  }
}
