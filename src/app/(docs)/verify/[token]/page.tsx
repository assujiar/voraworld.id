import { notFound } from 'next/navigation'
import { documentType, type Lang } from '@/content/document-types'
import { today } from '@/server/dates'
import { sql } from '@/server/db'
import { findVerification } from '@/server/verification'

const KINDS = { invoice: 'invoices', receipt: 'receipts', quotation: 'quotations', prepayment: 'prepayment_receipts', document: 'documents' } as const
/** A quotation is issued as a Price Agreement Letter, and the page says so. */
const LABELS = { invoice: 'Invoice', receipt: 'Receipt', quotation: 'Price Agreement Letter', prepayment: 'Pre-Payment Receipt', document: 'Document' } as const

/**
 * What a QR code on a VORA document opens. It states the document type, reference, issuer, date and current
 * status, and nothing about the customer or the amounts.
 */
export default async function Verify({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const row = await findVerification(sql, token)
  const table = row ? KINDS[row.kind as keyof typeof KINDS] : undefined
  if (!row || !table) notFound()
  const [doc] = await sql`select * from ${sql(table)} where id = ${row.documentId}`
  if (!doc) notFound()
  const kind = row.kind
  const state = doc.status as string
  const status = row.revoked || state === 'void' ? 'VOID' : (kind === 'receipt' || kind === 'prepayment') && state === 'pending_stamp' ? 'PENDING E-METERAI' : state === 'draft' ? 'DRAFT' : 'AUTHENTIC'
  // A pre-payment receipt is no proof of payment: the page shows the state of the invoice it belongs to, and the official receipt is a separate document.
  const [invoice] = kind === 'prepayment' ? await sql`select status, issued_at from invoices where id = ${doc.invoiceId as number}` : [doc]
  const invoiceState = invoice?.status as string
  const live = !row.revoked && state !== 'void' && !(kind === 'prepayment' && invoiceState === 'void')
  const payment = (kind === 'invoice' || kind === 'prepayment') && live ? (invoiceState === 'paid' ? 'OFFICIALLY PAID' : invoiceState === 'partially_paid' ? 'PARTIALLY PAID' : 'AWAITING PAYMENT') : ''
  const date = kind === 'receipt' ? today(doc.createdAt as Date) : String(kind === 'prepayment' ? invoice.issuedAt : kind === 'document' ? doc.documentDate : doc.issuedAt)
  // A general document is named by its own type, in its own language. Only a certificate says who holds it: that is what a certificate is for.
  const general = kind === 'document' ? documentType(doc.kind as string) : undefined
  const label = general ? general.label[doc.language as Lang] : LABELS[kind as keyof typeof LABELS]
  const values = general ? ((doc.fields as { values?: Record<string, string> } | null)?.values ?? {}) : {}
  const holder = general?.publicHolder && !row.revoked && state !== 'void' && state !== 'draft' ? values : null
  return (
    <main className="wrap" style={{ maxWidth: 750, paddingTop: '10vh' }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" alt="VORA" width={160} /></a>
      <div className="form-panel" style={{ marginTop: 35 }}>
        <span className="eyebrow">Document authentication</span>
        <h1 style={{ fontSize: '3rem' }}>{status}</h1>
        <p><strong>Document:</strong> {label}<br />
          <strong>Reference:</strong> {doc.number as string}<br />
          <strong>Issuer:</strong> VORA / PT Satu Arah International<br />
          <strong>Date:</strong> {date}</p>
        {holder ? <p><strong>Awarded to:</strong> {holder.recipient_name}<br /><strong>Title:</strong> {holder.title}{holder.valid_until ? <><br /><strong>Valid until:</strong> {holder.valid_until}</> : null}</p> : null}
        {payment ? <p><strong>{kind === 'prepayment' ? 'Status of the invoice:' : 'Payment status:'}</strong> {payment}</p> : null}
        {kind === 'prepayment' ? <p className="mini muted">A pre-payment receipt is issued before payment and is not proof that payment was made. Payment is proven only by VORA&apos;s official payment receipt.</p> : null}
        <p className="note">Check the document type, reference, issuer, date and current status. Customer and financial details remain private.</p>
      </div>
    </main>
  )
}
