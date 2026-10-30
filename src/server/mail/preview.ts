import events from '@/content/email-events.json'
import { cleanEmailHtml } from './sanitize-email'
import { safeSubstitute } from './template'

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Made-up values for the variables a template can use, so a preview reads like a real message. They are never stored or sent to a customer. */
const SAMPLE: Record<string, string> = {
  customer_name: 'PT Contoh Maju', name: 'Dewi Lestari', company: 'PT Contoh Maju', email: 'dewi@contoh.example', phone: '+62 811 0000 111',
  lead_id: '1024', lead_type: 'RFQ', mode: 'Sea Export', origin: 'Jakarta', destination: 'Rotterdam', message: 'Mohon penawaran untuk 2 x 20 ft.',
  document_number: 'INV-VORA-C0000000000-202610-00001', document_date: '30 Oct 2026', prepayment_number: 'PPR-VORA-C0000000000-202610-00001',
  invoice_number: 'INV-VORA-C0000000000-202610-00001', invoice_status: 'Lunas', payment_amount: 'IDR 12.500.000', payment_date: '30 Oct 2026', payment_reference: 'TRF-88421',
  outstanding_amount: 'IDR 0', consignee_name: 'PT Penerima Jaya', receiver_name: 'Siti Aminah', delivered_at: '30 Oct 2026 14:20 WIB',
  admin_url: '/admin', pod_url: '/pod/view/contoh', verify_url: '/verify/contoh', approval_url: '/quotation-approval/contoh', signer_name: 'Budi Santoso',
}

const names = (text: string) => [...new Set([...text.matchAll(/\$(?:([_a-zA-Z][_a-zA-Z0-9]*)|\{([_a-zA-Z][_a-zA-Z0-9]*)\})/g)].map((m) => m[1] ?? m[2]))]

/** The variables a template can use: those of its default text (the ones the application fills in) and any it already uses. */
export function variablesOf(key: string, subject = '', html = ''): string[] {
  const base = (events as Record<string, { subject: string; html: string }>)[key]
  return [...new Set([...names(`${base?.subject ?? ''} ${base?.html ?? ''}`), ...names(`${subject} ${html}`)])]
}

/**
 * What a message made from this subject and HTML would look like: the same two sanitising passes as saving and sending, with sample values in place
 * of the variables. Variables the application does not know stay visible as written, so a typo is seen in the preview and not in a customer's mailbox.
 */
export function previewTemplate(subject: string, html: string): { subject: string; html: string; unknown: string[] } {
  const stored = cleanEmailHtml(html.slice(0, 20_000), true)
  const raw: Record<string, string> = {}
  const escaped: Record<string, string> = {}
  for (const [k, v] of Object.entries(SAMPLE)) { raw[k] = v; escaped[k] = escapeHtml(v) }
  const unknown = names(`${subject} ${html}`).filter((n) => !(n in SAMPLE))
  return {
    subject: safeSubstitute(subject.slice(0, 250), raw).replace(/[\r\n\x00-\x1f\x7f]+/g, ' '),
    html: cleanEmailHtml(safeSubstitute(stored, escaped)),
    unknown,
  }
}
