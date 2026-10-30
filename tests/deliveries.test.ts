import { randomBytes } from 'node:crypto'
import { PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib'
import sharp from 'sharp'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { saveCustomer } from '@/server/finance/customers'
import { createDelivery, deliveryBy, proofEvidence, proofsOf, rejectProof, resendReceivedEmail, setDeliveryStatus, submitProof, updateDelivery, type DeliveryInput, type ProofInput } from '@/server/delivery/deliveries'
import { saveMailConfig } from '@/server/mail/config'
import { deliveryNotePdf, podPdf } from '@/server/pdf/delivery-render'
import { createUser } from './helpers/actions'
import { sql } from './helpers/db'

// The tests have no Storage service: files go to a map, which is all the service needs of it.
const files = vi.hoisted(() => new Map<string, Uint8Array>())
vi.mock('@/server/storage', async (original) => ({
  ...(await original<typeof import('@/server/storage')>()),
  putObject: async (_bucket: string, key: string, bytes: Uint8Array) => { if (files.has(key)) throw new Error('exists'); files.set(key, bytes) },
  removeObject: async (_bucket: string, key: string) => { files.delete(key) },
  getObject: async (_bucket: string, key: string) => { const f = files.get(key); if (!f) throw new Error('missing'); return f },
}))

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
const BASE = 'https://voraworld.id'
let actor: number

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
  png = 'data:image/png;base64,' + (await noise(120, 60).png().toBuffer()).toString('base64')
  jpeg = 'data:image/jpeg;base64,' + (await noise(300, 200).jpeg({ quality: 60 }).toBuffer()).toString('base64')
})

const note = (o: Partial<DeliveryInput> = {}): DeliveryInput => ({
  customerId: null, consigneeName: 'PT Penerima', consigneeAddress: 'Jl. Gudang 5, Bekasi', consigneeContact: 'Budi', consigneePhone: '+62 21 555', consigneeEmail: 'gudang@penerima.example',
  origin: 'Jakarta', destination: 'Bekasi', shipmentReference: 'JOB-1', poNumber: 'PO-9', carrier: 'VORA Trucking', vehicle: 'Wingbox', vehiclePlate: 'B 1234 XYZ', driverName: 'Asep', driverPhone: '0812',
  deliveryDate: '2026-10-30', notes: 'Handle with care', items: 'Cartons of parts | 24 | ctn | fragile\nPallet of cables | 2', ...o,
})
const proof = (token: string, o: Partial<ProofInput> = {}): ProofInput => ({
  token, receiverName: 'Siti Aminah', receiverPosition: 'Warehouse head', receiverPhone: '+62 812 3456', receiverEmail: '', receiverIdNumber: '', condition: 'good', conditionNote: '',
  signature: png, photos: [jpeg], latitude: '-6.2', longitude: '106.8', accuracy: '12.5', locationStatus: 'captured', locationNote: '', deviceTime: '2026-10-30T03:00:00.000Z', ip: '203.0.113.9', userAgent: 'Test phone', ...o,
})
async function issued(o: Partial<DeliveryInput> = {}) {
  const id = await createDelivery(actor, note(o))
  await setDeliveryStatus(actor, id, 'issue')
  return (await deliveryBy('id', id))!
}

describe('delivery notes', () => {
  it('numbers a note under the customer, keeps items in order, and edits only a draft', async () => {
    const customer = await saveCustomer(actor, null, { name: 'PT Pelanggan', email: 'c@pelanggan.example', address: 'Jl. Kantor 1', taxId: '', currency: 'IDR', termsDays: '14' })
    const id = await createDelivery(actor, note({ customerId: customer, consigneeName: '', consigneeAddress: '', consigneeEmail: '' }))
    const d = (await deliveryBy('id', id))!
    expect(d.number).toMatch(/^DLV-VORA-C[A-F0-9]{10}-202610-\d{5}$/)
    expect(d).toMatchObject({ status: 'draft', consigneeName: 'PT Pelanggan', consigneeAddress: 'Jl. Kantor 1', consigneeEmail: 'c@pelanggan.example' })
    expect(d.items.map((i) => [i.description, i.quantity, i.unit])).toEqual([['Cartons of parts', '24', 'ctn'], ['Pallet of cables', '2', 'pcs']])
    expect(d.captureToken).not.toEqual(d.viewToken)
    await updateDelivery(actor, id, note({ customerId: customer, items: 'Only item | 1 | box' }))
    expect((await deliveryBy('id', id))!.items).toHaveLength(1)
    await setDeliveryStatus(actor, id, 'issue')
    await expect(updateDelivery(actor, id, note())).rejects.toMatchObject({ status: 409 })
    await expect(setDeliveryStatus(actor, id, 'issue')).rejects.toMatchObject({ status: 409 })
  })

  it('refuses what is wrong instead of cutting it short', async () => {
    await expect(createDelivery(actor, note({ items: '' }))).rejects.toThrow(/at least one item/)
    await expect(createDelivery(actor, note({ items: 'no quantity' }))).rejects.toThrow(/description \| quantity/)
    await expect(createDelivery(actor, note({ consigneeName: 'x'.repeat(241) }))).rejects.toThrow(/too long/)
    await expect(createDelivery(actor, note({ deliveryDate: '2026-02-31' }))).rejects.toThrow(/valid date/)
    await expect(createDelivery(actor, note({ consigneeEmail: 'not an email' }))).rejects.toThrow(/valid address/)
    await expect(createDelivery(actor, note({ customerId: 999999 }))).rejects.toThrow(/existing customer/)
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
    expect(p).toMatchObject({ status: 'submitted', condition: 'good', locationStatus: 'captured', latitude: -6.2, longitude: 106.8, accuracyM: 12.5, ip: '203.0.113.9' })
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

  it('does not need the location: a receiver who declines still sends the proof', async () => {
    const d = await issued()
    await submitProof(proof(d.captureToken, { locationStatus: 'unavailable', latitude: '', longitude: '', accuracy: '', locationNote: '' }), BASE)
    const [p] = await proofsOf(d.id)
    expect(p).toMatchObject({ locationStatus: 'unavailable', latitude: null, longitude: null })
    expect(Buffer.from(await podPdf(d.id, BASE)).subarray(0, 5).toString()).toBe('%PDF-')
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
