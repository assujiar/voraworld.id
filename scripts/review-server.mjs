/** Local read-only visual review. No credentials, production network, mail or data mutations.
 * Runs the real Next production application against an empty loopback Data API fixture.
 * Use after `npm run build`: node scripts/review-server.mjs
 */
import http from 'node:http'
import { spawn } from 'node:child_process'
const port = Number(process.env.REVIEW_PORT || 3100), dataPort = Number(process.env.REVIEW_DATA_PORT || 3101)
const fixture = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Read-only visual fixture'); return }
  if (!req.url.startsWith('/rest/v1/')) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': '*/0', 'Range-Unit': 'items', 'Access-Control-Expose-Headers': 'Content-Range' });res.end('[]')
})
fixture.listen(dataPort, '127.0.0.1', () => {
  const env = { ...process.env, APP_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${dataPort}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-review-public-placeholder', SUPABASE_SECRET_KEY: 'local-review-secret-placeholder', PUBLIC_BASE_URL: `http://127.0.0.1:${port}` }
  for (const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','VORA_ATTESTATION_PRIVATE_KEY','CRON_SECRET','MAIL_ENCRYPTION_KEY']) delete env[key]
  const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', process.env.REVIEW_MODE === 'dev' ? 'dev' : 'start', '--hostname', '127.0.0.1', '--port', String(port)], { stdio: 'inherit', env })
  const stop = () => { next.kill(); fixture.close(); }
  process.on('SIGINT', stop);process.on('SIGTERM', stop)
  next.on('exit', code => { fixture.close(); process.exit(code ?? 1) })
  console.log(`Local visual review: http://127.0.0.1:${port} · empty read-only data · submissions intentionally fail`)
})
