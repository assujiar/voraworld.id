/**
 * Apply migrations/*.sql to the PostgreSQL database in DATABASE_URL, in numeric order.
 *
 *   npm run db:migrate                         # dry run: lists pending migrations
 *   npm run db:migrate -- --apply              # executes them (each file in its own transaction)
 *   npm run db:migrate -- --baseline 0010      # record 0001..0010 as already applied (hand-made database)
 *
 * Use the Supabase *session* pooler (port 5432) or the direct connection for this, not port 6543.
 */
import { connectionUrl, openSql, runMigrations } from './lib/migrations'

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const bi = args.indexOf('--baseline')
  const baseline = bi >= 0 ? args[bi + 1] : undefined
  const sql = openSql(connectionUrl())
  try {
    const result = await runMigrations(sql, { apply, baseline, log: (l) => console.log(l) })
    if (!result.pending.length && !result.applied.length && !result.baselined.length) console.log('Nothing to apply: the database is up to date.')
    else if (!apply && !baseline) console.log('Dry run only. Re-run with --apply to execute.')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
