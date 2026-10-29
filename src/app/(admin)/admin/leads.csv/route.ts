import { sql } from '@/server/db'
import { requireUser } from '@/server/auth/guard'
import { errorResponse } from '@/server/http'

const COLUMNS = ['id', 'reference', 'public_code', 'type', 'name', 'company', 'email', 'status', 'priority', 'mode', 'origin', 'destination', 'created_at'] as const
/** Neutralises spreadsheet formula injection (a cell starting with = + - @ would run as a formula in Excel). */
const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? '')
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const rows = await sql`select id, reference, public_code, type, name, company, email, status, priority, mode, origin, destination, created_at from leads order by id`
    const camel = (c: string) => c.replace(/_([a-z])/g, (_, x: string) => x.toUpperCase())
    const body = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell((r as Record<string, unknown>)[camel(c)])).join(','))].join('\r\n') + '\r\n'
    return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="vora-leads.csv"', 'cache-control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
