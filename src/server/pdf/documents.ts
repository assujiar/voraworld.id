import type { Db } from '../db'
import { settingMap } from '../settings'
import { ActionError } from '../errors'
import { readStampedReceipt } from '../finance/receipts'
import { getVerification, type DocumentKind } from '../verification'
import { renderPaginated } from './invoice'
import { COMPACT_MAX_ITEMS, renderQuotationOnePage } from './quotation'
import { renderReceipt } from './receipt'
import type { BankLine, InvoiceData, Issuer, LineData, Party, QuotationData, ReceiptData } from './types'

const party = (r: Record<string, unknown> | undefined, name?: string): Party => ({
  name: name ?? String(r?.name ?? ''), address: String(r?.address ?? ''), email: String(r?.email ?? ''), taxId: String(r?.taxId ?? ''),
})
const lines = (rows: Array<Record<string, unknown>>): LineData[] => rows.map((i) => ({
  description: String(i.description), unit: String(i.unit), quantity: String(i.quantity), priceMinor: i.priceMinor as number, amountMinor: i.amountMinor as number,
}))

async function issuerOf(db: Db): Promise<Issuer> {
  const s = await settingMap(db)
  return { legalName: s.legal_name || 'PT Satu Arah International', address: s.address || '', email: s.email || 'info@voraworld.id' }
}

async function verifyUrl(db: Db, kind: DocumentKind, id: number, baseUrl: string): Promise<string> {
  const v = await getVerification(db, kind, id)
  if (!v) throw new ActionError('The document has no verification token', 409)
  return `${baseUrl.replace(/\/+$/, '')}/verify/${v.token}`
}

/**
 * The PDF of an invoice, quotation or receipt, built from the database. A receipt that needed an e-meterai and has been
 * released is NOT regenerated: the stamped file from private storage is returned (after its SHA-256 check), because
 * a re-rendered copy would not carry the stamp.
 */
export async function renderDocumentPdf(db: Db, kind: DocumentKind, id: number, baseUrl: string): Promise<Uint8Array> {
  if (kind === 'invoice') return invoicePdf(db, id, baseUrl)
  if (kind === 'quotation') return quotationPdf(db, id, baseUrl)
  return receiptPdf(db, id, baseUrl)
}

async function invoicePdf(db: Db, id: number, baseUrl: string): Promise<Uint8Array> {
  const [inv] = await db`select * from invoices where id = ${id}`
  if (!inv) throw new ActionError('Invoice not found', 404)
  const [customer] = await db`select * from customers where id = ${inv.customerId as number}`
  const items = await db`select * from invoice_items where invoice_id = ${id} order by id`
  const banks = await db`select * from invoice_bank_instructions where invoice_id = ${id} order by position, id`
  const data: InvoiceData = {
    number: inv.number as string, status: inv.status as string, currency: inv.currency as string, issuedAt: String(inv.issuedAt ?? ''), dueAt: String(inv.dueAt ?? ''),
    poNumber: String(inv.poNumber ?? ''), shipmentReference: String(inv.shipmentReference ?? ''), serviceMode: String(inv.serviceMode ?? ''), origin: String(inv.origin ?? ''),
    destination: String(inv.destination ?? ''), transportDocumentRef: String(inv.transportDocumentRef ?? ''), notes: String(inv.notes ?? ''),
    taxPercent: String(inv.taxPercent), withholdingPercent: String(inv.withholdingPercent), discountMinor: inv.discountMinor as number, subtotalMinor: inv.subtotalMinor as number,
    taxMinor: inv.taxMinor as number, withholdingMinor: inv.withholdingMinor as number, totalMinor: inv.totalMinor as number, outstandingMinor: inv.outstandingMinor as number,
    items: lines(items), customer: party(customer),
    banks: banks.map((b): BankLine => ({ bankName: b.bankName as string, accountNumber: b.accountNumber as string, accountHolder: b.accountHolder as string, currency: b.currency as string, swiftCode: String(b.swiftCode ?? ''), position: b.position as number })),
  }
  return renderPaginated({ kind: 'invoice', ...data }, await issuerOf(db), await verifyUrl(db, 'invoice', id, baseUrl))
}

async function quotationPdf(db: Db, id: number, baseUrl: string): Promise<Uint8Array> {
  const [q] = await db`select * from quotations where id = ${id}`
  if (!q) throw new ActionError('Quotation not found', 404)
  const [recipient] = q.customerId
    ? await db`select * from customers where id = ${q.customerId as number}`
    : await db`select coalesce(nullif(company, ''), name) as name, email, '' as address, '' as tax_id from leads where id = ${q.leadId as number}`
  if (!recipient) throw new ActionError('The quotation recipient is missing', 409)
  const items = await db`select * from quotation_items where quotation_id = ${id} order by id`
  const data: QuotationData = {
    number: q.number as string, status: q.status as string, currency: q.currency as string, issuedAt: q.issuedAt as string, validUntil: q.validUntil as string, notes: String(q.notes ?? ''),
    taxPercent: String(q.taxPercent), subtotalMinor: q.subtotalMinor as number, taxMinor: q.taxMinor as number, totalMinor: q.totalMinor as number, items: lines(items), recipient: party(recipient),
  }
  const issuer = await issuerOf(db)
  const url = await verifyUrl(db, 'quotation', id, baseUrl)
  return data.items.length <= COMPACT_MAX_ITEMS ? renderQuotationOnePage(data, issuer, url) : renderPaginated({ kind: 'quotation', ...data }, issuer, url)
}

async function receiptPdf(db: Db, id: number, baseUrl: string): Promise<Uint8Array> {
  const [r] = await db`select * from receipts where id = ${id}`
  if (!r) throw new ActionError('Receipt not found', 404)
  if (r.stampRequired && r.status === 'issued') return readStampedReceipt(r as never)
  const [p] = await db`select * from payments where id = ${r.paymentId as number}`
  if (!p || p.status !== 'recorded') throw new ActionError('A receipt is only available after the funds are confirmed', 409)
  const [inv] = await db`select * from invoices where id = ${r.invoiceId as number}`
  const [customer] = await db`select * from customers where id = ${inv.customerId as number}`
  const [reviewer] = p.confirmedBy ? await db`select email from users where id = ${p.confirmedBy as number}` : []
  const data: ReceiptData = {
    number: r.number as string, status: r.status as string, stampRequired: Boolean(r.stampRequired), issuedOn: (r.createdAt as Date).toISOString().slice(0, 10),
    payment: { id: p.id as number, amountMinor: p.amountMinor as number, date: String(p.date ?? ''), method: String(p.method ?? ''), reference: String(p.reference ?? ''),
      confirmedAt: (p.confirmedAt as Date | null) ?? null, confirmedBy: String(reviewer?.email ?? ''), bank: (p.receivingBankSnapshot as Record<string, string> | null) ?? null },
    invoice: { number: inv.number as string, currency: inv.currency as string, totalMinor: inv.totalMinor as number, outstandingMinor: inv.outstandingMinor as number },
    payer: party(customer),
  }
  return renderReceipt(data, await issuerOf(db), await verifyUrl(db, 'receipt', id, baseUrl))
}
