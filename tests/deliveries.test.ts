import { randomBytes } from 'node:crypto'
import { PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib'
import sharp from 'sharp'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { saveCustomer } from '@/server/finance/customers'
import { createDelivery, deliveryBy, proofEvidence, proofsOf, rejectProof, resendReceivedEmail, setDeliveryStatus, submitProof, updateDelivery, type DeliveryInput, type ProofInput } from '@/server/delivery/deliveries'
import { saveMailConfig } from '@/server/mail/config'
import { deliveryNotePdf, podPdf } from '@/server/pdf/delivery-render'
import { classifyProviderError, putObject } from '@/server/storage'
import { pdfPages, squash } from './helpers/pdf-text'
import { createUser } from './helpers/actions'
import { validatedQuotation } from './helpers/commercial'
import { sql } from './helpers/db'

// The tests have no Storage service: files go to a map, which is all the service needs of it.
const files = vi.hoisted(() => new Map<string, Uint8Array>())
const storage = vi.hoisted(() => ({ failWith: null as 'type' | 'size' | 'denied' | 'unavailable' | null, failAfter: 0, uploads: [] as Array<{ key: string; contentType: string; size: number }> }))
vi.mock('@/server/storage', async (original) => (await import('./helpers/memory-storage')).memoryStorage(await original(), files, storage))

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
const BASE = 'https://voraworld.id'
let actor: number
let customer = 0, quotation = 0       // a customer and one of its validated quotations: every delivery note is made under them

/** The addresses a PDF links to (its clickable links; the QR codes print the same addresses). */
async function links(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes)
  const out: string[] = []
  for (const page of doc.getPages()) {
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const uri = doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'))
      if (uri instanceof PDFString) out.push(uri.decodeText())
    }
  }
  return out
}

/** Pixel noise does not compress, so the image is a believable size. */
const noise = (w: number, h: number) => { const raw = Buffer.alloc(w * h * 3); for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24; return sharp(raw, { raw: { width: w, height: h, channels: 3 } }) }
let png: string, jpeg: string
beforeAll(async () => {
  actor = (await createUser('delivery@example.invalid', 'admin')).id
  customer = await saveCustomer(actor, null, { name: 'PT Pengirim', email: 'c@pengirim.example', address: 'Jl. Kantor 1', taxId: '', currency: 'IDR', termsDays: '14' })
  quotation = await validatedQuotation(actor, customer)
  png = 'data:image/png;base64,' + (await noise(120, 60).png().toBuffer()).toString('base64')
  jpeg = 'data:image/jpeg;base64,' + (await noise(300, 200).jpeg({ quality: 60 }).toBuffer()).toString('base64')
})

const note = (o: Partial<DeliveryInput> = {}): DeliveryInput => ({
  customerId: customer, quotationId: quotation, shipperName: 'PT Pengirim Utama', shipperAddress: 'Jl. Pabrik 9, Kawasan Industri, Cikarang, Jawa Barat 17530', shipperContact: 'Rina', shipperPhone: '+62 21 888', shipperEmail: 'gudang@pengirim.example', consigneeName: 'PT Penerima', consigneeAddress: 'Jl. Gudang 5, Bekasi', consigneeContact: 'Budi', consigneePhone: '+62 21 555', consigneeEmail: 'gudang@penerima.example',
  origin: 'Jakarta', destination: 'Bekasi', shipmentReference: 'JOB-1', poNumber: 'PO-9', carrier: 'VORA Trucking', vehicle: 'Wingbox', vehiclePlate: 'B 1234 XYZ', driverName: 'Asep', driverPhone: '0812',
  deliveryDate: '2026-10-30', notes: 'Handle with care', items: [{ description: 'Cartons of parts', quantity: '24', unit: 'ctn', remarks: 'fragile' }, { description: 'Pallet of cables', quantity: '2', unit: '', remarks: '' }], ...o,
})
const proof = (token: string, o: Partial<ProofInput> = {}): ProofInput => ({
  token, courierName: 'Asep Kurniawan', courierPhone: '0812 1111 2222', receiverName: 'Siti Aminah', receiverPosition: 'Warehouse head', receiverPhone: '+62 812 3456', receiverEmail: '', receiverIdNumber: '', condition: 'good', conditionNote: '',
  signature: png, photos: [jpeg], latitude: '-6.2', longitude: '106.8', accuracy: '12.5', locationStatus: 'captured', locationNote: '', deviceTime: '2026-10-30T03:00:00.000Z', ip: '203.0.113.9', userAgent: 'Test phone', ...o,
})
async function issued(o: Partial<DeliveryInput> = {}) {
  const id = await createDelivery(actor, note(o))
  await setDeliveryStatus(actor, id, 'issue')
  return (await deliveryBy('id', id))!
}

