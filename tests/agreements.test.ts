import { randomBytes } from 'node:crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { documentType, PLACEHOLDER } from '@/content/document-types'
import { createDocument, setDocumentStatus, updateDocument, type DocumentInput } from '@/server/documents/general'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { createUser } from './helpers/actions'
import { sql } from './helpers/db'
import { pdfPages, squash } from './helpers/pdf-text'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
const BASE = 'https://testserver'
let actor: number

const complete = (articles: Array<{ title: string; body: string }>) => articles.map((a) => ({ title: a.title, body: a.body.replace(/\[(isi|fill in):[^\]]*\]/gi, 'sepuluh')}))
const values = {
  place: 'Jakarta', subject: 'Perjanjian Kerja Sama Pengiriman',
  first_company: 'PT Satu Arah International', first_name: 'Siti Rahma', first_position: 'Direktur', first_address: 'Gedung Nucira, Jakarta Selatan',
  second_company: 'PT Mitra Dagang', second_name: 'Budi Santoso', second_position: 'Direktur Utama', second_address: 'Jl. Contoh 5, Bekasi',
  background: '1. Pihak Pertama bergerak di bidang logistik.', closing: 'Demikian Perjanjian ini dibuat.',
}
const agreement = (kind: string, lang: 'id' | 'en' = 'id', o: Partial<DocumentInput> = {}): DocumentInput => ({
  kind, language: lang, customerId: null, documentDate: '2026-10-30', values, invoiceIds: [], articles: complete(documentType(kind)!.articles![lang]), ...o,
})
const text = async (id: number) => squash((await pdfPages(await renderDocumentPdf('document', id, BASE))).join(' '))
const refused = async (p: Promise<unknown>, m: RegExp | string) => { const e = await p.then(() => null, (x: Error) => x); expect(e, 'expected a refusal').not.toBeNull(); expect(e!.message).toMatch(m) }

beforeAll(async () => { actor = (await createUser('agreements@example.invalid', 'admin')).id })
beforeEach(async () => { await sql`truncate customers, documents, document_verification_tokens restart identity cascade` })

describe('agreements (perjanjian)', () => {
  it.each(['cooperation_agreement', 'logistics_service_agreement', 'nda'])('%s starts from a template whose placeholders must be completed before it is issued', async (kind) => {
    const type = documentType(kind)!
    expect(type.articles!.id.length).toBeGreaterThan(5)
    expect(type.articles!.en).toHaveLength(type.articles!.id.length)                               // the same clauses in both languages
    const withTemplate = type.articles!.id.some((a) => PLACEHOLDER.test(a.body))
    expect(withTemplate, 'a template leaves the deal-specific parts to be filled in').toBe(true)
    const id = await createDocument(actor, agreement(kind, 'id', { articles: type.articles!.id }))  // a draft may still hold placeholders
    await refused(setDocumentStatus(actor, id, 'issue', BASE), /\[isi: \.\.\.\]/)                  // ...but cannot be issued with them
    expect((await sql`select status from documents where id = ${id}`)[0].status).toBe('draft')
    await updateDocument(actor, id, agreement(kind))
    await setDocumentStatus(actor, id, 'issue', BASE)
    expect((await sql`select status from documents where id = ${id}`)[0].status).toBe('issued')
  })

  it('numbers the articles, prints both parties with their QR signature, and says it in the document\'s language', async () => {
    const id = await createDocument(actor, agreement('cooperation_agreement'))
    await setDocumentStatus(actor, id, 'issue', BASE)
    const t = await text(id)
    expect(t).toContain('PERJANJIAN KERJA SAMA PENGIRIMAN')
    expect(t).toContain('PASAL 1')
    expect(t).toContain('PASAL 10')
    expect(t).toContain('PT Mitra Dagang')
    expect(t).toContain('PIHAK PERTAMA')
    expect(t).toContain('PIHAK KEDUA')
    expect(t).toContain('Budi Santoso')
    expect(t).not.toContain('Ditandatangani secara elektronik')                 // the QR code is not a signature
    expect(t).toContain('Tanda tangan / cap')
    const en = await createDocument(actor, agreement('nda', 'en', { values: { ...values, subject: 'Non-Disclosure Agreement' } }))
    await setDocumentStatus(actor, en, 'issue', BASE)
    const e = await text(en)
    expect(e).toContain('ARTICLE 1')
    expect(e).toContain('FIRST PARTY')
    expect(e).not.toContain('PASAL')
  })

  it('keeps the order of the articles and lets a draft be edited, but not an issued agreement', async () => {
    const articles = [{ title: 'Kedua', body: 'Isi kedua.' }, { title: 'Pertama', body: 'Isi pertama.' }]
    const id = await createDocument(actor, agreement('nda', 'id', { articles }))
    expect((await sql`select fields->'articles' as a from documents where id = ${id}`)[0].a).toEqual(articles)
    await updateDocument(actor, id, agreement('nda', 'id', { articles: [...articles].reverse() }))
    expect((await sql`select fields->'articles'->0->>'title' as t from documents where id = ${id}`)[0].t).toBe('Pertama')
    await setDocumentStatus(actor, id, 'issue', BASE)
    await refused(updateDocument(actor, id, agreement('nda')), /Only a draft/)
  })

  it('refuses an agreement without articles, an article without a title or text, and text that is too long instead of cutting it', async () => {
    await refused(createDocument(actor, agreement('nda', 'id', { articles: [] })), /at least one article/)
    await refused(createDocument(actor, agreement('nda', 'id', { articles: [{ title: '', body: 'Ada isi.' }] })), /Article 1 needs a title/)
    await refused(createDocument(actor, agreement('nda', 'id', { articles: [{ title: 'Judul', body: '' }] })), /needs its text/)
    await refused(createDocument(actor, agreement('nda', 'id', { articles: [{ title: 'Judul', body: 'x'.repeat(3001) }] })), /too long/)
    await refused(createDocument(actor, agreement('nda', 'id', { articles: Array.from({ length: 41 }, (_, i) => ({ title: `P${i}`, body: 'Isi.' })) })), /at most 40/)
    await refused(createDocument(actor, agreement('nda', 'id', { values: { ...values, second_company: '' } })), /Company \/ party is required/)
    expect((await sql`select count(*)::int as n from documents`)[0].n).toBe(0)
  })

  it('flows over several pages when there are many long articles, without clipping any', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ title: `Ketentuan ${i + 1}`, body: `Isi ketentuan nomor ${i + 1}. `.repeat(40).trim() }))
    const id = await createDocument(actor, agreement('cooperation_agreement', 'id', { articles: many }))
    await setDocumentStatus(actor, id, 'issue', BASE)
    const pages = await pdfPages(await renderDocumentPdf('document', id, BASE))
    expect(pages.length).toBeGreaterThan(3)
    const all = squash(pages.join(' '))
    expect(all).toContain('PASAL 25')
    expect(all).toContain('Isi ketentuan nomor 25.')
  })
})
