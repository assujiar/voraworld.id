import { describe, expect, it } from 'vitest'
import { ALL, SOURCES, allRows, bodyWords, renderBody, rowFor } from '@/content/archive'
import { faqEntries } from '@/content/faq'
import { parseArchiveTags, periodTag } from '@/lib/archive'
import { articleHtml, withContents } from '@/lib/contents'
import { cleanHtml } from '@/server/sanitize'

/** The archive drafts are reviewable content, so the tests guard their structure and the rules that cannot be left to a reviewer's eye. */

const BANNED: Array<[string, RegExp]> = [
  ['"more than"', /\bmore than\b/i], ['"not just"', /\b(not just|not merely|beyond just|isn'?t just)\b/i], ['"we don\'t just"', /\bwe don'?t just\b/i],
  ['cliché', /redefin|revolutioni|unlock(ing)? (the )?potential|your gateway|every shipment tells a story/i],
  ['"bukan sekadar"', /bukan sekadar|lebih dari sekadar|tidak hanya\b.*\btetapi|bukan hanya/i], ['Indonesian slogan', /tanpa batas\b|menghubungkan dunia/i],
  ['claim about VORA operations', /\b(we|our team) (have|has) (shipped|delivered|moved)\b|kami telah (mengirim|mengantar|menangani)\b/i],
]
const texts = (d: (typeof ALL)[number], l: 'en' | 'id') => {
  const x = d[l]
  return [x.title, x.excerpt, x.seoTitle, x.seoDescription, x.coverAlt, ...x.sections.flatMap((s) => [s.h, ...(s.p ?? []), ...(s.list ?? []), ...(s.steps ?? []), ...(s.after ?? []), ...(s.table ? [...s.table.head, ...s.table.rows.flat()] : []), ...(s.example ? [s.example.label, ...s.example.p] : [])])]
}

describe('archive drafts', () => {
  it('is 16 articles in the 16 quarters Q1 2023 to Q4 2026, once each', () => {
    expect(ALL).toHaveLength(16)
    const periods = ALL.map((d) => `${d.year}-Q${d.quarter}`)
    expect(new Set(periods).size).toBe(16)
    expect([...periods].sort()).toEqual([2023, 2024, 2025, 2026].flatMap((y) => [1, 2, 3, 4].map((q) => `${y}-Q${q}`)))
  })

  it('gives every article an English and an Indonesian entry, 32 rows with unique slugs per language', () => {
    const rows = allRows(ALL)
    expect(rows).toHaveLength(32)
    expect(new Set(rows.map((r) => `${r.locale}/${r.slug}`)).size).toBe(32)
    for (const d of ALL) { expect(d.en.slug).not.toBe(d.id.slug); expect(d.en.title).not.toBe(d.id.title) }
  })

  it('keeps every row a draft with no publication date, no invented byline and no cover', () => {
    for (const r of allRows(ALL)) { expect(r.status).toBe('draft'); expect(r.author).toBe(''); expect(r.cover).toBe(''); expect(Object.keys(r)).not.toContain('published_at') }
  })

  it('carries the archive period and the language pair in tags, which parse back exactly', () => {
    for (const d of ALL) for (const l of ['en', 'id'] as const) {
      const m = parseArchiveTags(rowFor(d, l).tags)
      expect([m.year, m.quarter, m.group]).toEqual([d.year, d.quarter, d.group])
      expect(rowFor(d, l).tags).toContain(periodTag(d.year, d.quarter))
    }
  })

  it('has substance: sections, a table or list, a limits paragraph, every worked example labelled as hypothetical, and a floor on length', () => {
    for (const d of ALL) for (const l of ['en', 'id'] as const) {
      const x = d[l]
      expect(x.sections.length, `${x.slug} sections`).toBeGreaterThanOrEqual(5)
      expect(x.sections.some((s) => s.table || s.list || s.steps), `${x.slug} practical block`).toBe(true)
      expect(x.sections.some((s) => /^(Limits of this guide|Batasan panduan ini)$/.test(s.h)), `${x.slug} limits`).toBe(true)
      for (const s of x.sections) if (s.example) expect(s.example.label, `${x.slug} example label`).toMatch(/hypothetical|hipotetis|fictional|fiktif|rekaan|invented/i)
      expect(bodyWords(x), `${x.slug} words`).toBeGreaterThanOrEqual(l === 'en' ? 550 : 480)
      expect(x.excerpt.length).toBeLessThanOrEqual(400); expect(x.seoTitle.length).toBeLessThanOrEqual(90); expect(x.seoDescription.length).toBeLessThanOrEqual(300)
    }
  })

  it('cites 2 to 4 sources that exist, and prints the day each was read or says it must be rechecked', () => {
    for (const d of ALL) {
      expect(d.sources.length).toBeGreaterThanOrEqual(2); expect(d.sources.length).toBeLessThanOrEqual(4)
      for (const id of d.sources) expect(SOURCES[id], id).toBeTruthy()
      for (const l of ['en', 'id'] as const) {
        const html = renderBody(d[l], d.sources, l)
        for (const id of d.sources) { const s = SOURCES[id]; expect(html).toContain(s.url.replace(/&/g, '&amp;')); expect(html).toMatch(s.accessed ? new RegExp(s.accessed) : /recheck|diperiksa ulang/) }
      }
    }
    for (const s of Object.values(SOURCES)) { expect(s.url.startsWith('https://')).toBe(true); if (s.accessed) expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/) }
  })

  it('follows the copy rules in both languages', () => {
    const hits: string[] = []
    for (const d of ALL) for (const l of ['en', 'id'] as const) for (const t of texts(d, l)) for (const [name, re] of BANNED) if (re.test(t)) hits.push(`${d[l].slug}: ${name}: ${t.slice(0, 80)}`)
    expect(hits).toEqual([])
  })

  it('does not publish prices, universal free days or a VORA phone or WhatsApp number', () => {
    const all = ALL.flatMap((d) => (['en', 'id'] as const).flatMap((l) => texts(d, l))).join('\n')
    expect(all).not.toMatch(/\bWhatsApp\b|\+62\s?\d|\b0\d{2,3}[-\s]?\d{6,}\b/i)
    expect(all).not.toMatch(/\b(IDR|Rp)\s?\d/)
  })

  it('renders HTML the site sanitiser leaves unchanged (so it can be stored and shown as is)', () => {
    for (const d of ALL) for (const l of ['en', 'id'] as const) {
      const html = renderBody(d[l], d.sources, l)
      expect(cleanHtml(html)).toBe(html)
    }
  })
})

