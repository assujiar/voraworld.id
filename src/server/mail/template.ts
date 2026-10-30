import { one } from '../data'
import { cleanHtml } from '../sanitize'

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Python `string.Template.safe_substitute`: `$name`, `${name}`, `$$`; unknown names are left untouched. */
export function safeSubstitute(template: string, values: Record<string, string>): string {
  return template.replace(/\$(?:(\$)|([_a-zA-Z][_a-zA-Z0-9]*)|\{([_a-zA-Z][_a-zA-Z0-9]*)\})/g, (match, dollar, a, b) => {
    if (dollar) return '$'
    const name = a ?? b
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match
  })
}

/** All context values are HTML-escaped before they meet admin-edited markup, and the result is sanitised again. */
export async function renderTemplate(event: string, context: Record<string, unknown>): Promise<{ subject: string; html: string }> {
  const template = await one('email_templates', (q) => q.eq('key', event), 'subject,html')
  if (!template) throw new Error('Missing email template: ' + event)
  const raw: Record<string, string> = {}
  const escaped: Record<string, string> = {}
  for (const [k, v] of Object.entries(context)) {
    raw[k] = String(v ?? '')
    escaped[k] = escapeHtml(raw[k]).replace(/\r?\n/g, '<br>')     // a typed message keeps its line breaks
  }
  const subject = safeSubstitute(template.subject as string, raw).replace(/[\r\n\x00-\x1f\x7f]+/g, ' ').slice(0, 250)
  if (!subject.trim()) throw new Error('Email template subject is empty')
  return { subject, html: cleanHtml(safeSubstitute(template.html as string, escaped)) }
}
