import { describe, expect, it } from 'vitest'
import { ABOUT, CAPABILITIES, COMMITMENTS, FOUNDER, MEMORY, TRUST } from '@/content/about'

/** The About copy follows the rules in .claude/skills/vora-copywriting: plain, specific, both languages, nothing inflated. */
const strings = (v: unknown, path = ''): Array<[string, string]> =>
  typeof v === 'string' ? [[path, v]] : Array.isArray(v) ? v.flatMap((x, i) => strings(x, `${path}[${i}]`)) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => strings(x, `${path}.${k}`)) : []
const all = strings({ ABOUT, FOUNDER, CAPABILITIES, COMMITMENTS, TRUST, MEMORY })
const BANNED = ['seamless', 'robust', 'cutting-edge', 'world-class', 'best-in-class', 'state-of-the-art', 'game-chang', 'revolution', 'innovative', 'holistic', 'end-to-end', 'leverage', 'unlock', 'elevate', 'empower', 'streamline', 'delve', 'tapestry', 'journey', 'passionate', 'in today', 'imagine', 'not just', 'more than a', 'trusted by', 'industry-leading',
  'solusi terbaik', 'terdepan', 'berkomitmen memberikan', 'one-stop', 'mitra strategis', 'era digital', 'sinergi', 'inovatif', 'komprehensif', 'tak hanya', 'bukan hanya']

describe('the About copy', () => {
  it('has none of the inflated words or frames that read as machine-written', () => {
    for (const [path, text] of all) for (const b of BANNED) expect(text.toLowerCase(), `${path}: "${b}"`).not.toContain(b)
  })
  it('has no em dash, no exclamation mark and no sentence over 30 words', () => {
    for (const [path, text] of all) {
      expect(text, path).not.toMatch(/[—!]/)
      for (const sentence of text.split(/(?<=[.?])\s+/)) expect(sentence.split(/\s+/).length, `${path}: ${sentence.slice(0, 60)}`).toBeLessThanOrEqual(30)
    }
  })
  it('says the same four things in both languages, and names no founder, number or client it was not given', () => {
    expect(FOUNDER.items).toHaveLength(4)
    for (const item of FOUNDER.items) for (const part of [item.title, item.problem, item.answer]) { expect(part.en.length).toBeGreaterThanOrEqual(4); expect(part.id.length).toBeGreaterThanOrEqual(4) }
    const joined = all.map(([, t]) => t).join(' ')
    expect(joined).toContain('more than ten years'); expect(joined).toContain('lebih dari sepuluh tahun')
    expect(joined).not.toMatch(/\b\d{2,}\s*(%|\+|years|tahun|clients|klien|countries|negara)/i)                 // no invented statistic
  })
})
