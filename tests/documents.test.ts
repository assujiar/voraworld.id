import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_TYPES } from '@/content/document-types'
import { sql } from './helpers/db'
import { createDocument, setDocumentStatus, updateDocument, type DocumentInput } from '@/server/documents/general'
import { createBank } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { setInvoiceStatus } from '@/server/finance/invoices'
import { createInvoice } from './helpers/commercial'
import { confirmPayment, recordPayment } from '@/server/finance/payments'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { Sheet } from '@/server/pdf/kit'
import { documentStatusAction, saveDocumentAction } from '@/actions/documents'
import { act, createUser, q, sessionFor } from './helpers/actions'
import { pdfLinks, pdfPages, rasterize, squash } from './helpers/pdf-text'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
process.env.VORA_LOCAL_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'vora-docs-'))
const BASE = 'https://testserver'
let actor: number

/** The least a type accepts. */
const MIN: Record<string, Record<string, string>> = {
  letter: { place: 'Jakarta', subject: 'Perubahan jadwal', recipient_name: 'PT Penerima', body: 'Dengan hormat,\n\nKami informasikan perubahan jadwal.', closing: 'Terima kasih.', signatory_name: 'Siti Rahma', signatory_title: 'Direktur' },
  billing_letter: { place: 'Jakarta', subject: 'Surat Tagihan', level: 'first', pay_by: '2026-11-10', body: 'Dengan hormat,\n\nInvoice berikut belum dibayar.', closing: 'Terima kasih.', signatory_name: 'Siti Rahma', signatory_title: 'Finance' },
  statement: { place: 'Jakarta', declarant_name: 'Budi Santoso', body: '1. Bahwa data benar.', closing: 'Demikian pernyataan ini.', stamp_duty: 'yes' },
  authorization: { place: 'Jakarta', grantor_name: 'Budi Santoso', grantee_name: 'Rina Wijaya', body: '1. Mengambil barang.', closing: 'Demikian.' },
  information: { place: 'Jakarta', certifier_name: 'Siti Rahma', certifier_position: 'Direktur', subject_name: 'Rina Wijaya', body: 'Adalah mitra kami.', closing: 'Demikian.' },
  assignment: { place: 'Jakarta', issuer_name: 'Siti Rahma', issuer_position: 'Direktur', assignee_name: 'Rina Wijaya', body: 'Mengawal pengiriman.', closing: 'Demikian.' },
  certificate: { place: 'Jakarta', title: 'SERTIFIKAT PENGHARGAAN', recipient_name: 'Rina Wijaya', body: 'Atas dedikasinya.', signatory_name: 'Siti Rahma', signatory_title: 'Direktur' },
}
const input = (kind: string, o: Partial<DocumentInput> = {}): DocumentInput => ({ kind, language: 'id', customerId: null, documentDate: '2026-10-30', values: MIN[kind], invoiceIds: [], ...o })
const customer = (currency = 'IDR') => saveCustomer(actor, null, { name: 'PT Pelanggan Satu', email: 'billing@pelanggan.example', address: 'Jl. Contoh 1\nJakarta', taxId: '', currency, termsDays: '14' }, { acknowledgeDuplicates: true })
const invoice = async (customerId: number, price = 12_000_000, o: { issue?: boolean; currency?: string } = {}) => {
  const bank = await createBank(actor, { bankName: 'Bank Contoh', accountNumber: `99${randomBytes(3).toString('hex')}`, accountHolder: 'PT Satu Arah International', currency: o.currency ?? 'IDR', branch: '', swiftCode: '', notes: '' })
  const id = await createInvoice(actor, { customerId, issuedAt: '2026-09-01', dueAt: '2026-09-15', taxPercent: '0', withholdingPercent: '0', discount: '0', poNumber: '', shipmentReference: '', serviceMode: '', origin: '', destination: '', transportDocumentRef: '', notes: '', items: `Freight | 1 | ${price} | job`, bankAccountIds: [bank] })
  if (o.issue !== false) await setInvoiceStatus(actor, id, 'issue')
  return id
}
const rejects = async (p: Promise<unknown>, message: RegExp | string, status?: number) => {
  const e = await p.then(() => null, (x: Error & { status?: number }) => x)
  expect(e, 'expected a refusal').not.toBeNull()
  expect(e!.message).toMatch(message)
  if (status) expect(e!.status).toBe(status)
}
const row = async (id: number) => (await sql`select * from documents where id = ${id}`)[0]
const text = async (id: number) => squash((await pdfPages(await renderDocumentPdf('document', id, BASE))).join(' '))

