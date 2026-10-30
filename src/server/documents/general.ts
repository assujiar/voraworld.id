import { many, one, rpc } from '../data'
import { isIsoDay, today } from '../dates'
import { ActionError, isUnique } from '../errors'
import { documentType, isLang, type DocumentType, type FieldDef, type Lang } from '../../content/document-types'

/**
 * General documents: letters, billing letters, statements, powers of attorney, certification and assignment letters, certificates.
 * What a type asks for, and how it reads, is data in src/content/document-types.ts; this module checks what was typed against it,
 * numbers the document, keeps it editable while it is a draft and freezes it when it is issued.
 *
 * Every limit REFUSES: text that is too long is never cut short, and a required field is never filled in silently.
 */
export interface InvoiceSnapshot { id: number; number: string; issuedAt: string; dueAt: string; currency: string; totalMinor: number; outstandingMinor: number }
/** What is stored in `documents.fields`. */
export interface StoredFields { values: Record<string, string>; invoices?: InvoiceSnapshot[] }

export interface DocumentInput { kind: string; language: string; customerId: number | null; documentDate: string; values: Record<string, string>; invoiceIds: number[] }

export const MAX_BILLED_INVOICES = 30
/** Which field names the person the document is for, so the list can show it. */
const WHO = ['recipient_name', 'declarant_name', 'grantee_name', 'subject_name', 'assignee_name']

const text = (v: string | undefined) => (v ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim()

/** A value normalised and checked against its field definition. */
function checked(field: FieldDef, raw: string | undefined): string {
  const label = field.label.en
  const value = field.input === 'textarea' ? text(raw) : text(raw).replace(/\s*\n\s*/g, ' ')
  if (!value) {
    if (field.required) throw new ActionError(`${label} is required`)
    return ''
  }
  if (field.input === 'select' && !field.options?.some((o) => o.value === value)) throw new ActionError(`${label}: choose one of the listed options`)
  if (value.length > field.max) throw new ActionError(`${label} is too long: ${value.length} characters, at most ${field.max}`)
  if (field.input === 'date' && !isIsoDay(value)) throw new ActionError(`${label} must be a valid date (YYYY-MM-DD)`)
  return value
}

function parseValues(type: DocumentType, raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of type.fields) {
    const value = checked(field, raw[field.name])
    if (value) out[field.name] = value
  }
  return out
}

/** The open invoices of one customer, in one currency, as they stand now. A billing letter lists exactly these. */
async function snapshotInvoices(customerId: number | null, ids: number[]): Promise<InvoiceSnapshot[]> {
  if (!customerId) throw new ActionError('A billing letter is written to a customer: select one')
  const unique = [...new Set(ids)]
  if (!unique.length) throw new ActionError('Select at least one open invoice to bill')
  if (unique.length > MAX_BILLED_INVOICES) throw new ActionError(`Select at most ${MAX_BILLED_INVOICES} invoices`)
  const rows = await many('invoices', (q) => q.in('id', unique).order('issued_at').order('id'), 'id,number,issued_at,due_at,currency,total_minor,outstanding_minor,status,customer_id')
  if (rows.length !== unique.length) throw new ActionError('One of the selected invoices does not exist')
  const snapshots: InvoiceSnapshot[] = []
  for (const r of rows) {
    if (r.customerId !== customerId) throw new ActionError(`Invoice ${r.number} belongs to another customer`)
    if (!['issued', 'partially_paid'].includes(r.status as string) || (r.outstandingMinor as number) <= 0) throw new ActionError(`Invoice ${r.number} is not open: remove it from the letter`)
    snapshots.push({ id: r.id as number, number: r.number as string, issuedAt: String(r.issuedAt ?? ''), dueAt: String(r.dueAt ?? ''), currency: r.currency as string, totalMinor: r.totalMinor as number, outstandingMinor: r.outstandingMinor as number })
  }
  if (new Set(snapshots.map((s) => s.currency)).size > 1) throw new ActionError('Select invoices in one currency: a billing letter has one total')
  return snapshots
}

interface Prepared { type: DocumentType; lang: Lang; fields: StoredFields; subject: string; recipient: string; date: string; customerId: number | null }

