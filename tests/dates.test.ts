import { describe, expect, it } from 'vitest'
import { ActionError } from '@/server/errors'
import { businessDateTime, daysBetween, isIsoDay, isoDay, today } from '@/server/dates'

describe('business dates (Jakarta, UTC+7, no daylight saving)', () => {
  it('a moment belongs to the Jakarta calendar day, not the UTC one', () => {
    expect(today(new Date('2026-10-31T16:59:59Z'))).toBe('2026-10-31')     // 23:59:59 in Jakarta
    expect(today(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01')     // midnight in Jakarta
    expect(today(new Date('2026-12-31T20:30:00Z'))).toBe('2027-01-01')     // across the new year
    expect(today(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03-01')
  })
  it('formats a moment as date and time on the Jakarta clock', () => {
    expect(businessDateTime(new Date('2026-10-29T07:05:00Z'))).toBe('2026-10-29 14:05')
    expect(businessDateTime(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01 00:00')       // midnight is 00, never 24
    expect(businessDateTime(new Date('2026-10-31T16:59:00Z'))).toBe('2026-10-31 23:59')
  })
  it('accepts only real calendar days', () => {
    for (const ok of ['2026-02-28', '2028-02-29', '2026-12-31']) expect(isIsoDay(ok), ok).toBe(true)
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '26-01-01', '2026-1-1', '2026-01-01T00:00', '', 'tomorrow']) expect(isIsoDay(bad), bad).toBe(false)
  })
  it('falls back only when the field is empty, and explains a bad value', () => {
    expect(isoDay('', '2026-10-29')).toBe('2026-10-29')
    expect(isoDay('  ', '2026-10-29')).toBe('2026-10-29')
    expect(isoDay(' 2026-11-02 ', '2026-10-29')).toBe('2026-11-02')
    expect(() => isoDay('2026-02-30', '2026-10-29', 'Due date')).toThrow(ActionError)
    expect(() => isoDay('2026-02-30', '2026-10-29', 'Due date')).toThrow('Due date must be a valid date')
  })
  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-10-29', '2026-11-12')).toBe(14)
    expect(daysBetween('2026-11-12', '2026-10-29')).toBe(-14)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })
})