describe('delivery notes', () => {
  it('numbers a note under the customer, keeps its quotation and cargo rows in order, and edits only a draft', async () => {
    const id = await createDelivery(actor, note())
    const d = (await deliveryBy('id', id))!
    expect(d.number).toMatch(/^DLV-VORA-C[A-F0-9]{10}-202610-\d{5}$/)
    expect(d).toMatchObject({ status: 'draft', customerId: customer, quotationId: quotation, consigneeName: 'PT Penerima', consigneeAddress: 'Jl. Gudang 5, Bekasi', consigneeEmail: 'gudang@penerima.example' })
    expect(d.items.map((i) => [i.description, i.quantity, i.unit])).toEqual([['Cartons of parts', '24', 'ctn'], ['Pallet of cables', '2', 'pcs']])
    expect(d.captureToken).not.toEqual(d.viewToken)
    await updateDelivery(actor, id, note({ items: [{ description: 'Only item', quantity: '1', unit: 'box', remarks: '' }, { description: '', quantity: '', unit: '', remarks: '' }] }))     // an empty row is ignored
    expect((await deliveryBy('id', id))!.items).toHaveLength(1)
    const other = await saveCustomer(actor, null, { name: 'PT Lain', email: 'x@lain.example', address: '-', taxId: '', currency: 'IDR', termsDays: '14' })
    await updateDelivery(actor, id, note({ customerId: other, quotationId: null }))                                                   // customer and quotation cannot be changed by an edit
    expect(await deliveryBy('id', id)).toMatchObject({ customerId: customer, quotationId: quotation })
    await setDeliveryStatus(actor, id, 'issue')
    await expect(updateDelivery(actor, id, note())).rejects.toMatchObject({ status: 409 })
    await expect(setDeliveryStatus(actor, id, 'issue')).rejects.toMatchObject({ status: 409 })
  })

  it('is made only for a customer\'s VALIDATED quotation', async () => {
    await expect(createDelivery(actor, note({ customerId: null }))).rejects.toThrow(/Select the customer/)
    await expect(createDelivery(actor, note({ quotationId: null }))).rejects.toThrow(/validated quotations/)
    const other = await saveCustomer(actor, null, { name: 'PT Orang Lain', email: 'y@orang.example', address: '-', taxId: '', currency: 'IDR', termsDays: '14' })
    await expect(createDelivery(actor, note({ customerId: other }))).rejects.toThrow(/does not belong to this customer/)
    const [draft] = await sql`insert into quotations (number, customer_id, status, currency, issued_at, valid_until, payment_terms, terms_conditions) values ('QUO-DRAFT-1', ${customer}, 'draft', 'IDR', '2026-10-01', '2999-01-01', 'x', 'y') returning id`
    await expect(createDelivery(actor, note({ quotationId: draft.id as number }))).rejects.toMatchObject({ status: 409 })
    const ids = [await createDelivery(actor, note()), await createDelivery(actor, note())]                                            // many notes under one quotation, each its own number
    expect(new Set((await sql`select number from deliveries where id in ${sql(ids)}`).map((r) => r.number)).size).toBe(2)
  })

  it('refuses what is wrong instead of cutting it short', async () => {
    await expect(createDelivery(actor, note({ items: [] }))).rejects.toThrow(/at least one item of cargo/)
    await expect(createDelivery(actor, note({ items: [{ description: 'no quantity', quantity: '', unit: '', remarks: '' }] }))).rejects.toThrow(/write the quantity/)
    await expect(createDelivery(actor, note({ items: [{ description: 'x'.repeat(501), quantity: '1', unit: '', remarks: '' }] }))).rejects.toThrow(/too long/)
    await expect(createDelivery(actor, note({ consigneeName: 'x'.repeat(241) }))).rejects.toThrow(/too long/)
    await expect(createDelivery(actor, note({ deliveryDate: '2026-02-31' }))).rejects.toThrow(/valid date/)
    await expect(createDelivery(actor, note({ consigneeEmail: 'not an email' }))).rejects.toThrow(/valid address/)
  })

  it('prints the note as a PDF whose QR address is the receiver\'s link, marked while it is a draft', async () => {
    const id = await createDelivery(actor, note())
    const draft = Buffer.from(await deliveryNotePdf(id, BASE))
    expect(draft.subarray(0, 5).toString()).toBe('%PDF-')
    await setDeliveryStatus(actor, id, 'issue')
    const pdf = await deliveryNotePdf(id, BASE)
    expect(await links(pdf)).toContain(`${BASE}/pod/${(await deliveryBy('id', id))!.captureToken}`)
  })
})

