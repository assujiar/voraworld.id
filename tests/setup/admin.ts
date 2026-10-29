import postgres from 'postgres'

/** Server (not database) URL used to create and drop throw-away test databases. */
export function adminUrl(): string {
  return process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
}

export function withDatabase(adminConnection: string, database: string): string {
  const u = new URL(adminConnection)
  u.pathname = '/' + database
  return u.toString()
}

export function admin() {
  return postgres(adminUrl(), { max: 1, onnotice: () => {} })
}
