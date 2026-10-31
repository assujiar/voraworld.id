import { many, one } from '../data'
import { settingMap } from '../settings'
import { sha256Hex } from '../crypto'
import { today } from '../dates'
import { ActionError } from '../errors'
import { approvalSecret, approvalToken } from '../finance/approval-token'
import { readStampedReceipt } from '../finance/receipts'
import { getVerification, type DocumentKind } from '../verification'
import { documentType } from '../../content/document-types'
import { readSealed, readSource, type StoredFields } from '../documents/general'
import { sealPdf } from './seal'
import { trustedPdf } from '../trust/serve'
import { businessDateTime } from '../dates'
import { renderCertificate } from './certificate'
import { renderGeneral } from './general'
import { renderInvoice } from './invoice'
import { renderPrepayment } from './prepayment'
import { renderQuotation } from './quotation'
import { renderReceipt } from './receipt'
import type { BankLine, GeneralDocData, InvoiceData, Issuer, LineData, Party, PrepaymentData, QuotationData, ReceiptData } from './types'

const party = (r: Record<string, unknown> | undefined, name?: string): Party => ({
  name: name ?? String(r?.name ?? ''), address: String(r?.address ?? ''), email: String(r?.email ?? ''), taxId: String(r?.taxId ?? ''),
})
const lines = (rows: Array<Record<string, unknown>>): LineData[] => rows.map((i) => ({
  description: String(i.description), unit: String(i.unit), quantity: String(i.quantity), priceMinor: i.priceMinor as number, amountMinor: i.amountMinor as number,
}))

async function issuerOf(): Promise<Issuer> {
  const s = await settingMap()
  return { legalName: s.legal_name || 'PT Satu Arah International', address: s.address || '', email: s.email || 'info@voraworld.id', taxId: (s.tax_id || '').trim() }
}

async function verifyUrl(kind: DocumentKind, id: number, baseUrl: string): Promise<string> {
  const v = await getVerification(kind, id)
  if (!v) throw new ActionError('The document has no verification token', 409)
  return `${baseUrl.replace(/\/+$/, '')}/verify/${v.token}`
}

/**
 * The PDF of an invoice, quotation, receipt or pre-payment receipt, built from the database. A (pre-payment) receipt that needed an e-meterai and has been
 * released is NOT regenerated: the stamped file from private storage is returned (after its SHA-256 check), because
 * a re-rendered copy would not carry the stamp.
 */
export async function renderDocumentPdf(kind: DocumentKind, id: number, baseUrl: string): Promise<Uint8Array> {
  const meta = await metaOf(kind, id)
  // A receipt that needed an e-meterai is released as the stored stamped file, never re-rendered; the live path below hands that back (after its SHA-256 check).
  return trustedPdf({ kind, id, number: meta.number, documentKind: meta.documentKind, candidate: meta.candidate, sourceSha256: meta.sourceSha256, render: () => renderLive(kind, id, baseUrl) })
}

/** The few facts the archive decision needs about a document, read from its own table. */
async function metaOf(kind: DocumentKind, id: number): Promise<{ number: string; documentKind?: string; candidate: { status: string; createdAt: Date | null; stampRequired?: boolean }; sourceSha256?: string }> {
  const table = { invoice: 'invoices', quotation: 'quotations', receipt: 'receipts', prepayment: 'prepayment_receipts', document: 'documents', delivery: 'deliveries', pod: 'deliveries' }[kind]
  const row = await one(table, (q) => q.eq('id', id))
  if (!row) throw new ActionError(`${{ invoice: 'Invoice', quotation: 'Quotation', receipt: 'Receipt', prepayment: 'Pre-payment receipt', document: 'Document', delivery: 'Delivery note', pod: 'Delivery note' }[kind]} not found`, 404)
  const stored = kind === 'document' ? (row.fields as StoredFields | null) : null
  return {
    number: row.number as string, documentKind: kind === 'document' ? (row.kind as string) : undefined,
    candidate: { status: row.status as string, createdAt: (row.createdAt as Date) ?? null, stampRequired: Boolean(row.stampRequired) },
    sourceSha256: stored?.source?.sha256,
  }
}