beforeAll(async () => { actor = (await createUser('documents@example.invalid', 'admin')).id })
beforeEach(async () => {
  await sql`truncate customers, bank_accounts, quotations, invoices, payments, receipts, documents, document_verification_tokens, email_jobs, leads, mail_config restart identity cascade`
  await sql`delete from settings where key = 'company_code'`
  await sql`delete from audit_logs where object_type = 'document'`
})

describe('creating a document', () => {
  it.each(DOCUMENT_TYPES.filter((t) => !['agreement', 'seal'].includes(t.family)).map((t) => [t.key, t.prefix] as const))('%s becomes a numbered draft with its own verification link', async (kind, prefix) => {
    const customerId = kind === 'billing_letter' ? await customer() : null
    const invoices = kind === 'billing_letter' ? [await invoice(customerId!)] : []
    const id = await createDocument(actor, input(kind, { customerId, invoiceIds: invoices }))
    const d = await row(id)
    expect(d.number).toMatch(new RegExp(`^${prefix}-VORA-${kind === 'billing_letter' ? 'C' : 'V'}[A-F0-9]{10}-202610-\\d{5}$`))
    expect(d).toMatchObject({ kind, language: 'id', status: 'draft', documentDate: '2026-10-30', createdBy: actor })
    expect((await sql`select revoked from document_verification_tokens where kind = 'document' and document_id = ${id}`)[0].revoked).toBe(false)
  })

  it('is numbered under the customer it is for, or under the company; the company code never changes', async () => {
    const cid = await customer()
    const [c] = await sql`select public_code from customers where id = ${cid}`
    const forCustomer = await row(await createDocument(actor, input('letter', { customerId: cid })))
    expect(forCustomer.number).toContain(`-VORA-${c.publicCode}-`)
    const a = await row(await createDocument(actor, input('letter')))
    const b = await row(await createDocument(actor, input('statement')))
    const code = (n: string) => /-VORA-(V[A-F0-9]{10})-/.exec(n)![1]
    expect(code(a.number as string)).toBe(code(b.number as string))
    expect((await sql`select value from settings where key = 'company_code'`)[0].value).toBe(code(a.number as string))
  })

  it('starts a letter to a customer from the customer\'s name and address, unless something was typed', async () => {
    const cid = await customer()
    const filled = await row(await createDocument(actor, input('letter', { customerId: cid, values: { ...MIN.letter, recipient_name: '' } })))
    expect(filled.recipient).toBe('PT Pelanggan Satu')
    expect((filled.fields as { values: Record<string, string> }).values).toMatchObject({ recipient_name: 'PT Pelanggan Satu', recipient_address: 'Jl. Contoh 1\nJakarta' })
    const typed = await row(await createDocument(actor, input('letter', { customerId: cid, values: { ...MIN.letter, recipient_name: 'PT Lain' } })))
    expect(typed.recipient).toBe('PT Lain')
  })

  it('lists a document by its subject (or certificate title) and by who it is for', async () => {
    const letter = await row(await createDocument(actor, input('letter')))
    expect(letter).toMatchObject({ subject: 'Perubahan jadwal', recipient: 'PT Penerima' })
    const certificate = await row(await createDocument(actor, input('certificate')))
    expect(certificate).toMatchObject({ subject: 'SERTIFIKAT PENGHARGAAN', recipient: 'Rina Wijaya' })
    const statement = await row(await createDocument(actor, input('statement')))
    expect(statement).toMatchObject({ subject: 'Surat Pernyataan', recipient: 'Budi Santoso' })
  })
})

