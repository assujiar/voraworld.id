import { describe, expect, it } from 'vitest'
import { businessDay } from '@/server/dates'

describe('the day a document was issued or signed', () => {
  it('is the date on the Jakarta calendar, without the time of day', () => {
    expect(businessDay(new Date('2026-10-31T04:42:00Z'))).toBe('2026-10-31')
    expect(businessDay(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11-01')          // 00:30 on the 1st in Jakarta
    expect(businessDay(new Date('2026-10-31T16:59:59Z'))).toBe('2026-10-31')
  })
})
