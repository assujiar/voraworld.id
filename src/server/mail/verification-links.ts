import { many } from '../data'
import { rpc } from '../data'
import type { DocumentKind } from '../verification'

/**
 * Every email that carries or is about a VORA document ends with a clickable link to that document's verification page, whatever the (admin-editable) template says.
 * A template may already contain the link and then nothing is added; a template that never had one, or from which it was deleted, gets this block.
 */
export interface VerifyLink { label: string; url: string }

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Only an address on the site's own origin, under /verify/: nothing else can be put in the block, so a value taken from data can never point somewhere else. */
export function isVerifyUrl(url: string, origin: string): boolean {
  try {
    const u = new URL(url)
    return u.origin === new URL(origin).origin && /^\/verify\/[A-Za-z0-9_-]{8,150}$/.test(u.pathname) && !u.search && !u.hash && !u.username && !u.password
  } catch { return false }
}

/** The HTML with a "verify this document" block for each link that is not in it yet. Unchanged when every link is already there. */
export function withVerificationLinks(html: string, links: VerifyLink[], origin: string): string {
  const seen = new Set<string>()
  const missing = links.filter((l) => {
    if (!isVerifyUrl(l.url, origin) || seen.has(l.url)) return false
    seen.add(l.url)
    return !html.includes(l.url)
  })
  if (!missing.length) return html
  const rows = missing.map((l) => `<div style="margin:4px 0">${l.label ? `<strong>${escapeHtml(l.label)}</strong><br>` : ''}<a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></div>`).join('')
  return `${html}<div style="margin-top:20px;padding-top:12px;border-top:1px solid #DCE0E1;font-size:13px;line-height:1.5"><strong>Periksa keaslian dokumen / Verify this document</strong>${rows}<span style="color:#64717C">Klik tautan di atas untuk memeriksa dokumen dan status terkininya di voraworld.id. / Click the link above to check the document and its current status on voraworld.id.</span></div>`
}

const TABLES: Record<DocumentKind, string> = { invoice: 'invoices', receipt: 'receipts', quotation: 'quotations', prepayment: 'prepayment_receipts', document: 'documents', delivery: 'deliveries', pod: 'deliveries' }

/** The verification links of documents, with their numbers as labels. `delivery` and `pod` get a verification record when they have none yet. */
export async function resolveVerifyLinks(docs: Array<{ kind: DocumentKind; id: number }>, baseUrl: string): Promise<VerifyLink[]> {
  const out: VerifyLink[] = []
  for (const d of docs) {
    const token = d.kind === 'delivery' || d.kind === 'pod'
      ? await rpc<string>('trust_ensure_verification', { p_kind: d.kind, p_document: d.id })
      : (await many('document_verification_tokens', (q) => q.eq('kind', d.kind).eq('document_id', d.id).eq('revoked', false).order('id'), 'token', 1))[0]?.token as string | undefined
    if (!token) continue
    const num = (await many(TABLES[d.kind], (q) => q.eq('id', d.id), 'number', 1))[0]?.number as string | undefined
    out.push({ label: d.kind === 'pod' && num ? `${num} (proof of delivery)` : (num ?? ''), url: `${baseUrl.replace(/\/+$/, '')}/verify/${token}` })
  }
  return out
}
