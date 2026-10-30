import { startTestServer } from '../setup/server'

/** One production-mode server on a throw-away database for the whole HTTP suite (`npm run test:http` builds first). */
export default async function setup() {
  const server = await startTestServer({ port: 3200 + Math.floor(Math.random() * 500), prefix: 'vora_http' })
  process.env.HTTP_BASE_URL = server.base
  process.env.HTTP_DATABASE_URL = server.databaseUrl
  process.env.HTTP_CRON_SECRET = server.cronSecret
  // The suite's own helpers talk to the same Supabase Auth as the server.
  process.env.NEXT_PUBLIC_SUPABASE_URL = server.auth.url
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = server.auth.publishableKey
  process.env.SUPABASE_SECRET_KEY = server.auth.secretKey
  process.env.HTTP_SUPABASE_URL = server.storageUrl
  process.env.HTTP_SUPABASE_KEY = server.storageKey
  return () => server.stop()
}
