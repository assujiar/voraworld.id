import { startTestServer } from '../setup/server'

/** One production-mode server on a throw-away database for the whole HTTP suite (`npm run test:http` builds first). */
export default async function setup() {
  const server = await startTestServer({ port: 3200 + Math.floor(Math.random() * 500), prefix: 'vora_http' })
  process.env.HTTP_BASE_URL = server.base
  process.env.HTTP_DATABASE_URL = server.databaseUrl
  process.env.HTTP_CRON_SECRET = server.cronSecret
  process.env.HTTP_SESSION_SECRET = server.sessionSecret
  process.env.HTTP_SUPABASE_URL = server.storageUrl
  process.env.HTTP_SUPABASE_KEY = server.storageKey
  return () => server.stop()
}
