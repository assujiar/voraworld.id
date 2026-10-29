/** Business-rule or validation failure: shown to the user on the form they came from. */
export class ActionError extends Error {
  constructor(message: string, public status = 422) {
    super(message)
  }
}

/** PostgreSQL unique violation (SQLSTATE 23505). */
export const isUnique = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'
