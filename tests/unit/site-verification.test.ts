import { describe, expect, it } from 'vitest'
import { verificationMetadata, verificationToken } from '@/server/site-verification'

describe('search-engine verification tokens', () => {
  it('keeps a bare token', () => {
    expect(verificationToken('  abcDEF_123-xyz  ')).toBe('abcDEF_123-xyz')
  })

  it('extracts the token from a pasted meta tag', () => {
    expect(verificationToken('<meta name="google-site-verification" content="Q1w2E3r4-T5y6_U7" />')).toBe('Q1w2E3r4-T5y6_U7')
    expect(verificationToken("<meta name='msvalidate.01' content='0123ABCD4567EF'>")).toBe('0123ABCD4567EF')
  })

  it('drops anything that is not a plain token', () => {
    expect(verificationToken('"><script>alert(1)</script>')).toBe('')
    expect(verificationToken('two words')).toBe('')
    expect(verificationToken('')).toBe('')
    expect(verificationToken(undefined)).toBe('')
  })

  it('builds the metadata block only for the tokens that are set', () => {
    expect(verificationMetadata({})).toBeUndefined()
    expect(verificationMetadata({ google_site_verification: 'g-token' })).toEqual({ google: 'g-token' })
    expect(verificationMetadata({ google_site_verification: 'g', bing_site_verification: 'b' })).toEqual({ google: 'g', other: { 'msvalidate.01': 'b' } })
  })
})
