import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What the private documents bucket accepts, READ FROM THE MIGRATIONS that create and change it (0013, then every later migration that names
 * `vora-documents` and lists allowed types), so a test fails when the SQL and the code disagree, the way production did: 0013 allowed only
 * application/pdf while proof-of-delivery stores a PNG and JPEG photos there.
 */
export function documentsBucketRules(): { allowed: string[]; maxBytes: number; isPublic: boolean } {
  const dir = join(process.cwd(), 'migrations')
  const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()
  let allowed: string[] | null = []
  let maxBytes = 0
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
    const created = /'vora-documents',\s*'vora-documents',\s*(?:TRUE|FALSE),\s*(\d+),\s*ARRAY\[([^\]]*)\]/i.exec(sql)
    if (created && f.startsWith('0013')) { maxBytes = Number(created[1]); allowed = [...created[2].matchAll(/'([^']+)'/g)].map((m) => m[1]) }
    const needed = /v_needed constant text\[\] := ARRAY\[([^\]]*)\]/.exec(sql)
    if (needed && /vora-documents/.test(sql)) allowed = [...new Set([...(allowed ?? []), ...[...needed[1].matchAll(/'([^']+)'/g)].map((m) => m[1])])]
  }
  return { allowed: allowed ?? [], maxBytes, isPublic: false }
}
