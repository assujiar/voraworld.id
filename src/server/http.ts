/** Errors that map straight to an HTTP status. Route handlers turn them into text responses. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return new Response(e.message, { status: e.status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
  console.error(e)
  return new Response('Internal server error', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

/** 303 redirect carrying either a notice or `saved=1`, matching the earlier admin UX. */
export function seeOther(path: string, notice = ''): Response {
  const url = path + (path.includes('?') ? '&' : '?') + (notice ? 'notice=' + encodeURIComponent(notice) : 'saved=1')
  return new Response(null, { status: 303, headers: { location: url } })
}

/** PostgreSQL text cannot hold NUL bytes (they would surface as a 500), and no legitimate field contains one. */
const text = (v: FormDataEntryValue | null): string | null => (typeof v === 'string' ? v.replaceAll('\u0000', '') : null)

export function str(form: FormData, key: string, max = 2000): string {
  return (text(form.get(key)) ?? '').trim().slice(0, max)
}
export const rawStr = (form: FormData, key: string, max = 12000): string => (text(form.get(key)) ?? '').slice(0, max)
/** Integer form field limited to PostgreSQL `integer` range, so a hostile value can never reach a query as an out-of-range parameter. */
export function int(form: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(String(form.get(key) ?? ''), 10)
  return Number.isSafeInteger(n) && Math.abs(n) <= 2_147_483_647 ? n : fallback
}
