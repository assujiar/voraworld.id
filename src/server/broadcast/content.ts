import { cleanEmailHtml } from '@/server/mail/sanitize-email'

const escaped = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
export const BROADCAST_SAMPLE = { company_name: 'PT Example Logistics', pic_name: 'Alex', position: 'Logistics Manager', email: 'alex@example.com' }
export type BroadcastVars = typeof BROADCAST_SAMPLE

export function emailSubject(input: string): string {
  return input.replace(/[\r\n\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 200)
}

/** Only these four variable names are accepted. Escaping happens before HTML is sanitised. */
export function renderBroadcast(subject: string, html: string, vars: BroadcastVars, unsubscribeUrl: string): { subject: string; html: string } {
  const raw = (input: string, encode: (s: string) => string) => input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const value = (vars as unknown as Record<string, string>)[key.toLowerCase()]
    return value === undefined ? '' : encode(value)
  })
  const finalSubject = emailSubject(raw(subject, (s) => s))
  if (!finalSubject) throw new Error('Email subject is empty')
  const safeBody = cleanEmailHtml(raw(html, escaped))
  const safeLink = escaped(unsubscribeUrl)
  const footer = `<hr><p style="font-family:Arial;font-size:12px;color:#666666">VORA | PT Satu Arah International<br>You received this email because you subscribed to VORA updates. ` +
    `<a href="${safeLink}">Unsubscribe</a> from promotional emails.</p>`
  return { subject: finalSubject, html: cleanEmailHtml(safeBody + footer) }
}

/** Parse CSV including quotes and embedded newlines; formula-looking values remain inert text. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else if (!quoted && field === '') quoted = true
      else if (quoted) quoted = false
      else throw new Error(`Invalid CSV quotes near character ${i}`)
    } else if (c === ',' && !quoted) { row.push(field); field = '' }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); if (row.some((v) => v.trim())) rows.push(row)
      row = []; field = ''
    } else field += c
  }
  if (quoted) throw new Error('Unclosed CSV quotation')
  row.push(field)
  if (row.some((v) => v.trim())) rows.push(row)
  return rows
}

export const CSV_FIELDS = ['company_name', 'pic_name', 'position', 'email', 'phone', 'country', 'business_category', 'tags', 'source', 'consent_status', 'consent_evidence'] as const
export function csvEscape(v: unknown): string {
  const raw = String(v ?? '')
  // Excel guards: avoid interpreting user-supplied data as formulas when CSV is opened.
  const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