describe('proof of delivery', () => {
  it('records the receipt once, with its evidence, the time and the location when shared', async () => {
    const d = await issued()
    const received = await submitProof(proof(d.captureToken), BASE)
    expect(received).toMatchObject({ number: d.number, receiver: 'Siti Aminah' })
    const after = (await deliveryBy('id', d.id))!
    expect(after.status).toBe('delivered')
    expect(after.deliveredAt).toBeInstanceOf(Date)
    const [p] = await proofsOf(d.id)
    expect(p).toMatchObject({ status: 'submitted', courierName: 'Asep Kurniawan', courierPhone: '0812 1111 2222', condition: 'good', locationStatus: 'captured', latitude: -6.2, longitude: 106.8, accuracyM: 12.5, ip: '203.0.113.9' })
    expect(p.serverTime).toBeInstanceOf(Date)
    expect(p.photos).toHaveLength(1)
    expect((await proofEvidence(p, 'signature'))!.type).toBe('image/png')
    expect((await proofEvidence(p, 'photo-1'))!.type).toBe('image/jpeg')
    expect(await proofEvidence(p, 'photo-2')).toBeNull()
    await expect(submitProof(proof(d.captureToken), BASE)).rejects.toMatchObject({ status: 409 })       // the QR code works once
    const pdf = await podPdf(d.id, BASE)
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe('%PDF-')
    expect(await links(pdf)).toContain(`${BASE}/pod/view/${d.viewToken}`)
    const [audit] = await sql`select actor_id, verb from audit_logs where object_type = 'delivery' and object_id = ${d.id} and verb = 'receive'`
    expect(audit).toMatchObject({ actorId: null, verb: 'receive' })
  })

  it('requires the location: a phone with location off cannot record the delivery', async () => {
    const d = await issued()
    for (const o of [
      { locationStatus: 'unavailable', latitude: '', longitude: '', accuracy: '', locationNote: 'blocked' },
      { locationStatus: '', latitude: '', longitude: '' },
      { latitude: '', longitude: '' },
    ] as Array<Partial<ProofInput>>) await expect(submitProof(proof(d.captureToken, o), BASE)).rejects.toThrow(/Turn on the location|not a valid location/)
    expect((await deliveryBy('id', d.id))!.status).toBe('issued')
    await expect(sql`select delivery_submit_proof(${sql.json({ token: d.captureToken, location_status: 'unavailable', photos: [{ key: 'k', sha256: 'h' }] })})`).rejects.toThrow(/Turn on the location/)   // the database refuses too
    await submitProof(proof(d.captureToken), BASE)
    expect((await proofsOf(d.id))[0]).toMatchObject({ locationStatus: 'captured', latitude: -6.2, longitude: 106.8 })
  })

  it('refuses a bad link, a note not yet issued or cancelled, and bad evidence, and leaves no file behind', async () => {
    await expect(submitProof(proof('short'), BASE)).rejects.toMatchObject({ status: 404 })
    await expect(submitProof(proof('A'.repeat(48)), BASE)).rejects.toMatchObject({ status: 404 })
    const draftId = await createDelivery(actor, note())
    await expect(submitProof(proof((await deliveryBy('id', draftId))!.captureToken), BASE)).rejects.toThrow(/not been issued/)
    const d = await issued()
    const before = files.size
    for (const [what, o, message] of [
      ['an empty signature', { signature: 'data:image/png;base64,' + (await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()).toString('base64') }, /Sign in the box/],
      ['no photo', { photos: [] }, /at least one photo/],
      ['five photos', { photos: [jpeg, jpeg, jpeg, jpeg, jpeg] }, /at most 4/],
      ['a photo that is not a JPEG', { photos: [png] }, /not a valid photo/],
      ['no driver name', { courierName: '' }, /driver's name is required/],
      ['a bad driver phone', { courierPhone: 'call me' }, /driver's phone number/],
      ['a bad condition', { condition: 'broken' }, /condition/],
      ['damage without a note', { condition: 'damaged' }, /Describe what is damaged/],
      ['a bad phone number', { receiverPhone: 'call me' }, /phone number/],
      ['a location off the map', { latitude: '120' }, /not a valid location/],
    ] as Array<[string, Partial<ProofInput>, RegExp]>) {
      await expect(submitProof(proof(d.captureToken, o), BASE), what).rejects.toThrow(message)
    }
    expect(files.size).toBe(before)
    expect((await deliveryBy('id', d.id))!.status).toBe('issued')
    await setDeliveryStatus(actor, d.id, 'void')
    await expect(submitProof(proof(d.captureToken), BASE)).rejects.toThrow(/cancelled/)
  })

  it('lets only one of two phones record the receipt, and removes the loser\'s files', async () => {
    const d = await issued()
    const before = files.size
    const results = await Promise.allSettled([submitProof(proof(d.captureToken, { receiverName: 'First Receiver' }), BASE), submitProof(proof(d.captureToken, { receiverName: 'Second Receiver' }), BASE)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await sql`select 1 from delivery_proofs where delivery_id = ${d.id} and status = 'submitted'`).toHaveLength(1)
    expect(files.size).toBe(before + 2)                         // the signature and one photo of the winner only
  })

  it('refuses evidence whose stored file was swapped', async () => {
    const d = await issued()
    await submitProof(proof(d.captureToken), BASE)
    const [p] = await proofsOf(d.id)
    files.set(p.signatureKey, new Uint8Array([1, 2, 3]))
    await expect(proofEvidence(p, 'signature')).rejects.toThrow(/integrity/)
  })

  it('lets Finance reject a wrong proof: it stays as history and the same QR code works again', async () => {
    const d = await issued()
    await submitProof(proof(d.captureToken, { receiverName: 'Wrong Person' }), BASE)
    await expect(setDeliveryStatus(actor, d.id, 'void')).rejects.toThrow(/reject the proof/)
    await expect(rejectProof(actor, d.id, 'no')).rejects.toThrow(/at least 5/)
    await rejectProof(actor, d.id, 'Wrong person signed')
    expect((await deliveryBy('id', d.id))!).toMatchObject({ status: 'issued', deliveredAt: null })
    await submitProof(proof(d.captureToken, { receiverName: 'Right Person' }), BASE)
    const proofs = await proofsOf(d.id)
    expect(proofs.map((p) => [p.status, p.receiverName])).toEqual([['submitted', 'Right Person'], ['rejected', 'Wrong Person']])
    expect(proofs[1].rejectReason).toBe('Wrong person signed')
    await expect(rejectProof(actor, (await issued()).id, 'No proof yet here')).rejects.toMatchObject({ status: 409 })
  })

  it('emails the consignee the link to the proof, and the admin, when the rules are on; resend is throttled by minute', async () => {
    await saveMailConfig({ host: 'smtp.example.invalid', port: 587, security: 'starttls', username: 'u', password: 'p', fromEmail: 'info@voraworld.id', fromName: 'VORA', replyTo: '', adminEmail: 'ops@voraworld.id', enabled: true })
    await sql`update email_rules set enabled = true where key in ('delivery_received_customer', 'delivery_received_admin')`
    const d = await issued()
    await submitProof(proof(d.captureToken), BASE)
    const jobs = await sql`select event, recipient, html from email_jobs where event like 'delivery_received_%' and html like ${'%' + d.number + '%'} order by event`
    expect(jobs.map((j) => [j.event, j.recipient])).toEqual([['delivery_received_admin', 'ops@voraworld.id'], ['delivery_received_customer', 'gudang@penerima.example']])
    expect(jobs[1].html).toContain(`${BASE}/pod/view/${d.viewToken}`)
    await resendReceivedEmail(actor, d.id, BASE)
    await expect(resendReceivedEmail(actor, (await issued()).id, BASE)).rejects.toMatchObject({ status: 409 })
  })
})


describe('proof of delivery when storage misbehaves', () => {
  const stored = () => [...files.keys()].filter((k) => k.startsWith('pod/'))
  const proofs = async (id: number) => Number((await sql`select count(*) as n from delivery_proofs where delivery_id = ${id}`)[0].n)

  it('stores the PNG signature and JPEG photos in a bucket that allows exactly what the migrations allow, and refuses other types', async () => {
    const d = await issued()
    storage.uploads.length = 0
    await submitProof(proof(d.captureToken), BASE)
    expect(storage.uploads.map((u) => u.contentType).sort()).toEqual(['image/jpeg', 'image/png'])
    await expect(putObject('documents', 'x/y.html', new Uint8Array([1]), 'text/html')).rejects.toMatchObject({ status: 415, failure: 'type' })
    await expect(putObject('documents', 'x/y.pdf', new Uint8Array([1]), 'application/pdf')).resolves.toBeUndefined()
    await expect(putObject('documents', 'x/big.png', new Uint8Array(11 * 1024 * 1024), 'image/png')).rejects.toMatchObject({ status: 413, failure: 'size' })
  })

  it('records nothing when storage refuses: the note stays open, no proof, no stray file, a clear message, and the same form can be sent again', async () => {
    const d = await issued()
    storage.failWith = 'denied'
    await expect(submitProof(proof(d.captureToken), BASE)).rejects.toMatchObject({ status: 502, failure: 'denied' })
    expect(await proofs(d.id)).toBe(0)
    expect((await deliveryBy('id', d.id))!.status).toBe('issued')
    expect(stored().filter((k) => k.startsWith(`pod/${d.id}/`))).toEqual([])
    storage.failWith = 'unavailable'
    await expect(submitProof(proof(d.captureToken), BASE)).rejects.toMatchObject({ status: 503, failure: 'unavailable' })
    storage.failWith = null
    await expect(submitProof(proof(d.captureToken), BASE)).resolves.toMatchObject({ receiver: 'Siti Aminah' })        // retry with the same data works
    expect(await proofs(d.id)).toBe(1)
    expect((await deliveryBy('id', d.id))!.status).toBe('delivered')
  })

  it('removes the signature already stored when a photo then fails, and sending the same proof twice records it once', async () => {
    const d = await issued()
    storage.uploads.length = 0
    storage.failWith = 'unavailable'; storage.failAfter = 1                                                             // the signature goes through, the first photo fails
    await expect(submitProof(proof(d.captureToken), BASE)).rejects.toMatchObject({ failure: 'unavailable' })
    expect(stored().filter((k) => k.startsWith(`pod/${d.id}/`))).toEqual([])                                           // no orphan
    storage.failWith = null; storage.failAfter = 0
    await Promise.all([submitProof(proof(d.captureToken), BASE), submitProof(proof(d.captureToken), BASE)].map((p) => p.catch((e) => e)))
    expect(await proofs(d.id)).toBe(1)
    expect(stored().filter((k) => k.startsWith(`pod/${d.id}/`))).toHaveLength(2)                                       // one signature and one photo: the loser's files are gone
    await expect(submitProof(proof(d.captureToken), BASE)).rejects.toMatchObject({ status: 409 })
    expect(await proofs(d.id)).toBe(1)
  })

  it('tells the provider\'s refusals apart and never puts the bucket, a policy or a key in the message', async () => {
    expect(classifyProviderError({ message: 'mime type image/png is not supported', statusCode: '415' })).toBe('type')
    expect(classifyProviderError({ message: 'The object exceeded the maximum allowed size', statusCode: '413' })).toBe('size')
    expect(classifyProviderError({ message: 'new row violates row-level security policy', statusCode: '403' })).toBe('denied')
    expect(classifyProviderError({ message: 'The resource already exists', statusCode: '409' })).toBe('conflict')
    expect(classifyProviderError({ message: 'fetch failed' })).toBe('unavailable')
    expect(classifyProviderError({ message: 'something else' })).toBe('unknown')
  })
})


describe('shipper and consignee are separate parties', () => {
  const parties = {
    shipperName: 'PT Sumber Barang Nusantara', shipperAddress: 'Jl. Raya Industri No. 12, Kawasan Jababeka, Cikarang, Bekasi, Jawa Barat 17530. Gerbang belakang, hubungi satpam.', shipperContact: 'Rina Marlina', shipperPhone: '+62 21 8900 111', shipperEmail: 'logistik@sumber.example',
    consigneeName: 'CV Tujuan Makmur', consigneeAddress: 'Jl. Pelabuhan Raya No. 77, Tanjung Priok, Jakarta Utara, DKI Jakarta 14310', consigneeContact: 'Joko Santoso', consigneePhone: '+62 21 4300 222', consigneeEmail: 'gudang@tujuan.example',
  }

  it('keeps every field of each party, apart from each other and from the customer', async () => {
    const id = await createDelivery(actor, note(parties))
    expect(await deliveryBy('id', id)).toMatchObject({
      customerId: customer, shipperName: parties.shipperName, shipperAddress: parties.shipperAddress, shipperContact: 'Rina Marlina', shipperPhone: '+62 21 8900 111', shipperEmail: 'logistik@sumber.example',
      consigneeName: 'CV Tujuan Makmur', consigneeAddress: parties.consigneeAddress, consigneeContact: 'Joko Santoso', consigneePhone: '+62 21 4300 222', consigneeEmail: 'gudang@tujuan.example',
    })
    const row = (await sql`select shipper_name, consignee_name from deliveries where id = ${id}`)[0]
    expect([row.shipperName, row.consigneeName]).toEqual(['PT Sumber Barang Nusantara', 'CV Tujuan Makmur'])      // neither became the customer ('PT Pengirim')
  })

  it('refuses a note without a named shipper or consignee and a full address, and never fills them from the customer', async () => {
    await expect(createDelivery(actor, note({ shipperName: '' }))).rejects.toThrow(/Shipper name is required/)
    await expect(createDelivery(actor, note({ shipperAddress: '  ' }))).rejects.toThrow(/Shipper address is required/)
    await expect(createDelivery(actor, note({ consigneeName: '' }))).rejects.toThrow(/Consignee name is required/)
    await expect(createDelivery(actor, note({ consigneeAddress: '' }))).rejects.toThrow(/Consignee address is required/)
    await expect(createDelivery(actor, note({ shipperEmail: 'not an email' }))).rejects.toThrow(/Shipper email is not a valid address/)
    await expect(createDelivery(actor, note({ consigneePhone: 'call me' }))).rejects.toThrow(/Consignee phone may hold only digits/)
    // The database repeats the rule for anything that does not come through the application.
    await expect(sql`select delivery_create(${actor}, ${sql.json({ customer_id: customer, quotation_id: quotation, shipper_name: 'X', shipper_address: '', consignee_name: 'Y', consignee_address: 'Z', delivery_date: '2026-10-30', items: [{ description: 'a', quantity: '1', unit: 'pcs', remarks: '' }] })})`).rejects.toThrow(/shipper/i)
  })

  it('prints both parties in full on the delivery note and on the proof of delivery, long addresses wrapped, with the references and the QR links intact', async () => {
    const d = await issued(parties)
    const text = squash((await pdfPages(await deliveryNotePdf(d.id, BASE))).join(' '))
    for (const part of ['SHIPPER / PENGIRIM', 'CONSIGNEE / PENERIMA', 'PT Sumber Barang Nusantara', 'Jl. Raya Industri No. 12', 'Gerbang belakang, hubungi satpam', 'Rina Marlina', '+62 21 8900 111', 'logistik@sumber.example',
      'CV Tujuan Makmur', 'Jl. Pelabuhan Raya No. 77', 'Jakarta Utara, DKI Jakarta 14310', 'Joko Santoso', '+62 21 4300 222', 'gudang@tujuan.example', 'SHIPMENT DETAILS', 'PT Pengirim', 'Cartons of parts']) {
      expect(text, part).toContain(part)
    }
    expect(await links(await deliveryNotePdf(d.id, BASE))).toContain(`${BASE}/pod/${d.captureToken}`)
    await submitProof(proof(d.captureToken), BASE)
    const pod = squash((await pdfPages(await podPdf(d.id, BASE))).join(' '))
    for (const part of ['SHIPPER / PENGIRIM', 'PT Sumber Barang Nusantara', 'Jl. Raya Industri No. 12', 'CV Tujuan Makmur', 'Jl. Pelabuhan Raya No. 77', 'Siti Aminah', 'Asep Kurniawan']) expect(pod, part).toContain(part)
  })

  it('leaves a note written before shippers were kept readable, says so, and invents nothing', async () => {
    const [row] = await sql`insert into deliveries (number, status, customer_id, quotation_id, consignee_name, consignee_address, delivery_date, capture_token, view_token)
      values ('DLV-LEGACY-1', 'issued', ${customer}, ${quotation}, 'PT Lama', 'Jl. Lama 1', '2026-09-01', ${'L' + randomBytes(40).toString('hex')}, ${'V' + randomBytes(40).toString('hex')}) returning id`
    await sql`insert into delivery_items (delivery_id, position, description, quantity, unit) values (${row.id}, 0, 'Old cargo', '3', 'ctn')`
    const d = (await deliveryBy('id', row.id))!
    expect(d).toMatchObject({ shipperName: '', shipperAddress: '', consigneeName: 'PT Lama' })
    expect(squash((await pdfPages(await deliveryNotePdf(row.id, BASE))).join(' '))).toContain('Not recorded on this delivery note')
    await submitProof(proof(d.captureToken), BASE)                                                                   // it can still be received: the table rule does not block a note without a shipper
    expect((await deliveryBy('id', row.id))!.status).toBe('delivered')
    expect(await podPdf(row.id, BASE)).toBeInstanceOf(Uint8Array)
  })

  it('does not rewrite the parties of a note once it is issued: it must be voided and written again', async () => {
    const d = await issued(parties)
    await expect(updateDelivery(actor, d.id, note({ ...parties, shipperName: 'Someone else' }))).rejects.toMatchObject({ status: 409 })
    expect((await deliveryBy('id', d.id))!.shipperName).toBe('PT Sumber Barang Nusantara')
    const draft = await createDelivery(actor, note(parties))
    await updateDelivery(actor, draft, note({ ...parties, shipperName: 'PT Sumber Baru', shipperAddress: 'Jl. Baru 3, Cikarang' }))
    expect(await deliveryBy('id', draft)).toMatchObject({ shipperName: 'PT Sumber Baru', shipperAddress: 'Jl. Baru 3, Cikarang' })
  })
})