describe('what a document may hold', () => {
  it('refuses a missing required field, naming it', async () => {
    await rejects(createDocument(actor, input('letter', { values: { ...MIN.letter, body: '  ' } })), 'Letter is required')
    await rejects(createDocument(actor, input('statement', { values: { ...MIN.statement, declarant_name: '' } })), 'Name is required')
    await rejects(createDocument(actor, input('information', { values: { ...MIN.information, certifier_position: '' } })), 'Position is required')
  })
  it('refuses text that is too long instead of cutting it short', async () => {
    await rejects(createDocument(actor, input('letter', { values: { ...MIN.letter, body: 'x'.repeat(8001) } })), /Letter is too long: 8001 characters, at most 8000/)
    await rejects(createDocument(actor, input('letter', { values: { ...MIN.letter, subject: 'y'.repeat(241) } })), /Subject is too long/)
    expect((await sql`select count(*)::int as n from documents`)[0].n).toBe(0)
    const exact = await row(await createDocument(actor, input('letter', { values: { ...MIN.letter, body: 'x'.repeat(8000) } })))
    expect((exact.fields as { values: Record<string, string> }).values.body).toHaveLength(8000)
  })
  it('refuses an unknown type, a bad date and an option that is not on offer; an unknown language means Indonesian', async () => {
    await rejects(createDocument(actor, input('nonsense')), 'Choose a document type')
    await rejects(createDocument(actor, input('letter', { documentDate: '2026-02-31' })), 'valid date')
    await rejects(createDocument(actor, input('certificate', { values: { ...MIN.certificate, valid_until: 'tomorrow' } })), /Valid until \(optional\) must be a valid date/)
    await rejects(createDocument(actor, input('statement', { values: { ...MIN.statement, stamp_duty: 'maybe' } })), /choose one of the listed options/)
    await rejects(createDocument(actor, input('letter', { customerId: 99999 })), 'Select an existing customer')
    expect((await row(await createDocument(actor, input('letter', { language: 'fr' })))).language).toBe('id')
  })
  it('ignores what the type does not ask for', async () => {
    const d = await row(await createDocument(actor, input('letter', { values: { ...MIN.letter, hack: 'x', stamp_duty: 'yes' } })))
    expect(Object.keys((d.fields as { values: Record<string, string> }).values)).not.toContain('hack')
    expect(Object.keys((d.fields as { values: Record<string, string> }).values)).not.toContain('stamp_duty')
  })
})

describe('draft, issued, void', () => {
  it('lets a draft be edited, but never its type, language or number; an issued document is frozen', async () => {
    const id = await createDocument(actor, input('letter', { language: 'en' }))
    const before = await row(id)
    await updateDocument(actor, id, input('statement', { language: 'id', values: { ...MIN.letter, subject: 'Changed' } }))     // type and language in the input are ignored
    const after = await row(id)
    expect(after).toMatchObject({ number: before.number, kind: 'letter', language: 'en', subject: 'Changed' })
    await setDocumentStatus(actor, id, 'issue')
    expect(await row(id)).toMatchObject({ status: 'issued', issuedBy: actor })
    expect((await row(id)).issuedAt).toBeTruthy()
    await rejects(updateDocument(actor, id, input('letter')), /Only a draft can be edited/, 409)
    await rejects(setDocumentStatus(actor, id, 'issue'), 'Invalid state change', 409)
    await rejects(updateDocument(actor, 999_999, input('letter')), 'Document not found', 404)
    await rejects(setDocumentStatus(actor, 999_999, 'issue'), 'Document not found', 404)
  })
  it('voids a draft or an issued document, revokes its QR link, and cannot be voided twice', async () => {
    const draft = await createDocument(actor, input('letter'))
    const issued = await createDocument(actor, input('statement')); await setDocumentStatus(actor, issued, 'issue')
    for (const id of [draft, issued]) {
      await setDocumentStatus(actor, id, 'void')
      expect((await row(id)).status).toBe('void')
      expect((await sql`select revoked from document_verification_tokens where kind = 'document' and document_id = ${id}`)[0].revoked).toBe(true)
      await rejects(setDocumentStatus(actor, id, 'void'), 'Invalid state change', 409)
      await rejects(updateDocument(actor, id, input('letter')), /Only a draft/, 409)
    }
    await rejects(setDocumentStatus(actor, draft, 'bogus'), 'Invalid state change', 409)
  })
  it('records who did what in the audit log', async () => {
    const id = await createDocument(actor, input('letter'))
    await updateDocument(actor, id, input('letter')); await setDocumentStatus(actor, id, 'issue'); await setDocumentStatus(actor, id, 'void')
    expect((await sql`select verb from audit_logs where object_type = 'document' and object_id = ${id} order by id`).map((r) => r.verb)).toEqual(['create', 'update', 'issue', 'void'])
  })
})

