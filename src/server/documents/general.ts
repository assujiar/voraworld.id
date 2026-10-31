import { many, one, rpc } from '../data'
import { isIsoDay, today } from '../dates'
import { ActionError, isUnique } from '../errors'
import { randomUUID } from 'node:crypto'
import { fraction } from '../../content/seal-layout'
import { documentType, isLang, PLACEHOLDER, type Article, type DocumentType, type FieldDef, type Lang } from '../../content/document-types'
import { sha256Hex } from '../crypto'
import { maxUploadBytes } from '../env'
import { inspectSourcePdf } from '../finance/pdf-inspect'
import { sealPdf } from '../pdf/seal'
import { getObject, putObject, removeObject } from '../storage'
import { businessDateTime } from '../dates'
import { getVerification } from '../verification'

/**
 * General documents: letters, billing letters, statements, powers of attorney, certification and assignment letters, certificates.
 * What a type asks for, and how it reads, is data in src/content/document-types.ts; this module checks what was typed against it,
 * numbers the document, keeps it editable while it is a draft and freezes it when it is issued.
 *
 * Every limit REFUSES: text that is too long is never cut short, and a required field is never filled in silently.
 */
export interface InvoiceSnapshot { id: number; number: string; issuedAt: string; dueAt: string; currency: string; totalMinor: number; outstandingMinor: number }
/** The PDF somebody else issued, kept as it arrived (a `seal` document). */
export interface SourceFile { key: string; sha256: string; bytes: number; pages: number; name: string }
/** The same PDF with the VORA seal added, made when the document is issued. */
export interface SealedFile { key: string; sha256: string; bytes: number; pagesSealed: number; sealedAt: string }
/** What is stored in `documents.fields`. */
export interface StoredFields { values: Record<string, string>; invoices?: InvoiceSnapshot[]; articles?: Article[]; source?: SourceFile; seal?: SealedFile }

export interface DocumentInput {
  kind: string; language: string; customerId: number | null; documentDate: string; values: Record<string, string>; invoiceIds: number[]
  /** The articles of an agreement, in order. */
  articles?: Article[]
  /** The uploaded PDF of a seal document, already stored (see `storeSourcePdf`). */
  source?: SourceFile
}

export const MAX_ARTICLES = 40
export const MAX_ARTICLES_CHARS = 60_000

export const MAX_BILLED_INVOICES = 30
/** Which field names the person the document is for, so the list can show it. */
const WHO = ['recipient_name', 'declarant_name', 'grantee_name', 'subject_name', 'assignee_name', 'second_company', 'source_issuer']

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

/** The articles of an agreement, checked: each has a title and a text, and none is cut short. */
function checkedArticles(rows: Article[] | undefined): Article[] {
  const list = (rows ?? []).map((a) => ({ title: text(a.title).replace(/\s*\n\s*/g, ' '), body: text(a.body) })).filter((a) => a.title || a.body)
  if (!list.length) throw new ActionError('An agreement needs at least one article')
  if (list.length > MAX_ARTICLES) throw new ActionError(`An agreement has at most ${MAX_ARTICLES} articles`)
  list.forEach((a, i) => {
    if (!a.title) throw new ActionError(`Article ${i + 1} needs a title`)
    if (!a.body) throw new ActionError(`Article ${i + 1} (${a.title}) needs its text`)
    if (a.title.length > 120) throw new ActionError(`The title of article ${i + 1} is too long: ${a.title.length} characters, at most 120`)
    if (a.body.length > 3000) throw new ActionError(`Article ${i + 1} (${a.title}) is too long: ${a.body.length} characters, at most 3000`)
  })
  if (list.reduce((n, a) => n + a.title.length + a.body.length, 0) > MAX_ARTICLES_CHARS) throw new ActionError('The articles are too long in total: shorten them')
  return list
}

/** `confirm`: the placement of a third-party PDF's mark was reviewed and confirmed by the person (required whenever a draft is made or saved; an older draft is still issued). */
async function prepare(input: DocumentInput, fixed?: { kind: string; language: Lang }, confirm = false): Promise<Prepared> {
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
  if (type.family === 'agreement') fields.articles = checkedArticles(input.articles)
  if (type.family === 'seal') {
    if (!input.source) throw new ActionError('Upload the PDF that is to receive the seal')
    fields.source = input.source
    // The person must have looked at where the mark goes on the pages and confirmed it: nothing is placed on somebody else's document by default.
    if (confirm && values.placement_confirmed !== 'yes') throw new ActionError('Confirm where the VORA mark goes on the page before saving')
    // Where the seal goes: a dropped position is a pair of fractions of the page; a chosen page must exist in this PDF.
    if (values.corner === 'custom' && (fraction(values.pos_x) === null || fraction(values.pos_y) === null)) throw new ActionError('Drag the seal onto the page, or choose a corner')
    if (values.pages === 'one') {
      const page = Number(values.page_number)
      if (!Number.isInteger(page) || page < 1 || page > input.source.pages) throw new ActionError(`Choose a page from 1 to ${input.source.pages}`)
    }
  }
  return {
    type, lang, fields, date, customerId,
    subject: (values.subject || values.title || values.source_title || type.label[lang]).slice(0, 240),
    recipient: (WHO.map((k) => values[k]).find(Boolean) ?? customer?.name ?? '').slice(0, 240),
  }
}

