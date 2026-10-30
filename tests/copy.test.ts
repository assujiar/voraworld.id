import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { faqEntries } from '@/content/faq'
import { FOOTER_DESCRIPTION } from '@/content/footer'
import { rfqGuidance } from '@/content/rfq-guidance'
import * as guides from '@/content/service-guides'
import { serviceExtras } from '@/content/service-extras'
import { solutionGuides } from '@/content/solution-guides'
import { workingNotes } from '@/content/working-notes'

/**
 * The public copy follows the owner's writing rules: no "more than...", "not just...", "from X to Y" slogans, no marketing clichés, and the same
 * formulas are refused when translated or paraphrased into Indonesian. This reads every sentence the site shows (site.json and the t('en', 'id') pairs
 * in the components and pages) and fails with the sentence and the rule it broke.
 */
const RULES: Array<[string, RegExp]> = [
  ['"more than"', /\bmore than\b/i],
  ['"not just" / "not merely" / "beyond just"', /\b(not just|not merely|beyond just|isn'?t just|it'?s not just)\b/i],
  ['"we don\'t just X, we Y"', /\bwe don'?t just\b/i],
  ['"from X to Y" slogan', /\bfrom\s+[a-z' ]{3,40}\s+to\s+[a-z' ]{3,40}[.,]?$/i],
  ['"where X meets Y"', /\bwhere [a-z ]+ meets\b/i],
  ['cliché', /redefin|revolutioni|unlock(ing)? (the )?potential|empower(ing)? (businesses|your)|your gateway|every shipment tells a story|transforming challenges/i],
  ['"bukan sekadar" / "lebih dari sekadar" / "tidak hanya ... tetapi"', /bukan sekadar|lebih dari sekadar|tidak hanya\b.*\btetapi|bukan hanya/i],
  ['Indonesian slogan', /dari tantangan menjadi peluang|solusi tanpa batas|tanpa batas\b|menghubungkan dunia tanpa/i],
  ['"Dari X hingga Y" slogan', /^dari [^,.]{3,50} (hingga|sampai) [^,.]{3,50}\.?$/i],
]

function sentences(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  const walk = (o: unknown, path: string) => {
    if (typeof o === 'string') out.push({ where: path, text: o })
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${path}[${i}]`))
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`)
  }
  walk(JSON.parse(readFileSync('src/content/site.json', 'utf8')), 'site.json')
  walk(serviceExtras, 'service-extras.ts')
  walk(faqEntries, 'faq.ts'); walk(workingNotes, 'working-notes.ts'); walk(rfqGuidance, 'rfq-guidance.ts'); walk(FOOTER_DESCRIPTION, 'footer.ts'); walk(solutionGuides, 'solution-guides.ts')
  for (const [name, value] of Object.entries(guides)) walk(value, `service-guides.ts:${name}`)
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [] })
  for (const file of [...files('src/components/site'), ...files('src/app/(site)')]) {
    const code = readFileSync(file, 'utf8')
    for (const m of code.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,\s*(['"`])((?:\\.|(?!\3).)*)\3\s*\)/g)) { out.push({ where: file, text: m[2] }); out.push({ where: file, text: m[4] }) }
  }
  return out
}

describe('public copy', () => {
  const all = sentences()
  it('reads a meaningful amount of copy', () => { expect(all.length).toBeGreaterThan(250) })
  it.each(RULES)('has no %s', (_name, re) => {
    const hits = all.filter((s) => re.test(s.text.trim())).map((s) => `${s.where}: ${s.text}`)
    expect(hits).toEqual([])
  })
})
