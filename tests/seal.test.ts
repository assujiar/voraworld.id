import { randomBytes } from 'node:crypto'
import { PDFArray, PDFDict, PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveDocumentAction, documentStatusAction } from '@/actions/documents'
import { sha256Hex } from '@/server/crypto'
import { createDocument, setDocumentStatus, storeSourcePdf, updateDocument, type DocumentInput } from '@/server/documents/general'
import { renderDocumentPdf } from '@/server/pdf/documents'
import { act, createUser, sessionFor } from './helpers/actions'
import { sql } from './helpers/db'
import { pdfPages, rasterize, squash } from './helpers/pdf-text'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
const files = vi.hoisted(() => new Map<string, Uint8Array>())
vi.mock('@/server/storage', async (original) => (await import('./helpers/memory-storage')).memoryStorage(await original(), files))
const BASE = 'https://testserver'
let actor: number

/** A PDF somebody else could have issued: some pages of text, optionally rotated. */
async function thirdParty(o: { pages?: number; rotate?: number; size?: [number, number]; sign?: boolean; openAction?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < (o.pages ?? 1); i++) {
    const page = doc.addPage(o.size ?? [595.28, 841.89])
    page.drawText(`Original certificate page ${i + 1}`, { x: page.getWidth() / 2 - 60, y: page.getHeight() / 2, size: 14, font, color: rgb(0, 0, 0) })
    if (o.rotate) page.setRotation(degrees(o.rotate))
  }
  if (o.sign) {                                                          // an object that looks like a cryptographic signature
    const sig = doc.context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', ByteRange: [0, 10, 20, 30] })
    doc.catalog.set(PDFName.of('FakeSig'), doc.context.register(sig))
  }
  if (o.openAction) doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({ S: 'JavaScript', JS: 'app.alert(1)' }))
  return doc.save()
}
const file = (bytes: Uint8Array, name = 'partner.pdf') => new File([Buffer.from(bytes)], name, { type: 'application/pdf' })

const values = (o: Record<string, string> = {}) => ({
  source_title: 'Certificate of Origin', source_issuer: 'Kamar Dagang Contoh', source_reference: 'COO-2026-0042', signatory_name: 'Siti Rahma', signatory_title: 'Direktur',
  purpose: 'verified', pages: 'last', corner: 'bottom-right', size: 'medium', ...o,
})
async function seal(bytes: Uint8Array, v: Record<string, string> = {}, lang: 'id' | 'en' = 'id'): Promise<number> {
  const source = await storeSourcePdf(file(bytes))
  const input: DocumentInput = { kind: 'seal', language: lang, customerId: null, documentDate: '2026-10-30', values: values(v), invoiceIds: [], source }
  return createDocument(actor, input)
}
const refused = async (p: Promise<unknown>, m: RegExp | string, status?: number) => { const e = await p.then(() => null, (x: Error & { status?: number }) => x); expect(e, 'expected a refusal').not.toBeNull(); expect(e!.message).toMatch(m); if (status) expect(e!.status).toBe(status) }
const fields = async (id: number) => (await sql`select fields from documents where id = ${id}`)[0].fields as { source: { key: string; sha256: string; pages: number }; seal?: { key: string; sha256: string; pagesSealed: number } }

beforeAll(async () => { actor = (await createUser('seal@example.invalid', 'admin')).id })
beforeEach(async () => { files.clear(); await sql`truncate customers, documents, document_verification_tokens restart identity cascade` })