describe('article reading helpers', () => {
  it('adds heading ids and a contents list from the headings, never from stored attributes', () => {
    const { html, toc } = withContents('<h2>One two</h2><p>a</p><h2>One two</h2>')
    expect(toc.map((t) => t.id)).toEqual(['one-two', 'one-two-x'])
    expect(html).toContain('<h2 id="one-two">')
  })
  it('wraps each table in a focusable scroller with a label', () => {
    const { html } = articleHtml('<h2>A</h2><table><tr><td>1</td></tr></table>', 'Table "x"')
    expect(html).toContain('<div class="v-tablewrap" role="region" aria-label="Table x" tabindex="0"><table>')
    expect(html).toContain('</table></div>')
  })
  it('ignores tags that are not archive tags', () => {
    const m = parseArchiveTags('freight, period:2024-Q3 ,pair:abc-def,reviewed:2026-11-02,period:1999-Q9')
    expect(m).toMatchObject({ year: 2024, quarter: 3, group: 'abc-def', reviewed: '2026-11-02' })
    expect(m.tags).toEqual(['freight', 'period:1999-Q9'])
  })
})

describe('faq answers', () => {
  it('has at least 12 pairs, each in both languages, covering the topics the brief names', () => {
    expect(faqEntries.length).toBeGreaterThanOrEqual(12)
    for (const f of faqEntries) for (const l of ['en', 'id'] as const) { expect(f.q[l].length).toBeGreaterThan(10); expect(f.a[l].length).toBeGreaterThan(60) }
    const ids = faqEntries.map((f) => f.id)
    for (const need of ['rfq-info', 'scope', 'validity', 'chargeable', 'packing', 'customs-docs', 'special-cargo', 'windows', 'pod', 'approval', 'invoice-prepayment', 'payment-receipt']) expect(ids).toContain(need)
  })
  it('keeps the pre-payment receipt and the confirmed receipt apart', () => {
    const pre = faqEntries.find((f) => f.id === 'invoice-prepayment')!; const paid = faqEntries.find((f) => f.id === 'payment-receipt')!
    expect(pre.a.en).toMatch(/does not confirm/i); expect(pre.a.id).toMatch(/tidak menyatakan/i)
    expect(paid.a.en).toMatch(/confirmed/i); expect(paid.a.id).toMatch(/konfirmasi/i)
  })
  it('follows the copy rules and states no price, time, free-day or coverage promise', () => {
    const all = faqEntries.flatMap((f) => [f.q.en, f.a.en, f.q.id, f.a.id])
    for (const t of all) for (const [name, re] of BANNED) expect(re.test(t), `${name}: ${t.slice(0, 60)}`).toBe(false)
    expect(all.join('\n')).not.toMatch(/\b\d+\s?(days|hari)\b|\b(IDR|Rp)\s?\d/i)
  })
})
