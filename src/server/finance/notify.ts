import type { Db } from '../db'

/**
 * Runs a notification inside the caller's transaction without letting it undo the accounting around it.
 * A savepoint isolates SQL failures; any other failure is only logged: the money has moved, the email can be retried.
 */
export async function bestEffort(t: Db, what: string, fn: (s: Db) => Promise<unknown>): Promise<void> {
  try {
    const tt = t as unknown as { savepoint?: (f: (s: Db) => Promise<unknown>) => Promise<unknown> }
    if (tt.savepoint) await tt.savepoint((s) => fn(s))
    else await fn(t)
  } catch (e) {
    console.error(`notification skipped (${what}):`, e instanceof Error ? e.message : e)
  }
}