async function renderLive(kind: DocumentKind, id: number, baseUrl: string): Promise<Uint8Array> {
  if (kind === 'invoice') return invoicePdf(id, baseUrl)
  if (kind === 'quotation') return quotationPdf(id, baseUrl)
  if (kind === 'prepayment') return prepaymentPdf(id, baseUrl)
  if (kind === 'document') return generalPdf(id, baseUrl)
  if (kind === 'receipt') return receiptPdf(id, baseUrl)
  throw new ActionError('Delivery notes and proofs of delivery have their own PDF routes', 400)
}

async function invoicePdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const inv = await one('invoices', (q) => q.eq('id', id))
  if (!inv) throw new ActionError('Invoice not found', 404)
  const [customer, items, banks, quotation, links] = await Promise.all([
    one('customers', (q) => q.eq('id', inv.customerId as number)),
    many('invoice_items', (q) => q.eq('invoice_id', id).order('id')),
    many('invoice_bank_instructions', (q) => q.eq('invoice_id', id).order('position').order('id')),
    inv.quotationId ? one('quotations', (q) => q.eq('id', inv.quotationId as number), 'number') : Promise.resolve(undefined),
    many('invoice_delivery_notes', (q) => q.eq('invoice_id', id).order('id'), 'delivery_id'),
  ])
  const deliveryRows = links.length ? await many('deliveries', (q) => q.in('id', links.map((l) => l.deliveryId as number)).order('id'), 'number') : []
  const data: InvoiceData = {
    number: inv.number as string, status: inv.status as string, currency: inv.currency as string, issuedAt: String(inv.issuedAt ?? ''), dueAt: String(inv.dueAt ?? ''),
    poNumber: String(inv.poNumber ?? ''), shipmentReference: String(inv.shipmentReference ?? ''), serviceMode: String(inv.serviceMode ?? ''), origin: String(inv.origin ?? ''),
    destination: String(inv.destination ?? ''), transportDocumentRef: String(inv.transportDocumentRef ?? ''), notes: String(inv.notes ?? ''),
    taxPercent: String(inv.taxPercent), withholdingPercent: String(inv.withholdingPercent), discountMinor: inv.discountMinor as number, subtotalMinor: inv.subtotalMinor as number,
    taxMinor: inv.taxMinor as number, withholdingMinor: inv.withholdingMinor as number, totalMinor: inv.totalMinor as number, outstandingMinor: inv.outstandingMinor as number,
    items: lines(items), customer: party(customer), quotationNumber: quotation ? (quotation.number as string) : undefined, deliveryNumbers: deliveryRows.map((d) => d.number as string),
    banks: banks.map((b): BankLine => ({ bankName: b.bankName as string, accountNumber: b.accountNumber as string, accountHolder: b.accountHolder as string, currency: b.currency as string, swiftCode: String(b.swiftCode ?? ''), position: b.position as number })),
  }
  return renderInvoice(data, await issuerOf(), await verifyUrl('invoice', id, baseUrl))
}

