import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CATEGORIES = ['company', 'services', 'operations', 'incoterms', 'customs', 'documentation', 'faq', 'other']
const sql = (name: string) => readFileSync(`migrations/${name}`, 'utf8')
const SEED = /VALUES\('([a-z0-9-]+)', '(\w+)', \$kb\$(.*?)\$kb\$, \$kb\$(.*?)\$kb\$, \$kb\$(.*?)\$kb\$, \$kb\$(.*?)\$kb\$, '(https:\/\/[^']+)'\)/gs
const articles = [...sql('0039_agent_knowledge_comprehensive.sql').matchAll(SEED)].map((m) => ({ key: m[1], category: m[2], titleEn: m[3], titleId: m[4], bodyEn: m[5], bodyId: m[6], source: m[7] }))
const previousKeys = new Set(['0035_logistics_knowledge_seed.sql', '0036_agent_logistics_special_cargo.sql'].flatMap((f) => [...sql(f).matchAll(/VALUES\('([a-z0-9-]+)'/g)].map((m) => m[1])))

describe('VORA knowledge expansion seed (0039)', () => {
  it('parses every article, so a quoting mistake cannot hide one', () => {
    const declared = (sql('0039_agent_knowledge_comprehensive.sql').match(/INSERT INTO public\.agent_knowledge/g) ?? []).length
    expect(articles.length).toBe(declared)
    expect(articles.length).toBeGreaterThanOrEqual(55)
  })
  it('has unique keys that never collide with earlier seeds (existing rows are never overwritten)', () => {
    const keys = articles.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.filter((k) => previousKeys.has(k))).toEqual([])
  })
  it('is bilingual, within the database limits and in a valid category', () => {
    for (const a of articles) {
      expect(CATEGORIES, a.key).toContain(a.category)
      expect(a.titleEn.length, a.key).toBeGreaterThan(0); expect(a.titleEn.length, a.key).toBeLessThanOrEqual(200)
      expect(a.titleId.length, a.key).toBeGreaterThan(0); expect(a.titleId.length, a.key).toBeLessThanOrEqual(200)
      expect(a.bodyEn.length, a.key).toBeGreaterThanOrEqual(400); expect(a.bodyEn.length, a.key).toBeLessThan(80_000)
      expect(a.bodyId.length, a.key).toBeGreaterThanOrEqual(400); expect(a.bodyId.length, a.key).toBeLessThan(80_000)
    }
  })
  it('keeps references internal: no URLs, citations or reference sections in customer-facing text', () => {
    for (const a of articles) for (const text of [a.bodyEn, a.bodyId]) {
      expect(text, a.key).not.toMatch(/https?:\/\/|www\./i)
      expect(text, a.key).not.toMatch(/\b(sources?|references?|sumber|referensi)\s*:/i)
    }
  })
  it('never promises a price, schedule, space or outcome', () => {
    for (const a of articles) {
      expect(a.bodyEn, a.key).not.toMatch(/we guarantee|will be approved|100% safe/i)
      expect(a.bodyId, a.key).not.toMatch(/kami menjamin|pasti disetujui|100% aman/i)
    }
  })
  it('covers the five requested domains and the key Indonesian trade rules', () => {
    const keys = new Set(articles.map((a) => a.key))
    for (const key of [
      'ff-process-end-to-end', 'ff-container-types-specs', 'ff-export-cost-components', 'ff-liability-insurance', 'ic-who-pays-what',
      'law-trade-transport-framework', 'cus-pib-flow-responses', 'cus-lartas-system', 'cus-hs-classification-method', 'cus-duty-tax-calculation',
      'cus-import-policy-framework', 'cus-garments-textiles-import', 'cus-steel-iron-import', 'cus-fta-origin-preference', 'cus-document-checklists',
      'wh-3pl-scope-services', 'wh-pricing-models', 'pc-overview-phases', 'pc-equipment-capacities',
      'dd-truck-types-capacity', 'dd-trucking-cost-components', 'dd-sea-domestic-cabotage', 'dd-multimodal-rail-air-domestic',
    ]) expect(keys.has(key), key).toBe(true)
  })
  it('states the main current Indonesian references and flags that they must be verified', () => {
    const byKey = Object.fromEntries(articles.map((a) => [a.key, a]))
    expect(byKey['cus-import-policy-framework'].bodyEn).toMatch(/Regulation 16 of 2025/)
    expect(byKey['cus-import-policy-framework'].bodyEn).toMatch(/Permendag 18 of 2026/)
    expect(byKey['cus-pib-flow-responses'].bodyEn).toMatch(/SPPB/); expect(byKey['cus-pib-flow-responses'].bodyEn).toMatch(/SPTNP/)
    expect(byKey['cus-garments-textiles-import'].bodyEn).toMatch(/Permendag 17 of 2025/)
    expect(byKey['cus-lartas-system'].bodyId).toMatch(/konfirmasi|cek/i)
  })
})

describe('knowledge search relevance (0040)', () => {
  const migration = sql('0040_agent_search_relevance.sql')
  it('ranks heading matches above body matches', () => {
    expect(migration).toMatch(/setweight\(to_tsvector\('simple', coalesce\(heading,''\)\), 'A'\)/)
    expect(migration).toMatch(/setweight\(to_tsvector\('simple', coalesce\(content,''\)\), 'B'\)/)
  })
  it('filters common Indonesian and English question words but keeps domain acronyms searchable', () => {
    for (const word of ['dan', 'saya', 'cara', 'berapa', 'what', 'need']) expect(migration).toContain(`'${word}'`)
    expect(migration).toContain("w IN ('dg','bl','hs')")
  })
  it('keeps the function signature so grants and callers keep working', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.agent_search_knowledge(p_query text, p_locale text, p_limit integer DEFAULT 6)')
  })
})
