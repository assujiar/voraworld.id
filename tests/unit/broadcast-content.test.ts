import { describe, expect, it } from 'vitest'
import { BROADCAST_SAMPLE, csvEscape, parseCsv, renderBroadcast } from '@/server/broadcast/content'

describe('broadcast content safety and CSV import', () => {
  it('parses quoted commas, escaped quotes and multiline cells', () => {
    const rows=parseCsv('email,company_name,tags\r\n"a@example.com","A, Inc.","sea,air"\r\n"b@example.com","He said ""yes""\nthen left",general\n')
    expect(rows).toEqual([
      ['email','company_name','tags'],
      ['a@example.com','A, Inc.','sea,air'],
      ['b@example.com','He said "yes"\nthen left','general'],
    ])
  })
  it('refuses an unmatched CSV quote', () => expect(()=>parseCsv('email\n"not-closed')).toThrow('Unclosed'))
  it('prevents spreadsheet formula injection in exported values', () => {
    expect(csvEscape('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"')
  })
  it('escapes contact variables, strips scripts and includes unsubscribe', () => {
    const out=renderBroadcast('Hello {{pic_name}}\r\nBCC: x', '<h2>Hello {{pic_name}}</h2><script>alert(1)</script><p>{{company_name}}</p><a href="javascript:alert(1)">bad</a>',
      {...BROADCAST_SAMPLE,pic_name:'<img src=x onerror=1>',company_name:'A&B'}, 'https://voraworld.id/unsubscribe?token=123')
    expect(out.subject).not.toContain('\n')
    expect(out.html).not.toMatch(/<script|<img\b|href="javascript:/i)
    expect(out.html).toContain('&lt;img')
    expect(out.html).toContain('A&amp;B')
    expect(out.html).toContain('https://voraworld.id/unsubscribe?token=123')
  })
})