describe('a billing letter', () => {
  it('lists the open invoices of its customer, as they stand when it is saved and again when it is issued', async () => {
    const cid = await customer()
    const a = await invoice(cid, 12_000_000); const b = await invoice(cid, 8_000_000)
    const id = await createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: [a, b] }))
    const stored = (await row(id)).fields as { invoices: Array<{ id: number; outstandingMinor: number }> }
    expect(stored.invoices.map((i) => [i.id, i.outstandingMinor])).toEqual([[a, 12_000_000], [b, 8_000_000]])
    // Part of the first invoice is paid before the letter goes out.
    const [bank] = await sql`select id from bank_accounts limit 1`
    const paid = await recordPayment(actor, a, { amount: '5000000', date: '', method: 'bank transfer', reference: 'T-1', receivingBankId: bank.id as number })
    await confirmPayment(actor, paid, { fundsCleared: true, receivingBankId: null }, BASE)
    await setDocumentStatus(actor, id, 'issue')
    const issued = (await row(id)).fields as { invoices: Array<{ outstandingMinor: number }> }
    expect(issued.invoices.map((i) => i.outstandingMinor)).toEqual([7_000_000, 8_000_000])
    const t = await text(id)
    expect(t).toContain('IDR 7,000,000'); expect(t).toContain('IDR 8,000,000'); expect(t).toContain('TOTAL TAGIHAN'); expect(t).toContain('IDR 15,000,000'); expect(t).toContain('Bank Contoh')
  })
  it('refuses an invoice that is paid, someone else\'s, in another currency, or missing, and a letter with no customer or no invoice', async () => {
    const cid = await customer(); const other = await customer()
    const open = await invoice(cid); const draft = await invoice(cid, 1_000_000, { issue: false }); const foreign = await invoice(other)
    await rejects(createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: [draft] })), /is not open/)
    await rejects(createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: [foreign] })), /belongs to another customer/)
    await rejects(createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: [999_999] })), /does not exist/)
    await rejects(createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: [] })), /at least one open invoice/)
    await rejects(createDocument(actor, input('billing_letter', { customerId: null, invoiceIds: [open] })), /select one/)
    const usd = await customer('USD'); const usdInvoice = await invoice(usd, 100, { currency: 'USD' })
    const mixed = await customer()   // a customer cannot have two currencies: force one invoice into another currency
    const odd = await invoice(mixed); await sql`update invoices set currency = 'USD' where id = ${odd}`
    const fine = await invoice(mixed)
    await rejects(createDocument(actor, input('billing_letter', { customerId: mixed, invoiceIds: [odd, fine] })), /one currency/)
    expect(usdInvoice).toBeGreaterThan(0)
    // An invoice paid in full between saving and issuing stops the letter.
    const id = await createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: [open] }))
    await sql`update invoices set status = 'paid', outstanding_minor = 0 where id = ${open}`
    await rejects(setDocumentStatus(actor, id, 'issue'), /is not open/)
    expect((await row(id)).status).toBe('draft')
  })
  it('keeps to 30 invoices', async () => {
    const cid = await customer()
    const ids: number[] = []
    for (let i = 0; i < 31; i++) ids.push(await invoice(cid, 1_000_000))
    await rejects(createDocument(actor, input('billing_letter', { customerId: cid, invoiceIds: ids })), /at most 30/)
  })
})

