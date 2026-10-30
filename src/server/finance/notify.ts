/**
 * Runs a notification after the accounting it follows has been committed, without letting a mail problem change the outcome. The money has
 * moved and the document exists; a failed email is only logged and can be queued again from the invoice or receipt page.
 */
export async function bestEffort(what: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    console.error(`notification skipped (${what}):`, e instanceof Error ? e.message : e)
  }
}