export async function createDocument(actorId: number, input: DocumentInput): Promise<number> {
  const p = await prepare(input, undefined, true)
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
  const doc = await one('documents', (q) => q.eq('id', id), 'kind,language,status,fields')
  if (!doc) throw new ActionError('Document not found', 404)
  if (doc.status !== 'draft') throw new ActionError('Only a draft can be edited: void this document and write a new one', 409)
  const before = (doc.fields as StoredFields).source
  const p = await prepare({ ...input, source: input.source ?? before }, { kind: doc.kind as string, language: doc.language as Lang }, true)
  await rpc('document_update', { p_actor: actorId, p_id: id, p: { customer_id: p.customerId, subject: p.subject, recipient: p.recipient, document_date: p.date, fields: p.fields } })
  if (input.source && before && before.key !== input.source.key) await removeObject('documents', before.key).catch(() => undefined)      // the file that was replaced
}

/**
 * Stores the PDF somebody else issued (checked first: readable, unencrypted, no active content, no signature of its own that sealing would break).
 * It is stored BEFORE the document row exists, so the caller removes it again if the row cannot be written.
 */
export async function storeSourcePdf(file: File): Promise<SourceFile> {
  if (!file.size) throw new ActionError('Choose the PDF to seal')
  if (file.size > maxUploadBytes()) throw new ActionError(`Upload a PDF not exceeding ${Math.floor(maxUploadBytes() / 1048576)} MB`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { pages, sha256 } = await inspectSourcePdf(bytes)
  const key = `seal/${randomUUID()}-source.pdf`
  await putObject('documents', key, bytes, 'application/pdf')
  return { key, sha256, bytes: bytes.length, pages, name: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) }
}

/** The original file of a seal document, after its fingerprint has been checked against the one recorded on arrival. */
export async function readSource(source: SourceFile): Promise<Uint8Array> {
  const bytes = await getObject('documents', source.key, maxUploadBytes() + 4096)
  if ((await sha256Hex(bytes)) !== source.sha256) throw new ActionError('The stored file does not match its recorded fingerprint', 409)
  return bytes
}

/** The sealed file of an issued seal document, checked the same way. */
export async function readSealed(seal: SealedFile): Promise<Uint8Array> {
  const bytes = await getObject('documents', seal.key, maxUploadBytes() * 2 + 65536)
  if ((await sha256Hex(bytes)) !== seal.sha256) throw new ActionError('The stored file does not match its recorded fingerprint', 409)
  return bytes
}

/** An agreement may not leave the building with a template placeholder in it. */
function assertNoPlaceholders(p: Prepared): void {
  if (p.type.family !== 'agreement') return
  const left = [...Object.values(p.fields.values), ...(p.fields.articles ?? []).flatMap((a) => [a.title, a.body])].some((t) => PLACEHOLDER.test(t))
  if (left) throw new ActionError('The agreement still has text in [isi: ...] / [fill in: ...] brackets: complete it or delete it before issuing', 422)
}

/** issue: draft -> issued (a billing letter takes the invoices as they stand now; a seal is made now). void: any draft or issued document; its QR link stops verifying. */
export async function setDocumentStatus(actorId: number, id: number, action: string, baseUrl = ''): Promise<void> {
  const doc = await one('documents', (q) => q.eq('id', id))
  if (!doc) throw new ActionError('Document not found', 404)
  if (action === 'issue' && doc.status === 'draft') {
    const type = documentType(doc.kind as string)
    if (!type) throw new ActionError('Unknown document type', 409)
    const stored = doc.fields as StoredFields
    // Re-check what was typed against the type as it is today, and refresh the invoices a billing letter lists.
    const p = await prepare({ kind: type.key, language: doc.language as string, customerId: doc.customerId as number | null, documentDate: doc.documentDate as string, values: stored.values, invoiceIds: (stored.invoices ?? []).map((i) => i.id), articles: stored.articles, source: stored.source },
      { kind: type.key, language: doc.language as Lang })
    assertNoPlaceholders(p)
    let sealedKey = ''
    if (type.family === 'seal') {
      if (!stored.source) throw new ActionError('This document has no PDF to seal', 409)
      if (!baseUrl) throw new ActionError('The public address of the site is not known', 500)
      const verification = await getVerification('document', id)
      if (!verification || verification.revoked) throw new ActionError('The document has no active verification link', 409)
      const sealedAt = new Date()
      const made = await sealPdf(await readSource(stored.source), {
        verificationUrl: `${baseUrl.replace(/\/+$/, '')}/verify/${verification.token}`, reference: doc.number as string, lang: p.lang, purpose: p.fields.values.purpose, pages: p.fields.values.pages,
        corner: p.fields.values.corner, size: p.fields.values.size, pageNumber: p.fields.values.page_number, posX: p.fields.values.pos_x, posY: p.fields.values.pos_y, issuedAt: `${businessDateTime(sealedAt)} WIB`,
      })
      sealedKey = `seal/${randomUUID()}-sealed.pdf`
      await putObject('documents', sealedKey, made.bytes, 'application/pdf')
      p.fields.seal = { key: sealedKey, sha256: await sha256Hex(made.bytes), bytes: made.bytes.length, pagesSealed: made.pagesSealed, sealedAt: sealedAt.toISOString() }
    }
    try {
      await rpc('document_set_status', { p_actor: actorId, p_id: id, p_action: action, p: { subject: p.subject, recipient: p.recipient, fields: p.fields }, p_expected: (doc.updatedAt as Date).toISOString() })
    } catch (e) {
      if (sealedKey) await removeObject('documents', sealedKey).catch(() => undefined)
      throw e
    }
    return
  }
  await rpc('document_set_status', { p_actor: actorId, p_id: id, p_action: action })
}
