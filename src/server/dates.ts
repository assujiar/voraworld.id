import { ActionError } from './errors'

/** VORA is a Jakarta company: "today" on a document is the date in Jakarta, not in UTC (they differ for 7 hours a day). */
export const BUSINESS_TIME_ZONE = 'Asia/Jakarta'

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Today's date in the business time zone as YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** "2026-10-29 14:05" for a moment in time, read off the Jakarta clock. */
export function businessDateTime(d: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((x) => [x.type, x.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** "2026-10-29" for a moment in time, read off the Jakarta clock: the day a document was issued or signed, as the stamps and pages show it (the exact time stays in the evidence record). */
export function businessDay(d: Date): string {
  return businessDateTime(d).slice(0, 10)
}

export function isIsoDay(value: string): boolean {
  const m = ISO_DAY.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/** A real calendar date in YYYY-MM-DD form, or `fallback` when the field is empty. */
export function isoDay(value: string, fallback: string, label = 'Date'): string {
  const v = value.trim() || fallback
  if (!isIsoDay(v)) throw new ActionError(`${label} must be a valid date (YYYY-MM-DD)`)
  return v
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
}