async function quotationPdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const q = await one('quotations', (f) => f.eq('id', id))
  if (!q) throw new ActionError('Quotation not found', 404)
  let recipient: Record<string, unknown> | undefined
  if (q.customerId) recipient = await one('customers', (f) => f.eq('id', q.customerId as number))
  else {
    const lead = await one('leads', (f) => f.eq('id', q.leadId as number), 'company,name,email')
    recipient = lead && { name: (lead.company as string) || lead.name, email: lead.email, address: '', taxId: '' }
  }
  if (!recipient) throw new ActionError('The quotation recipient is missing', 409)
  const items = await many('quotation_items', (f) => f.eq('quotation_id', id).order('id'))
  const data: QuotationData = {
    number: q.number as string, status: q.status as string, currency: q.currency as string, issuedAt: q.issuedAt as string, validUntil: q.validUntil as string,
    paymentTerms: String(q.paymentTerms ?? ''), termsConditions: String(q.termsConditions ?? ''), notes: String(q.notes ?? ''),
    taxPercent: String(q.taxPercent), subtotalMinor: q.subtotalMinor as number, taxMinor: q.taxMinor as number, totalMinor: q.totalMinor as number, items: lines(items), recipient: party(recipient),
  }
  // While a customer approval request is open, its private upload address is printed (and clickable) in the approval area.
  const open = q.status === 'awaiting_approval'
    ? (await many('quotation_approvals', (f) => f.eq('quotation_id', id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('id', { ascending: false }), 'id,token_hash', 1))[0]
    : undefined
  if (open) {
    const token = approvalToken(await approvalSecret(), open.id as number)
    if ((await sha256Hex(token)) === open.tokenHash) data.uploadUrl = `${baseUrl.replace(/\/+$/, '')}/quotation-approval/${token}`   // a link from before addresses were derived has no printable form
  }
  const issuer = await issuerOf()
  const url = await verifyUrl('quotation', id, baseUrl)
  return renderQuotation(data, issuer, url)
}

async function receiptPdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const r = await one('receipts', (q) => q.eq('id', id))
  if (!r) throw new ActionError('Receipt not found', 404)
  if (r.stampRequired && r.status === 'issued') return readStampedReceipt(r as never)
  const p = await one('payments', (q) => q.eq('id', r.paymentId as number))
  if (!p || p.status !== 'recorded') throw new ActionError('A receipt is only available after the funds are confirmed', 409)
  const inv = (await one('invoices', (q) => q.eq('id', r.invoiceId as number)))!
  const customer = await one('customers', (q) => q.eq('id', inv.customerId as number))
  const reviewer = p.confirmedBy ? await one('users', (q) => q.eq('id', p.confirmedBy as number), 'email') : undefined
  const data: ReceiptData = {
    number: r.number as string, status: r.status as string, stampRequired: Boolean(r.stampRequired), issuedOn: today(r.createdAt as Date),
    payment: { id: p.id as number, amountMinor: p.amountMinor as number, date: String(p.date ?? ''), method: String(p.method ?? ''), reference: String(p.reference ?? ''),
      confirmedAt: (p.confirmedAt as Date | null) ?? null, confirmedBy: String(reviewer?.email ?? ''), bank: (p.receivingBankSnapshot as Record<string, string> | null) ?? null },
    invoice: { number: inv.number as string, currency: inv.currency as string, totalMinor: inv.totalMinor as number, outstandingMinor: inv.outstandingMinor as number },
    payer: party(customer),
  }
  return renderReceipt(data, await issuerOf(), await verifyUrl('receipt', id, baseUrl))
}

async function prepaymentPdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const p = await one('prepayment_receipts', (q) => q.eq('id', id))
  if (!p) throw new ActionError('Pre-payment receipt not found', 404)
  if (p.stampRequired && p.status === 'issued') return readStampedReceipt(p as never)
  const inv = (await one('invoices', (q) => q.eq('id', p.invoiceId as number)))!
  const [customer, banks] = await Promise.all([
    one('customers', (q) => q.eq('id', inv.customerId as number)),
    many('invoice_bank_instructions', (q) => q.eq('invoice_id', inv.id as number).order('position').order('id')),
  ])
  const data: PrepaymentData = {
    number: p.number as string, status: p.status as string, stampRequired: Boolean(p.stampRequired), issuedOn: String(inv.issuedAt ?? ''),
    currency: p.currency as string, amountMinor: p.amountMinor as number,
    invoice: { number: inv.number as string, issuedAt: String(inv.issuedAt ?? ''), dueAt: String(inv.dueAt ?? ''), poNumber: String(inv.poNumber ?? ''), shipmentReference: String(inv.shipmentReference ?? '') },
    payer: party(customer),
    banks: banks.map((b): BankLine => ({ bankName: b.bankName as string, accountNumber: b.accountNumber as string, accountHolder: b.accountHolder as string, currency: b.currency as string, swiftCode: String(b.swiftCode ?? ''), position: b.position as number })),
  }
  return renderPrepayment(data, await issuerOf(), await verifyUrl('prepayment', id, baseUrl))
}

