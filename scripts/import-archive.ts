/**
 * Loads the 32 reviewable archive drafts (src/content/archive) into the `articles` table as drafts.
 *
 *   npm run import:archive                 dry run: prints what would be written, touches nothing, needs no database
 *   npm run import:archive -- --check      dry run that also reads the database and says which rows already exist (read only)
 *   ARCHIVE_IMPORT_CONFIRM=owner-approved npm run import:archive -- --apply
 *
 * `--apply` inserts only rows whose (locale, slug) is absent, as status draft with no publication date, so running it twice changes nothing and it never
 * overwrites text an editor has changed. It refuses to run without the confirmation variable. Nothing here publishes anything.
 */
import { ALL, allRows } from '../src/content/archive'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const check = args.has('--check') || apply
const rows = allRows(ALL)

async function main() {
  if (apply && process.env.ARCHIVE_IMPORT_CONFIRM !== 'owner-approved') {
    console.error('Refusing to write: set ARCHIVE_IMPORT_CONFIRM=owner-approved once the owner has approved the import.')
    process.exit(2)
  }
  const { many, insert } = check ? await import('../src/server/data') : ({} as never)
  const existing = new Set<string>()
  if (check) for (const r of await many('articles', (q) => q, 'slug,locale')) existing.add(`${r.locale}/${r.slug}`)
  let created = 0
  for (const r of rows) {
    const key = `${r.locale}/${r.slug}`
    const exists = existing.has(key)
    const words = r.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    console.log(`${exists ? 'skip  ' : apply ? 'insert' : 'would insert'}  ${key}  [${r.tags}]  ${words} words  status=${r.status}  published_at=null`)
    if (apply && !exists) { await insert('articles', r as unknown as Record<string, unknown>); created++ }
  }
  console.log(`${rows.length} drafts, ${apply ? `${created} inserted` : 'dry run, nothing written'}.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
