import { notFound } from 'next/navigation'
import { today } from '@/server/dates'
import { sql } from '@/server/db'
import { findVerification } from '@/server/verification'

const KINDS = { invoice: 'invoices', receipt: 'receipts', quotation: 'quotations' } as const
/** A quotation is issued as a Price Agreement Letter, and the page says so. */
const LABELS = { invoice: 'Invoice', receipt: 'Receipt', quotation: 'Price Agreement Letter' } as const

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
  const status = row.revoked || state === 'void' ? 'VOID' : kind === 'receipt' && state === 'pending_stamp' ? 'PENDING E-METERAI' : state === 'draft' ? 'DRAFT' : 'AUTHENTIC'
  const payment = kind === 'invoice' && !row.revoked && state !== 'void' ? (state === 'paid' ? 'OFFICIALLY PAID' : state === 'partially_paid' ? 'PARTIALLY PAID' : 'AWAITING PAYMENT') : ''
  const date = kind === 'receipt' ? today(doc.createdAt as Date) : (doc.issuedAt as string)
  return (
    <main className="wrap" style={{ maxWidth: 750, paddingTop: '10vh' }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" alt="VORA" width={160} /></a>
      <div className="form-panel" style={{ marginTop: 35 }}>
        <span className="eyebrow">Document authentication</span>
        <h1 style={{ fontSize: '3rem' }}>{status}</h1>
        <p><strong>Document:</strong> {LABELS[kind as keyof typeof LABELS]}<br />
          <strong>Reference:</strong> {doc.number as string}<br />
          <strong>Issuer:</strong> VORA / PT Satu Arah International<br />
          <strong>Date:</strong> {date}</p>
        {payment ? <p><strong>Payment status:</strong> {payment}</p> : null}
        <p className="note">Check the document type, reference, issuer, date and current status. Customer and financial details remain private.</p>
      </div>
    </main>
  )
}