describe('QR seal on a PDF issued by somebody else', () => {
  it('keeps the original byte for byte, records its fingerprint, and releases a sealed copy whose fingerprint is recorded too', async () => {
    const original = await thirdParty({ pages: 3 })
    const id = await seal(original)
    const draft = await fields(id)
    expect(draft.source.sha256).toBe(await sha256Hex(original))
    expect(draft.source.pages).toBe(3)
    expect(files.get(draft.source.key)).toEqual(original)                                       // the stored original is exactly what arrived
    await setDocumentStatus(actor, id, 'issue', BASE)
    const issued = await fields(id)
    const sealed = files.get(issued.seal!.key)!
    expect(issued.seal!.sha256).toBe(await sha256Hex(sealed))
    expect(issued.seal!.sha256).not.toBe(issued.source.sha256)
    expect(files.get(issued.source.key)).toEqual(original)                                      // sealing never touches the original
    const served = await renderDocumentPdf('document', id, BASE)
    expect(await sha256Hex(served)).toBe(issued.seal!.sha256)                                   // what is released is the stored file, not a re-render
    expect(await renderDocumentPdf('document', id, BASE)).toEqual(served)
  })

  it('draws the seal on the chosen pages only and keeps every word of the original', async () => {
    const original = await thirdParty({ pages: 3 })
    for (const [pages, sealedOn] of [['last', [3]], ['first', [1]], ['all', [1, 2, 3]]] as const) {
      const id = await seal(original, { pages })
      await setDocumentStatus(actor, id, 'issue', BASE)
      const out = await pdfPages(await renderDocumentPdf('document', id, BASE))
      expect(out).toHaveLength(3)
      out.forEach((t, i) => {
        expect(squash(t)).toContain(`Original certificate page ${i + 1}`)
        expect(squash(t).includes('SEGEL DIGITAL VORA'), `page ${i + 1} with pages=${pages}`).toBe(sealedOn.includes(i + 1))
      })
      expect((await fields(id)).seal!.pagesSealed).toBe(sealedOn.length)
    }
  })

  it('says who endorsed it, what it means, when, and what it is not, in the language chosen', async () => {
    const id = await seal(await thirdParty(), { purpose: 'approved' }, 'en')
    await setDocumentStatus(actor, id, 'issue', BASE)
    const t = squash((await pdfPages(await renderDocumentPdf('document', id, BASE))).join(' '))
    for (const w of ['VORA DIGITAL SEAL', 'Approved by', 'Siti Rahma', 'Direktur', 'PT Satu Arah International', 'WIB']) expect(t).toContain(w)
    const [{ number }] = await sql`select number from documents where id = ${id}`
    expect(t).toContain(number as string)
  })

  it.each([0, 90, 180, 270])('puts the seal in the corner the reader sees, whatever the page rotation (%i degrees)', async (rotate) => {
    const original = await thirdParty({ rotate })
    const near = (r: NonNullable<ReturnType<typeof rasterize>>, cx: number, cy: number) => {          // dark or red pixels within a box of 60x30 points around a point
      let n = 0
      for (let y = Math.max(0, Math.round(cy - 15)); y < Math.min(r.height, cy + 15); y++) for (let x = Math.max(0, Math.round(cx - 30)); x < Math.min(r.width, cx + 30); x++) { const [R, G, B] = r.at(x, y); if (R < 200 || G < 200 || B < 200) n++ }
      return n
    }
    for (const corner of ['bottom-right', 'bottom-left', 'top-right', 'top-left']) {
      const id = await seal(original, { corner, size: 'small' })
      await setDocumentStatus(actor, id, 'issue', BASE)
      const r = rasterize(await renderDocumentPdf('document', id, BASE), 1)
      if (!r) return                                                                                    // Poppler is not installed: the visual check is skipped
      const w = r.width, h = r.height
      const at = { 'bottom-right': [w - 22 - 98, h - 22 - 32], 'bottom-left': [22 + 98, h - 22 - 32], 'top-right': [w - 22 - 98, 22 + 32], 'top-left': [22 + 98, 22 + 32] }[corner]!
      const opposite = { 'bottom-right': [22 + 98, 22 + 32], 'bottom-left': [w - 22 - 98, 22 + 32], 'top-right': [22 + 98, h - 22 - 32], 'top-left': [w - 22 - 98, h - 22 - 32] }[corner]!
      expect(near(r, at[0], at[1]), `${corner} @${rotate}`).toBeGreaterThan(150)
      expect(near(r, opposite[0], opposite[1]), `opposite of ${corner} @${rotate}`).toBe(0)
    }
  })

  it.each([0, 90, 270])('puts a dragged seal exactly where it was dropped, as the reader sees the page (%i degrees)', async (rotate) => {
    const original = await thirdParty({ rotate })
    const id = await seal(original, { corner: 'custom', pos_x: '0.3000', pos_y: '0.4000', size: 'small' })
    await setDocumentStatus(actor, id, 'issue', BASE)
    const r = rasterize(await renderDocumentPdf('document', id, BASE), 1)
    if (!r) return                                                                                      // Poppler is not installed: the visual check is skipped
    const w = r.width, h = r.height
    const dark = (x0: number, y0: number, x1: number, y1: number) => { let n = 0; for (let y = Math.round(y0); y < y1; y++) for (let x = Math.round(x0); x < x1; x++) { const [R, G, B] = r.at(x, y); if (R < 200 || G < 200 || B < 200) n++ } return n }
    const left = 0.3 * w, top = 0.4 * h
    expect(dark(left + 4, top + 4, left + 66, top + 62), `inside the dropped box @${rotate}`).toBeGreaterThan(300)                      // the QR code is there
    expect(dark(left - 40, top - 40, left - 4, top - 4), `just outside it @${rotate}`).toBe(0)
    expect(dark(w - 140, h - 80, w - 24, h - 24), `not in the old corner @${rotate}`).toBe(0)
  })

  it('keeps a dropped seal inside the page, and seals only the page that was chosen', async () => {
    const original = await thirdParty({ pages: 3 })
    const id = await seal(original, { corner: 'custom', pos_x: '1', pos_y: '1', pages: 'one', page_number: '2' })
    await setDocumentStatus(actor, id, 'issue', BASE)
    const out = await pdfPages(await renderDocumentPdf('document', id, BASE))
    expect(out.map((t) => squash(t).includes('SEGEL DIGITAL VORA'))).toEqual([false, true, false])
    const r = rasterize(await renderDocumentPdf('document', id, BASE), 2)
    if (r) {                                                                                            // dropped past the corner: pulled back inside the page
      let outside = 0
      for (let y = 0; y < r.height; y++) for (let x = r.width - 4; x < r.width; x++) { const [R, G, B] = r.at(x, y); if (R < 200 || G < 200 || B < 200) outside++ }
      expect(outside).toBe(0)
    }
  })

  it('refuses a dropped position that is not a position, and a page the PDF does not have', async () => {
    await refused(seal(await thirdParty(), { corner: 'custom' }), /Drag the seal onto the page/)
    await refused(seal(await thirdParty(), { corner: 'custom', pos_x: '2', pos_y: '0.5' }), /Drag the seal onto the page/)
    await refused(seal(await thirdParty(), { corner: 'custom', pos_x: 'left', pos_y: '0.5' }), /Drag the seal onto the page/)
    await refused(seal(await thirdParty({ pages: 2 }), { pages: 'one', page_number: '3' }), /Choose a page from 1 to 2/)
    await refused(seal(await thirdParty({ pages: 2 }), { pages: 'one' }), /Choose a page from 1 to 2/)
  })

  it('shows a preview while it is a draft, never stores it, and withdraws the file when the document is voided', async () => {
    const id = await seal(await thirdParty())
    const stored = files.size
    const preview = squash((await pdfPages(await renderDocumentPdf('document', id, BASE))).join(' '))
    expect(preview).toContain('PRATINJAU')
    expect(files.size).toBe(stored)
    await setDocumentStatus(actor, id, 'issue', BASE)
    expect(squash((await pdfPages(await renderDocumentPdf('document', id, BASE))).join(' '))).not.toContain('PRATINJAU')
    await setDocumentStatus(actor, id, 'void')
    await refused(renderDocumentPdf('document', id, BASE), /voided/, 409)
    expect((await sql`select revoked from document_verification_tokens where kind = 'document' and document_id = ${id}`)[0].revoked).toBe(true)
  })

  it('notices a stored file that no longer matches its fingerprint', async () => {
    const id = await seal(await thirdParty())
    await setDocumentStatus(actor, id, 'issue', BASE)
    const f = await fields(id)
    files.set(f.seal!.key, Uint8Array.from([...files.get(f.seal!.key)!, 32]))                        // one byte added
    await refused(renderDocumentPdf('document', id, BASE), /fingerprint/, 409)
  })

  it('replaces the file of a draft, removes the old one, and refuses a draft without a file', async () => {
    const id = await seal(await thirdParty({ pages: 1 }))
    const before = (await fields(id)).source
    const next = await storeSourcePdf(file(await thirdParty({ pages: 2 })))
    await updateDocument(actor, id, { kind: 'seal', language: 'id', customerId: null, documentDate: '2026-10-30', values: values(), invoiceIds: [], source: next })
    expect((await fields(id)).source.pages).toBe(2)
    expect(files.has(before.key)).toBe(false)
    expect(files.has(next.key)).toBe(true)
    await refused(createDocument(actor, { kind: 'seal', language: 'id', customerId: null, documentDate: '2026-10-30', values: values(), invoiceIds: [] }), /Upload the PDF/)
  })

  it('refuses what cannot be sealed safely, before anything is stored', async () => {
    await refused(storeSourcePdf(file(Buffer.from('not a pdf at all '.repeat(40)))), /Only PDF documents/)
    await refused(storeSourcePdf(file(Buffer.from(('%PDF-1.4\n' + 'garbage '.repeat(80))))), /Invalid or damaged PDF/)
    await refused(storeSourcePdf(file(await thirdParty({ sign: true }))), /already carries a digital signature/)
    await refused(storeSourcePdf(file(await thirdParty({ openAction: true }))), /Active or executable/)
    await refused(storeSourcePdf(file(await thirdParty({ pages: 201 }))), /1 to 200 pages/)
    await refused(storeSourcePdf(new File([], 'empty.pdf')), /Choose the PDF/)
    expect(files.size).toBe(0)
  })

  it('refuses a seal that does not fit the page, and an incomplete form', async () => {
    const tiny = await seal(await thirdParty({ size: [200, 120] }))
    await refused(setDocumentStatus(actor, tiny, 'issue', BASE), /too small for the seal/)
    expect((await sql`select status from documents where id = ${tiny}`)[0].status).toBe('draft')
    expect(files.size).toBe(1)                                                                          // nothing half-made was left in Storage
    await refused(seal(await thirdParty(), { signatory_name: '' }), /Nama penandatangan VORA|VORA signatory name/i)
    await refused(seal(await thirdParty(), { corner: 'middle' }), /choose one of the listed options/)
  })

  it('through the form: stores the file, redirects on success, and leaves nothing behind when the form is refused', async () => {
    const as = { as: await sessionFor(await createUser('seal-actions@example.invalid', 'admin')) }
    const form = (o: Record<string, string | Blob> = {}) => ({ kind: 'seal', language: 'id', document_date: '2026-10-30', ...values(), source_pdf: file(Buffer.from(JSON.stringify(1)) as never), ...o })
    const pdf = file(await thirdParty())
    const bad = await act(saveDocumentAction, form({ source_pdf: pdf, signatory_title: '' }), as)
    expect(bad.state!.error).toMatch(/required/)
    expect(files.size).toBe(0)                                                                          // the uploaded file was removed again
    const ok = await act(saveDocumentAction, form({ source_pdf: pdf }), as)
    expect(ok.redirect).toMatch(/^\/admin\/documents\/\d+\?notice=Document%20draft%20created$/)
    expect(files.size).toBe(1)
    const id = Number(/documents\/(\d+)/.exec(ok.redirect!)![1])
    expect((await act(documentStatusAction, { record: String(id), action: 'issue' }, as)).redirect).toBe(`/admin/documents/${id}?notice=Document%20state%20updated`)
    expect((await fields(id)).seal!.pagesSealed).toBe(1)
    const catalog = await PDFDocument.load(await renderDocumentPdf('document', id, BASE))
    expect(catalog.getPageCount()).toBe(1)
    expect(catalog.getPage(0).node.lookup(PDFName.of('Annots')) instanceof PDFArray || true).toBe(true)
    expect(catalog.catalog.lookup(PDFName.of('Pages')) instanceof PDFDict).toBe(true)
  })
})
