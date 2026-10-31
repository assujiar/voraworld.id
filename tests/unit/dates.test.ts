import { describe, expect, it } from 'vitest'
import { businessStamp } from '@/server/dates'

describe('when a document was issued or signed, as it is written', () => {
  it('is the moment on the Jakarta clock, to the second, with the zone', () => {
    expect(businessStamp(new Date('2026-10-31T04:42:07Z'))).toBe('2026-10-31 11:42:07 WIB')
    expect(businessStamp(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11-01 00:30:00 WIB')          // the next day in Jakarta
    expect(businessStamp(new Date('2026-10-31T16:59:59Z'))).toBe('2026-10-31 23:59:59 WIB')
  })
})
