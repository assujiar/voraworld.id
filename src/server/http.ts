import { ActionError } from './errors'

/** Errors that map straight to an HTTP status. Route handlers turn them into text responses. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError || e instanceof ActionError) return new Response(e.message, { status: e.status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
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

/** An uploaded file's bytes, or null when the field has no file. Oversize files are rejected before they are read. */
export async function fileBytes(form: FormData, key: string, maxBytes: number): Promise<Uint8Array | null> {
  const v = form.get(key)
  if (!v || typeof v === 'string' || !v.size) return null
  if (v.size > maxBytes) throw new ActionError(`The file exceeds the ${Math.floor(maxBytes / 1048576)} MB limit`, 413)
  return new Uint8Array(await v.arrayBuffer())
}

/** A private PDF download: never cached, never sniffed, and the file name is a VORA document number (no user input). */
export function pdfResponse(bytes: Uint8Array, filename: string, disposition: 'inline' | 'attachment' = 'inline'): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf', 'content-disposition': `${disposition}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    },
  })
}