describe('the document PDFs', () => {
  const prepare = async (kind: string, o: Partial<DocumentInput> = {}) => {
    const customerId = kind === 'billing_letter' ? await customer() : (o.customerId ?? null)
    const invoiceIds = kind === 'billing_letter' ? [await invoice(customerId!)] : []
    const id = await createDocument(actor, input(kind, { customerId, invoiceIds, ...o }))
    return id
  }
  it.each(DOCUMENT_TYPES.filter((t) => !['agreement', 'seal'].includes(t.family)).map((t) => t.key))('%s renders as a verifiable document: number, verification mark, clickable address, room to sign, and the QR code never called a signature', async (kind) => {
    const id = await prepare(kind)
    await setDocumentStatus(actor, id, 'issue')
    const d = await row(id)
    const pdf = await renderDocumentPdf('document', id, BASE)
    const t = squash((await pdfPages(pdf)).join(' '))
    expect(t).toContain(d.number as string)
    expect(t).not.toContain('Ditandatangani secara elektronik')            // a QR code is a way to check the document, not a signature
    expect(t).not.toMatch(/bukan tanda tangan/i)
    expect(t).toContain('PT SATU ARAH INTERNATIONAL')                       // the corporate mark is drawn beside the QR code
    expect(t).not.toMatch(/DRAFT|VOID/)
    const [token] = (await sql`select token from document_verification_tokens where kind = 'document' and document_id = ${id}`).map((r) => r.token as string)
    expect((await pdfLinks(pdf)).flat()).toContain(`${BASE}/verify/${token}`)
  })

  it('marks a draft and a void document on every page, and says so in the header', async () => {
    const id = await prepare('letter')
    expect(await text(id)).toContain('DRAFT')
    await setDocumentStatus(actor, id, 'void')
    expect(await text(id)).toContain('VOID')
  })

  it('writes in the language it was made in', async () => {
    const id = await prepare('letter', { language: 'en', values: { ...MIN.letter, body: 'Dear Sir or Madam,\n\nHello.', closing: 'Thanks.' } })
    const english = await text(id)
    expect(english).toContain('Sincerely,'); expect(english).toContain('GENERAL LETTER'); expect(english).toContain('Subject'); expect(english).toContain('PAGE 1 OF 1'); expect(english).toContain('Electronically signed')
    expect(english).not.toContain('Hormat kami')
    const indonesian = await text(await prepare('letter'))
    expect(indonesian).toContain('Hormat kami,'); expect(indonesian).toContain('SURAT UMUM'); expect(indonesian).toContain('Perihal'); expect(indonesian).toContain('HALAMAN 1 DARI 1')
  })

  it('flows a long letter over several pages and keeps the signature with the end of the text', async () => {
    const paragraphs = Array.from({ length: 60 }, (_, i) => `Paragraf ${i + 1}: kami menyampaikan informasi penting mengenai pengiriman kontainer dan jadwal kapal.`).join('\n\n')
    const id = await prepare('letter', { values: { ...MIN.letter, body: paragraphs } })
    await setDocumentStatus(actor, id, 'issue')
    const pages = await pdfPages(await renderDocumentPdf('document', id, BASE))
    expect(pages.length).toBeGreaterThanOrEqual(2)
    expect(squash(pages.join(' '))).toContain('Paragraf 60')
    expect(squash(pages[pages.length - 1])).toContain('Hormat kami,')
    expect(squash(pages[pages.length - 1])).toContain('Siti Rahma')
    for (let i = 0; i < pages.length; i++) expect(squash(pages[i])).toContain(`HALAMAN ${i + 1} DARI ${pages.length}`)
    expect(pages.slice(0, -1).join(' ')).not.toContain('Hormat kami,')
  })

  it('keeps numbered statements hanging under their number', async () => {
    const id = await prepare('statement', { values: { ...MIN.statement, body: '1. ' + 'Bahwa seluruh dokumen yang saya serahkan adalah benar dan sah menurut hukum yang berlaku di Indonesia. '.repeat(3) } })
    const t = await text(id)
    expect(t).toContain('1. Bahwa seluruh dokumen')
  })

  it('gives a statement a square (1:1) box for the stamp duty beside the QR signature, unless it is switched off', async () => {
    const dashed = async (values: Record<string, string>) => {
      const id = await prepare('statement', { values })
      const boxes: Array<[number, number]> = []
      const spy = vi.spyOn(Sheet.prototype, 'outline').mockImplementation(function (this: Sheet, _x, _y, w, h, _s, _t, dash) { if (dash) boxes.push([w, h]) })
      try { await renderDocumentPdf('document', id, BASE) } finally { spy.mockRestore() }
      return boxes
    }
    const on = await dashed(MIN.statement)
    expect(on).toHaveLength(1); expect(on[0][0]).toBe(on[0][1]); expect(on[0][0]).toBeGreaterThanOrEqual(68)
    expect(await dashed({ ...MIN.statement, stamp_duty: 'no' })).toEqual([])
  })

  it('lays a power of attorney out with two signers and the stamp duty on the grantor\'s side only', async () => {
    const t = await text(await prepare('authorization'))
    expect(t).toContain('Pemberi Kuasa'); expect(t).toContain('Penerima Kuasa'); expect(t).not.toContain('Ditandatangani secara elektronik'); expect(t.match(/Tanda tangan \/ cap/g)?.length).toBe(2); expect(t.match(/METERAI/g)?.length).toBe(1)
  })

  it('draws a certificate on one landscape page with the holder\'s name, however long, and a line to sign per signatory', async () => {
    const id = await prepare('certificate', { values: { ...MIN.certificate, recipient_name: 'Muhammad Abdurrahman Wahid Setiawan Prasetyo Kusumawardhana Hidayatullah Nugroho Santoso', signatory2_name: 'Budi Santoso', signatory2_title: 'Direktur Utama' } })
    const pdf = await renderDocumentPdf('document', id, BASE)
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(1)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(841.89, 1); expect(height).toBeCloseTo(595.28, 1)
    const t = squash((await pdfPages(pdf)).join(' '))
    for (const part of ['SERTIFIKAT PENGHARGAAN', 'diberikan kepada', 'Muhammad Abdurrahman', 'Hidayatullah Nugroho Santoso', 'Siti Rahma', 'Budi Santoso', 'Direktur Utama']) expect(t, part).toContain(part)
    expect(t).not.toContain('Ditandatangani secara elektronik')
    const img = rasterize(pdf, 1)
    if (img) expect(img.width).toBeGreaterThan(img.height)
  })

  it('shows a billing letter\'s overdue days against the document date', async () => {
    const t = await text(await prepare('billing_letter'))
    expect(t).toContain('45 hari')                                           // due 2026-09-15, document date 2026-10-30
    expect(t).toContain('SURAT TAGIHAN'); expect(t).toContain('10 November 2026')
  })

  it('refuses a document that does not exist', async () => {
    await rejects(renderDocumentPdf('document', 99999, BASE), 'Document not found', 404)
  })
})