/** The distinct accounts on a set of invoices, in the order the invoices list them, at most four. */
function acceptedAccounts(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Map<string, Record<string, unknown>>()
  for (const r of rows) {
    const key = [r.bankName, r.accountNumber, r.accountHolder, r.currency, r.swiftCode].join('\u0000')
    const known = seen.get(key)
    if (!known || (r.position as number) < (known.position as number)) seen.set(key, r)
  }
  return [...seen.values()].sort((a, b) => (a.position as number) - (b.position as number) || String(a.bankName).localeCompare(String(b.bankName))).slice(0, 4)
}

/** A general document: a letter, statement, certificate... Drawn from what was typed; a draft and a void one are marked as such on every page. */
async function generalPdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const doc = await one('documents', (q) => q.eq('id', id))
  if (!doc) throw new ActionError('Document not found', 404)
  const type = documentType(doc.kind as string)
  if (!type) throw new ActionError('This document type is no longer supported', 409)
  const stored = doc.fields as StoredFields
  if (type.family === 'seal') return sealedFile(doc, stored, id, baseUrl)
  const invoices = stored.invoices ?? []
  // A billing letter pays into the accounts printed on the invoices it lists (frozen on each invoice).
  const rows = invoices.length ? acceptedAccounts(await many('invoice_bank_instructions', (q) => q.in('invoice_id', invoices.map((i) => i.id)), 'bank_name,account_number,account_holder,currency,swift_code,position')) : []
  const data: GeneralDocData = {
    number: doc.number as string, kind: type.key, language: doc.language as 'id' | 'en', status: doc.status as string, documentDate: String(doc.documentDate),
    values: stored.values ?? {}, invoices, articles: stored.articles ?? [],
    banks: rows.map((b): BankLine => ({ bankName: b.bankName as string, accountNumber: b.accountNumber as string, accountHolder: b.accountHolder as string, currency: b.currency as string, swiftCode: String(b.swiftCode ?? ''), position: Number(b.position) })),
  }
  const issuer = await issuerOf()
  const url = await verifyUrl('document', id, baseUrl)
  return type.family === 'certificate' ? renderCertificate(data, issuer, url) : renderGeneral(data, issuer, url)
}

/**
 * A seal document. Issued: the stored sealed file, exactly as it was made (a re-rendered copy would not have the same fingerprint). Draft: a preview of
 * where the seal will go, made now and never stored. Void: nothing, so that a withdrawn seal cannot be handed out again.
 */
async function sealedFile(doc: Record<string, unknown>, stored: StoredFields, id: number, baseUrl: string): Promise<Uint8Array> {
  const status = doc.status as string
  if (status === 'void') throw new ActionError('This seal was voided: the file is no longer released', 409)
  if (status === 'issued') {
    if (!stored.seal) throw new ActionError('The sealed file is missing', 409)
    return readSealed(stored.seal)
  }
  if (!stored.source) throw new ActionError('This document has no PDF to seal', 409)
  const v = stored.values
  return (await sealPdf(await readSource(stored.source), {
    verificationUrl: await verifyUrl('document', id, baseUrl), reference: doc.number as string, lang: doc.language as 'id' | 'en', purpose: v.purpose, pages: v.pages, corner: v.corner, size: v.size,
    pageNumber: v.page_number, posX: v.pos_x, posY: v.pos_y, preview: true,
  })).bytes
}
