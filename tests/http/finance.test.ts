import { spawnSync } from 'node:child_process'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '@/server/auth/password'
import { SESSION_COOKIE, createSessionToken } from '@/server/auth/session'
import { Client } from './client'
import { seedFinance, type Seed } from './fixtures'

/** Documents, QR verification, customer links and the cron endpoint, through the real production server. */
const db = postgres(process.env.HTTP_DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(async () => { await db.end({ timeout: 5 }) })
let seed: Seed
let admin: Client
const anon = new Client()

beforeAll(async () => {
  process.env.SESSION_SECRET = process.env.HTTP_SESSION_SECRET
  const hash = await hashPassword('Correct-horse-battery-9')
  const [u] = await db`insert into users (email, password_hash, role) values ('finance-http@example.invalid', ${hash}, 'admin') on conflict (email) do update set active = true returning id`
  admin = new Client()
  admin.cookies.set(SESSION_COOKIE, await createSessionToken({ id: u.id as number, passwordHash: hash, role: 'admin' }))
  seed = await seedFinance()
})

const hasPoppler = !spawnSync('pdftotext', ['-v']).error
const pdfText = (bytes: Uint8Array) => (hasPoppler ? spawnSync('pdftotext', ['-layout', '-', '-'], { input: Buffer.from(bytes) }).stdout.toString() : '')

describe('QR verification page', () => {
  const page = async (token: string) => { const res = await anon.get(`/verify/${token}`); return { res, html: await res.text() } }
  it('states type, reference, issuer, date and status, and nothing about the customer or the money', async () => {
    const { res, html } = await page(seed.tokens.invoice)
    expect(res.status).toBe(200)
    const [inv] = await db`select number from invoices where id = ${seed.ids.invoices}`
    expect(html).toContain('AUTHENTIC'); expect(html).toContain('PARTIALLY PAID'); expect(html).toContain(inv.number as string)
    expect(html).toContain('VORA / PT Satu Arah International'); expect(html).toContain('Invoice')
    for (const secret of ['HTTP Fixture Customer', 'billing@fixture.example', 'Jl. Fixture', '1,000,000', '400,000', '9900001111']) expect(html, secret).not.toContain(secret)
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(html).toMatch(/<meta name="robots" content="noindex/)
  })
  it('tells apart draft, void, pending e-meterai and issued documents', async () => {
    expect((await page(seed.tokens.draftInvoice)).html).toContain('DRAFT')
    const voided = (await page(seed.tokens.voidInvoice)).html
    expect(voided).toContain('VOID'); expect(voided).not.toContain('AWAITING PAYMENT')
    expect((await page(seed.tokens.stampReceipt)).html).toContain('PENDING E-METERAI')
    const receipt = (await page(seed.tokens.receipt)).html
    expect(receipt).toContain('AUTHENTIC'); expect(receipt).toContain('Receipt')
    expect((await page(seed.tokens.quotation)).html).toContain('Price Agreement Letter')
  })
  it('shows a pre-payment receipt as such: its state, the state of its invoice, and that it is no proof of payment', async () => {
    const released = (await page(seed.tokens.prepayment)).html
    expect(released).toContain('Pre-Payment Receipt'); expect(released).toContain('AUTHENTIC'); expect(released).toContain('Status of the invoice:'); expect(released).toContain('PARTIALLY PAID')
    expect(released).toContain('not proof that payment was made')
    const [p] = await db`select number from prepayment_receipts where id = ${seed.ids.prepayments}`
    expect(released).toContain(p.number as string)
    for (const secret of ['HTTP Fixture Customer', 'billing@fixture.example', '1,000,000', '9900001111']) expect(released, secret).not.toContain(secret)
    expect((await page(seed.tokens.draftPrepayment)).html).toContain('DRAFT')
    const voided = (await page(seed.tokens.voidPrepayment)).html
    expect(voided).toContain('VOID'); expect(voided).not.toContain('AWAITING PAYMENT')
    expect((await page(seed.tokens.stampPrepayment)).html).toContain('PENDING E-METERAI')
  })
  it('names a general document by its type in its own language and shows nothing of what it says; a certificate names its holder', async () => {
    const letter = (await page(seed.tokens.document)).html
    const [d] = await db`select number from documents where id = ${seed.ids.documents}`
    expect(letter).toContain('AUTHENTIC'); expect(letter).toContain('Surat Umum'); expect(letter).toContain(d.number as string); expect(letter).toContain('2026-10-30')
    for (const secret of ['Rahasia', 'PT Penerima', 'Isi surat', 'Siti Rahma']) expect(letter, secret).not.toContain(secret)
    const certificate = (await page(seed.tokens.certificate)).html
    expect(certificate).toContain('AUTHENTIC'); expect(certificate).toContain('Sertifikat'); expect(certificate).toContain('Awarded to:'); expect(certificate).toContain('Rina Wijaya')
    expect(certificate).toContain('SERTIFIKAT PENGHARGAAN'); expect(certificate).toContain('2027-10-30'); expect(certificate).not.toContain('Atas dedikasinya')
    const draft = (await page(seed.tokens.draftDocument)).html
    expect(draft).toContain('DRAFT'); expect(draft).toContain('Surat Pernyataan'); expect(draft).not.toContain('Budi Draft')
    const voided = (await page(seed.tokens.voidDocument)).html
    expect(voided).toContain('VOID'); expect(voided).toContain('General letter')               // written in English, so named in English
    await db`update documents set status = 'draft' where id = ${seed.ids.certificates}`
    expect((await page(seed.tokens.certificate)).html).not.toContain('Rina Wijaya')            // nobody is named before the certificate is issued
    await db`update documents set status = 'issued' where id = ${seed.ids.certificates}`
  })
  it('follows a revoked link to VOID and answers 404 for anything unknown', async () => {
    await db`update document_verification_tokens set revoked = true where token = ${seed.tokens.receipt}`
    expect((await page(seed.tokens.receipt)).html).toContain('VOID')
    await db`update document_verification_tokens set revoked = false where token = ${seed.tokens.receipt}`
    for (const t of ['nope', 'x'.repeat(200), '..%2f..%2fetc', seed.tokens.invoice.slice(0, -1) + (seed.tokens.invoice.endsWith('A') ? 'B' : 'A')]) expect((await anon.get(`/verify/${t}`)).status, t).toBe(404)
  })
})

describe('PDF downloads', () => {
  const kinds: Array<[string, () => number]> = [['invoices', () => seed.ids.invoices], ['quotations', () => seed.ids.quotations], ['receipts', () => seed.ids.receipts], ['receipts', () => seed.ids.stampReceipt],
    ['prepayment-receipts', () => seed.ids.prepayments], ['prepayment-receipts', () => seed.ids.stampPrepayment], ['prepayment-receipts', () => seed.ids.draftPrepayment],
    ['documents', () => seed.ids.documents], ['documents', () => seed.ids.certificates], ['documents', () => seed.ids.draftDocument]]
  it.each(kinds)('%s render as real, private PDFs for an admin', async (kind, id) => {
    const res = await admin.get(`/admin/${kind}/${id()}/pdf`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-disposition')).toMatch(/^inline; filename="(INV|QUO|RCP|PPR|LTR|CRT|STM)-VORA-[CV][0-9A-F]{10}-\d{6}-\d{5}\.pdf"$/)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-')
    if (hasPoppler) expect(pdfText(bytes)).toMatch(/INVOICE|PRICE AGREEMENT LETTER|RECEIPT|PRE-PAYMENT RECEIPT|SURAT UMUM|SERTIFIKAT|SURAT PERNYATAAN/)
  })
  it('refuse what does not exist or cannot be issued yet', async () => {
    for (const kind of ['invoices', 'quotations', 'receipts', 'prepayment-receipts', 'documents']) expect((await admin.get(`/admin/${kind}/99999/pdf`)).status, kind).toBe(404)
    await db`update payments set status = 'pending_confirmation' where id = (select payment_id from receipts where id = ${seed.ids.receipts})`
    expect((await admin.get(`/admin/receipts/${seed.ids.receipts}/pdf`)).status).toBe(409)
    await db`update payments set status = 'recorded' where id = (select payment_id from receipts where id = ${seed.ids.receipts})`
    expect((await admin.get(`/admin/receipts/${seed.ids.receipts}/pdf`)).status).toBe(200)
  })
  it('serve a customer-signed quotation only to an admin, and only while its fingerprint still matches', async () => {
    const url = `/admin/quotation-approvals/${seed.ids['quotation-approvals']}/file`
    expect((await anon.get(url)).status).toBe(307)
    const res = await admin.get(url)
    expect(res.status).toBe(200); expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(Buffer.from((await res.arrayBuffer()).slice(0, 5)).toString()).toBe('%PDF-')
    const [{ sha }] = await db`select signed_pdf_sha256 as sha from quotation_approvals where id = ${seed.ids['quotation-approvals']}`
    await db`update quotation_approvals set signed_pdf_sha256 = ${'0'.repeat(64)} where id = ${seed.ids['quotation-approvals']}`
    expect((await admin.get(url)).status).toBe(409)
    await db`update quotation_approvals set signed_pdf_sha256 = ${sha} where id = ${seed.ids['quotation-approvals']}`        // leave the fixture as it was: other files read it
    expect((await admin.get(`/admin/quotation-approvals/99999/file`)).status).toBe(404)
  })
})

describe('customer quotation approval link', () => {
  it('shows the private upload page, with the Price Agreement Letter PDF behind the same link', async () => {
    const res = await anon.get(`/quotation-approval/${seed.tokens.approval}`)
    expect(res.status).toBe(200)
    const html = await res.text()
    const [q] = await db`select number from quotations where id = ${seed.ids.quotations}`
    expect(html).toContain(q.number as string); expect(html).toContain('SUBMITTED')
    // The customer sees what the signature accepts before signing anything.
    expect(html).toContain('What your signature accepts'); expect(html).toContain('Payment within 14 days of the invoice date'); expect(html).toContain('Services follow the booking conditions of VORA.')
    expect(res.headers.get('x-robots-tag')).toContain('noindex'); expect(res.headers.get('referrer-policy')).toBe('no-referrer'); expect(res.headers.get('cache-control')).toContain('no-store')
    const pdf = await anon.get(`/quotation-approval/${seed.tokens.approval}/pdf`)
    expect(pdf.status).toBe(200); expect(pdf.headers.get('content-type')).toBe('application/pdf'); expect(pdf.headers.get('content-disposition')).toContain('attachment')
    expect(Buffer.from((await pdf.arrayBuffer()).slice(0, 5)).toString()).toBe('%PDF-')
  })
  it('offers the upload form only while the request is open', async () => {
    await db`update quotation_approvals set status = 'pending' where token_hash = (select token_hash from quotation_approvals order by id limit 1)`
    const open = await (await anon.get(`/quotation-approval/${seed.tokens.approval}`)).text()
    expect(open).toContain('name="signer_name"'); expect(open).toContain('type="file"'); expect(open).toContain('name="ack"'); expect(open).toContain('type="hidden" name="token"')
    expect(open).toContain('How to approve'); expect(open).toContain('Authorized signature'); expect(open).toContain('Company stamp')
    await db`update quotation_approvals set expires_at = now() - interval '1 minute'`
    const expired = await (await anon.get(`/quotation-approval/${seed.tokens.approval}`)).text()
    expect(expired).toContain('EXPIRED'); expect(expired).not.toContain('name="signer_name"')
    expect((await anon.get(`/quotation-approval/${seed.tokens.approval}/pdf`)).status).toBe(410)
    await db`update quotation_approvals set expires_at = now() + interval '7 days', status = 'submitted'`
  })
  it('answers 404 for a wrong link, and for a voided quotation', async () => {
    for (const t of ['x'.repeat(60), 'short', '%2e%2e%2fadmin']) expect((await anon.get(`/quotation-approval/${t}`)).status, t).toBe(404)
    expect((await anon.get(`/quotation-approval/${'y'.repeat(60)}/pdf`)).status).toBe(404)
    await db`update quotations set status = 'void' where id = ${seed.ids.quotations}`
    expect((await anon.get(`/quotation-approval/${seed.tokens.approval}`)).status).toBe(404)
    await db`update quotations set status = 'awaiting_approval' where id = ${seed.ids.quotations}`
  })
})

describe('scheduled email retry', () => {
  it('needs the exact CRON_SECRET and answers with the dispatch result', async () => {
    const secret = process.env.HTTP_CRON_SECRET!
    const wrong: Array<Record<string, string>> = [{}, { authorization: 'Bearer wrong' }, { authorization: `Bearer ${secret}x` }, { authorization: secret }, { authorization: 'Bearer ' }]
    for (const h of wrong) {
      const res = await anon.get('/internal/mail/dispatch', h)
      expect(res.status, JSON.stringify(h)).toBe(401)
      expect(await res.text()).toBe('Unauthorized')
    }
    const ok = await anon.get('/internal/mail/dispatch', { authorization: `Bearer ${secret}` })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ sent: 0, failed: 0 })
    expect(ok.headers.get('cache-control')).toContain('no-store')
  })
})