async function prepare(input: DocumentInput, fixed?: { kind: string; language: Lang }): Promise<Prepared> {
  const type = documentType(fixed?.kind ?? input.kind)
  if (!type) throw new ActionError('Choose a document type')
  const lang: Lang = fixed?.language ?? (isLang(input.language) ? input.language : 'id')
  const date = input.documentDate.trim() || today()
  if (!isIsoDay(date)) throw new ActionError('The document date must be a valid date (YYYY-MM-DD)')

  let customerId: number | null = null
  let customer: { name: string; address: string } | undefined
  if (input.customerId) {
    const c = await one('customers', (q) => q.eq('id', input.customerId!), 'id,name,address')
    if (!c) throw new ActionError('Select an existing customer')
    customerId = c.id as number; customer = { name: c.name as string, address: String(c.address ?? '') }
  }
  if (type.family === 'billing' && !customerId) throw new ActionError('A billing letter is written to a customer: select one')
  // A letter to a customer starts from that customer's name and address when none was typed.
  const raw = { ...input.values }
  if (customer && type.fields.some((f) => f.name === 'recipient_name')) {
    if (!text(raw.recipient_name)) raw.recipient_name = customer.name
    if (type.fields.some((f) => f.name === 'recipient_address') && !text(raw.recipient_address)) raw.recipient_address = customer.address
  }
  const values = parseValues(type, raw)
  const fields: StoredFields = { values }
  if (type.family === 'billing') fields.invoices = await snapshotInvoices(customerId, input.invoiceIds)
  return {
    type, lang, fields, date, customerId,
    subject: (values.subject || values.title || type.label[lang]).slice(0, 240),
    recipient: (WHO.map((k) => values[k]).find(Boolean) ?? customer?.name ?? '').slice(0, 240),
  }
}

export async function createDocument(actorId: number, input: DocumentInput): Promise<number> {
  const p = await prepare(input)
  try {
    return await rpc<number>('document_create', {
      p_actor: actorId,
      p: { prefix: p.type.prefix, kind: p.type.key, language: p.lang, customer_id: p.customerId, subject: p.subject, recipient: p.recipient, document_date: p.date, fields: p.fields },
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Document numbering collision, please retry', 409)
    throw e
  }
}

/** Only a draft can be edited. The type, the language and the number stay as they were. */
export async function updateDocument(actorId: number, id: number, input: DocumentInput): Promise<void> {
  const doc = await one('documents', (q) => q.eq('id', id), 'kind,language,status')
  if (!doc) throw new ActionError('Document not found', 404)
  if (doc.status !== 'draft') throw new ActionError('Only a draft can be edited: void this document and write a new one', 409)
  const p = await prepare(input, { kind: doc.kind as string, language: doc.language as Lang })
  await rpc('document_update', { p_actor: actorId, p_id: id, p: { customer_id: p.customerId, subject: p.subject, recipient: p.recipient, document_date: p.date, fields: p.fields } })
}

/** issue: draft -> issued (a billing letter takes the invoices as they stand now). void: any draft or issued document; its QR link stops verifying. */
export async function setDocumentStatus(actorId: number, id: number, action: string): Promise<void> {
  const doc = await one('documents', (q) => q.eq('id', id))
  if (!doc) throw new ActionError('Document not found', 404)
  if (action === 'issue' && doc.status === 'draft') {
    const type = documentType(doc.kind as string)
    if (!type) throw new ActionError('Unknown document type', 409)
    const stored = doc.fields as StoredFields
    // Re-check what was typed against the type as it is today, and refresh the invoices a billing letter lists.
    const p = await prepare({ kind: type.key, language: doc.language as string, customerId: doc.customerId as number | null, documentDate: doc.documentDate as string, values: stored.values, invoiceIds: (stored.invoices ?? []).map((i) => i.id) },
      { kind: type.key, language: doc.language as Lang })
    await rpc('document_set_status', { p_actor: actorId, p_id: id, p_action: action, p: { subject: p.subject, recipient: p.recipient, fields: p.fields }, p_expected: (doc.updatedAt as Date).toISOString() })
    return
  }
  await rpc('document_set_status', { p_actor: actorId, p_id: id, p_action: action })
}