describe('the admin actions', () => {
  it('create, edit and issue a document; a refused form comes back with what was typed', async () => {
    const as = { as: await sessionFor(await createUser('documents-actions@example.invalid', 'admin')) }
    const form = (o: Record<string, string> = {}) => ({ kind: 'letter', language: 'id', document_date: '2026-10-30', ...MIN.letter, ...o })
    const bad = await act(saveDocumentAction, form({ body: '' }), as)
    expect(bad.redirect).toBeUndefined()
    expect(bad.state).toMatchObject({ error: 'Letter is required', values: { subject: 'Perubahan jadwal', recipient_name: 'PT Penerima' } })
    const tooLong = await act(saveDocumentAction, form({ body: 'x'.repeat(8001) }), as)
    expect(tooLong.state!.error).toMatch(/Letter is too long: 8001 characters, at most 8000/)
    expect(tooLong.state!.values!.body).toHaveLength(8001)                               // nothing was cut short on the way back to the form

    const created = await act(saveDocumentAction, form(), as)
    expect(created.redirect).toMatch(/^\/admin\/documents\/\d+\?notice=Document%20draft%20created$/)
    const id = Number(/documents\/(\d+)/.exec(created.redirect!)![1])
    const saved = await act(saveDocumentAction, form({ record: String(id), subject: 'Jadwal baru' }), as)
    expect(saved.redirect).toBe(`/admin/documents/${id}?notice=Document%20saved`)
    expect((await row(id)).subject).toBe('Jadwal baru')
    expect((await act(documentStatusAction, { record: String(id), action: 'issue' }, as)).redirect).toBe(`/admin/documents/${id}?notice=Document%20state%20updated`)
    expect(q((await act(saveDocumentAction, form({ record: String(id) }), as)).state!.error ?? '')).toBeDefined()
    expect((await act(saveDocumentAction, form({ record: String(id) }), as)).state!.error).toMatch(/Only a draft can be edited/)
    expect(q((await act(documentStatusAction, { record: String(id), action: 'issue', _back: `/admin/documents/${id}` }, as)).redirect).get('error')).toBe('Invalid state change')
    expect((await act(saveDocumentAction, { ...form(), kind: 'nonsense' }, as)).state!.error).toBe('Choose a document type')
  })
})
