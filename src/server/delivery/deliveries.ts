import { randomBytes } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { many, one, rpc } from '../data'
import { recordAudit } from '../audit'
import { sha256Hex } from '../crypto'
import { businessDateTime, isIsoDay, today } from '../dates'
import { ActionError } from '../errors'
import { bestEffort } from '../finance/notify'
import { getMailConfig } from '../mail/config'
import { emailAddress } from '../mail/address'
import { enqueue } from '../mail/outbox'
import { getObject, putObject, removeObject } from '../storage'

/**
 * Delivery notes (surat jalan) and their proof of delivery (POD).
 *
 * VORA writes and issues a delivery note; it travels with the goods and carries a QR code. The DRIVER or COURIER who delivers the goods scans
 * it, on their own phone, at the handover: they say who they are, the receiver gives their name and signs on the screen of that phone, the driver
 * photographs the goods; the time is recorded, and so is the phone's position: the location must be switched on, no proof is accepted without it. That is the POD: it needs no
 * account, only the unguessable address in the QR code, and it can be given ONCE (until Finance rejects it). The consignee is emailed a second,
 * different address with which the finished POD can be read.
 *
 * Every limit REFUSES: text that is too long is never cut short, and a required field is never filled in silently.
 */
export const MAX_ITEMS = 100
export const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 1_200_000
const MAX_SIGNATURE_BYTES = 300_000
/** Vercel refuses a request body over 4.5 MB: the phone reduces the photos, and the server refuses a submission that would not have arrived anyway. */
export const MAX_SUBMISSION_BYTES = 4_000_000
/** An empty canvas compresses to a few hundred bytes; any real signature is larger. */
const MIN_SIGNATURE_BYTES = 1_000
export const TOKEN = /^[A-Za-z0-9_-]{36,150}$/
export const CONDITIONS = ['good', 'damaged', 'partial'] as const

export interface DeliveryInput {
  /** The customer and one of their VALIDATED quotations: a delivery note is made for goods under that quotation. Both required. */
  customerId: number | null; quotationId: number | null
  /** The SHIPPER (pengirim) who hands the cargo over, and the CONSIGNEE (penerima) who receives it. Neither is assumed to be the customer or VORA: they are written for each shipment. */
  shipperName: string; shipperAddress: string; shipperContact: string; shipperPhone: string; shipperEmail: string
  consigneeName: string; consigneeAddress: string; consigneeContact: string; consigneePhone: string; consigneeEmail: string
  origin: string; destination: string; shipmentReference: string; poNumber: string; carrier: string; vehicle: string; vehiclePlate: string
  driverName: string; driverPhone: string; deliveryDate: string; notes: string
  /** The cargo table: what physically travels (not the commercial charges of the quotation). */
  items: ItemInput[]
}

/** A text field: trimmed, and refused (never cut short) when it is too long. */
function field(value: string, max: number, label: string, required = false): string {
  const v = String(value ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim()
  if (required && !v) throw new ActionError(`${label} is required`)
  if (v.length > max) throw new ActionError(`${label} is too long: ${v.length} characters, at most ${max}`)
  return v
}
const oneLine = (value: string, max: number, label: string, required = false) => field(value, max, label, required).replace(/\s*\n\s*/g, ' ')

export interface ItemInput { description: string; quantity: string; unit: string; remarks: string }

/** Rows of the cargo table. A row left completely empty is ignored; a row with something in it needs a description and a quantity. */
export function cargoRows(rows: ItemInput[]): ItemInput[] {
  const out: ItemInput[] = []
  for (const [i, r] of rows.entries()) {
    const description = String(r.description ?? '').replace(/\u0000/g, '').trim(), quantity = String(r.quantity ?? '').trim()
    const unit = String(r.unit ?? '').trim(), remarks = String(r.remarks ?? '').replace(/\u0000/g, '').trim()
    if (!description && !quantity && !unit && !remarks) continue
    const n = `Item ${i + 1}`
    if (!description) throw new ActionError(`${n}: write the description of the cargo`)
    if (!quantity) throw new ActionError(`${n}: write the quantity`)
    if (description.length > 500) throw new ActionError(`${n}: the description is too long (at most 500 characters)`)
    if (quantity.length > 40) throw new ActionError(`${n}: the quantity is too long (at most 40 characters)`)
    if (unit.length > 30) throw new ActionError(`${n}: the unit is too long (at most 30 characters)`)
    if (remarks.length > 240) throw new ActionError(`${n}: the remarks are too long (at most 240 characters)`)
    out.push({ description, quantity, unit: unit || 'pcs', remarks })
  }
  if (!out.length) throw new ActionError('Add at least one item of cargo')
  if (out.length > MAX_ITEMS) throw new ActionError(`A delivery note holds at most ${MAX_ITEMS} items`)
  return out
}

async function prepare(input: DeliveryInput, fixed?: { customerId: number; quotationId: number | null }): Promise<Record<string, unknown>> {
  const customerId = fixed?.customerId ?? input.customerId
  if (!customerId) throw new ActionError('Select the customer')
  const c = await one('customers', (q) => q.eq('id', customerId), 'id')
  if (!c) throw new ActionError('Select an existing customer')
  const customer = { id: c.id as number }
  const quotationId = fixed ? fixed.quotationId : input.quotationId
  if (!fixed && !quotationId) throw new ActionError('Select one of the customer\'s validated quotations')
  const party = (who: 'Shipper' | 'Consignee', v: { name: string; address: string; contact: string; phone: string; email: string }) => {
    const name = oneLine(v.name, 240, `${who} name`, true)
    const address = field(v.address, 1000, `${who} address`, true)
    let email = oneLine(v.email, 200, `${who} email`)
    if (email) { try { email = emailAddress(email) } catch { throw new ActionError(`${who} email is not a valid address`) } }
    const phone = oneLine(v.phone, 60, `${who} phone`)
    if (phone && !/^[0-9+()\-\s.]{6,60}$/.test(phone)) throw new ActionError(`${who} phone may hold only digits, spaces, + ( ) - and .`)
    return { name, address, contact: oneLine(v.contact, 160, `${who} contact person`), phone, email }
  }
  const shipper = party('Shipper', { name: input.shipperName, address: input.shipperAddress, contact: input.shipperContact, phone: input.shipperPhone, email: input.shipperEmail })
  const consignee = party('Consignee', { name: input.consigneeName, address: input.consigneeAddress, contact: input.consigneeContact, phone: input.consigneePhone, email: input.consigneeEmail })
  const date = input.deliveryDate.trim() || today()
  if (!isIsoDay(date)) throw new ActionError('The delivery date must be a valid date (YYYY-MM-DD)')
  return {
    customer_id: customer.id, quotation_id: quotationId,
    shipper_name: shipper.name, shipper_address: shipper.address, shipper_contact: shipper.contact, shipper_phone: shipper.phone, shipper_email: shipper.email,
    consignee_name: consignee.name, consignee_address: consignee.address, consignee_contact: consignee.contact, consignee_phone: consignee.phone, consignee_email: consignee.email,
    origin: oneLine(input.origin, 240, 'Origin'), destination: oneLine(input.destination, 240, 'Destination'), shipment_reference: oneLine(input.shipmentReference, 120, 'Shipment reference'),
    po_number: oneLine(input.poNumber, 100, 'PO number'), carrier: oneLine(input.carrier, 160, 'Carrier'), vehicle: oneLine(input.vehicle, 120, 'Vehicle'),
    vehicle_plate: oneLine(input.vehiclePlate, 30, 'Vehicle plate'), driver_name: oneLine(input.driverName, 160, 'Driver'), driver_phone: oneLine(input.driverPhone, 60, 'Driver phone'),
    delivery_date: date, notes: field(input.notes, 2000, 'Notes'),
    items: cargoRows(input.items),
  }
}

const newToken = () => randomBytes(36).toString('base64url')

export async function createDelivery(actorId: number, input: DeliveryInput): Promise<number> {
  const p = await prepare(input)
  return rpc<number>('delivery_create', { p_actor: actorId, p: { ...p, capture_token: newToken(), view_token: newToken() } })
}

/** Only a draft can be edited: once issued, the note is on its way with a printed QR code. */
export async function updateDelivery(actorId: number, id: number, input: DeliveryInput): Promise<void> {
  const d = await one('deliveries', (q) => q.eq('id', id), 'customer_id,quotation_id')
  if (!d) throw new ActionError('Delivery note not found', 404)
  await rpc('delivery_update', { p_actor: actorId, p_id: id, p: await prepare(input, { customerId: d.customerId as number, quotationId: d.quotationId as number | null }) })
}

/** issue: draft -> issued (its QR code starts to work). void: a draft or issued note (its QR code stops). A received one needs its POD rejected first. */
export async function setDeliveryStatus(actorId: number, id: number, action: string): Promise<void> {
  await rpc('delivery_set_status', { p_actor: actorId, p_id: id, p_action: action })
  if (action === 'void') await (await import('../trust/revocation')).recordVoided(actorId, 'delivery', id)
}

/** The recorded POD was wrong (wrong person, wrong goods): it stays as history and the same QR code can be used again. */
export async function rejectProof(actorId: number, id: number, reason: string): Promise<void> {
  const why = oneLine(reason, 500, 'The reason', true)
  if (why.length < 5) throw new ActionError('Give a reason of at least 5 characters')
  const live = await one('delivery_proofs', (q) => q.eq('delivery_id', id).eq('status', 'submitted'), 'id')
  await rpc('delivery_reject_proof', { p_actor: actorId, p_id: id, p_reason: why })
  // A rejected proof no longer verifies: its record is revoked (a new proof gets a new one). A proof that never had a record has nothing to revoke.
  if (live) await rpc('trust_revoke', { p_actor: actorId, p_kind: 'pod', p_document: live.id as number, p_reason: `Proof of delivery rejected: ${why}`.slice(0, 300) }).catch((e: Error & { status?: number }) => { if (e.status !== 404) throw e })
}

// ------------------------------------------------------------------ the proof of delivery

export interface ProofInput {
  token: string
  /** Who delivered: the driver or courier whose phone sent this. */
  courierName: string; courierPhone: string
  /** Who received, and signed on the driver's phone. */
  receiverName: string; receiverPosition: string; receiverPhone: string; receiverEmail: string; receiverIdNumber: string
  condition: string; conditionNote: string
  /** `data:image/png;base64,...` drawn on the screen. */
  signature: string
  /** `data:image/jpeg;base64,...`, already reduced in size on the phone. */
  photos: string[]
  latitude: string; longitude: string; accuracy: string; locationStatus: string; locationNote: string
  /** What the phone's clock said when the form was sent. */
  deviceTime: string
  ip: string; userAgent: string
}

type ImageKind = 'png' | 'jpeg'
const SIGNATURES: Record<ImageKind, number[]> = { png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], jpeg: [0xff, 0xd8, 0xff] }

/** Decodes an image data URL and proves it is that kind of image: the right bytes, the right size, and a file an image reader accepts. */
async function decodeImage(dataUrl: string, kind: ImageKind, maxBytes: number, label: string): Promise<Uint8Array> {
  const m = new RegExp(`^data:image/${kind};base64,([A-Za-z0-9+/]+={0,2})$`).exec(String(dataUrl ?? ''))
  if (!m) throw new ActionError(`${label} is not a valid ${kind === 'png' ? 'drawing' : 'photo'}`)
  const bytes = new Uint8Array(Buffer.from(m[1], 'base64'))
  if (bytes.length > maxBytes) throw new ActionError(`${label} is too large (at most ${Math.floor(maxBytes / 1000)} KB): take it again`)
  if (!SIGNATURES[kind].every((b, i) => bytes[i] === b)) throw new ActionError(`${label} is not a valid ${kind === 'png' ? 'drawing' : 'photo'}`)
  try {
    const doc = await PDFDocument.create()
    if (kind === 'png') await doc.embedPng(bytes)
    else await doc.embedJpg(bytes)
  } catch {
    throw new ActionError(`${label} is damaged: take it again`)
  }
  return bytes
}

function coordinate(value: string, min: number, max: number, label: string): number {
  const n = Number(String(value ?? '').trim())
  if (!String(value ?? '').trim() || !Number.isFinite(n) || n < min || n > max) throw new ActionError(`${label} is not a valid location`)
  return n
}

export interface Received { number: string; consignee: string; receiver: string; courier: string; at: Date }

/**
 * The receiver's submission. The delivery must exist and be open for receipt (a cheap check, before any image is decoded); the evidence
 * files are stored; one database function then records the proof, its files and the delivery's new state together or not at all. If it
 * refuses (two phones at once, a note voided meanwhile), the files stored for this attempt are removed.
 */
export async function submitProof(input: ProofInput, baseUrl: string): Promise<Received> {
  if (!TOKEN.test(input.token)) throw new ActionError('This delivery link is not valid', 404)
  const open = await one('deliveries', (q) => q.eq('capture_token', input.token), 'id,status')
  if (!open) throw new ActionError('This delivery link is not valid', 404)
  if (open.status === 'delivered') throw new ActionError('The receipt of this delivery has already been recorded', 409)
  if (open.status === 'draft') throw new ActionError('This delivery note has not been issued yet', 409)
  if (open.status !== 'issued') throw new ActionError('This delivery note was cancelled', 409)

  const courierName = oneLine(input.courierName, 160, 'The driver\'s name', true)
  if (courierName.length < 2) throw new ActionError('Write the driver\'s full name')
  const courierPhone = oneLine(input.courierPhone, 60, 'The driver\'s phone number', true)
  if (!/^[0-9+()\-\s.]{6,60}$/.test(courierPhone)) throw new ActionError('The driver\'s phone number may hold only digits, spaces, + ( ) - and .')
  const name = oneLine(input.receiverName, 160, 'The receiver\'s name', true)
  const position = oneLine(input.receiverPosition, 160, 'The receiver\'s position', true)
  if (name.length < 2) throw new ActionError('Write the receiver\'s full name')
  const phone = oneLine(input.receiverPhone, 60, 'The receiver\'s phone number', true)
  if (!/^[0-9+()\-\s.]{6,60}$/.test(phone)) throw new ActionError('The phone number may hold only digits, spaces, + ( ) - and .')
  let email = oneLine(input.receiverEmail, 200, 'The receiver\'s email')
  if (email) { try { email = emailAddress(email) } catch { throw new ActionError('The receiver\'s email is not a valid address') } }
  const idNumber = oneLine(input.receiverIdNumber, 40, 'The ID number')
  const condition = (CONDITIONS as readonly string[]).includes(input.condition) ? input.condition : ''
  if (!condition) throw new ActionError('Say in what condition the goods were received')
  const conditionNote = field(input.conditionNote, 1000, 'The note on the condition of the goods')
  if (condition !== 'good' && conditionNote.length < 5) throw new ActionError('Describe what is damaged or missing')

  const signature = await decodeImage(input.signature, 'png', MAX_SIGNATURE_BYTES, 'The signature')
  if (signature.length < MIN_SIGNATURE_BYTES) throw new ActionError('Sign in the box before sending')
  if (!input.photos.length) throw new ActionError('Take at least one photo of the goods')
  if (input.photos.length > MAX_PHOTOS) throw new ActionError(`Send at most ${MAX_PHOTOS} photos`)
  const photos: Uint8Array[] = []
  for (const [i, p] of input.photos.entries()) photos.push(await decodeImage(p, 'jpeg', MAX_PHOTO_BYTES, `Photo ${i + 1}`))

  // The location is required: it proves where the goods were handed over. A phone with location switched off cannot send the proof.
  if (input.locationStatus !== 'captured') throw new ActionError('Turn on the location of your phone: the delivery cannot be recorded without it')
  const latitude = coordinate(input.latitude, -90, 90, 'The latitude')
  const longitude = coordinate(input.longitude, -180, 180, 'The longitude')
  const accuracy = String(input.accuracy ?? '').trim() ? coordinate(input.accuracy, 0, 1_000_000, 'The accuracy') : null
  const locationNote = oneLine(input.locationNote, 240, 'The note on the location')
  const when = new Date(input.deviceTime)
  const deviceTime = Number.isNaN(when.getTime()) ? '' : when.toISOString()

  const base = `pod/${open.id}/${randomBytes(12).toString('base64url')}`
  const stored: string[] = []
  const store = async (key: string, bytes: Uint8Array, type: string) => { await putObject('documents', key, bytes, type); stored.push(key) }
  let result: { proof_id: number; server_time: string; delivery_id: number; number: string; consignee_name: string; consignee_email: string; view_token: string }
  try {
    const signatureKey = `${base}-signature.png`
    await store(signatureKey, signature, 'image/png')
    const photoRefs: Array<{ key: string; sha256: string }> = []
    for (const [i, bytes] of photos.entries()) {
      const key = `${base}-photo-${i + 1}.jpg`
      await store(key, bytes, 'image/jpeg')
      photoRefs.push({ key, sha256: await sha256Hex(bytes) })
    }
    result = await rpc('delivery_submit_proof', {
      p: {
        token: input.token, receiver_name: name, receiver_position: position, receiver_phone: phone, receiver_email: email, receiver_id_number: idNumber, courier_name: courierName, courier_phone: courierPhone,
        condition, condition_note: conditionNote, signature_key: signatureKey, signature_sha256: await sha256Hex(signature), photos: photoRefs,
        location_status: 'captured', latitude, longitude, accuracy_m: accuracy, location_note: locationNote,
        device_time: deviceTime, ip: input.ip.slice(0, 64), user_agent: input.userAgent.slice(0, 300),
      },
    })
  } catch (e) {
    await Promise.all(stored.map((key) => removeObject('documents', key)))
    throw e
  }

  const at = new Date(result.server_time)
  const context = { delivery_number: result.number, consignee_name: result.consignee_name, receiver_name: name, received_at: `${businessDateTime(at)} WIB` }
  if (result.consignee_email) {
    await bestEffort('delivery_received_customer', () => enqueue('delivery_received_customer', result.consignee_email, { ...context, pod_url: `${baseUrl}/pod/view/${result.view_token}` }, { dedupeKey: `delivery-received-customer-${result.proof_id}`, verify: [{ kind: 'pod', id: result.proof_id }] }))
  }
  await bestEffort('delivery_received_admin', async () => {
    const conf = await getMailConfig()
    if (conf?.enabled) await enqueue('delivery_received_admin', (conf.adminEmail as string | null) || 'info@voraworld.id', { ...context, admin_url: `${baseUrl}/admin/deliveries/${result.delivery_id}` }, { dedupeKey: `delivery-received-admin-${result.proof_id}` })
  })
  return { number: result.number, consignee: result.consignee_name, receiver: name, courier: courierName, at }
}

/** Re-sends the "your goods were received" email to the consignee (for example after the email address was corrected). */
export async function resendReceivedEmail(actorId: number, id: number, baseUrl: string): Promise<void> {
  const d = await one('deliveries', (q) => q.eq('id', id), 'id,number,consignee_name,consignee_email,view_token')
  const proof = d ? await one('delivery_proofs', (q) => q.eq('delivery_id', id).eq('status', 'submitted'), 'id,receiver_name,server_time') : undefined
  if (!d || !proof) throw new ActionError('This delivery has no recorded proof of delivery', 409)
  if (!d.consigneeEmail) throw new ActionError('The delivery note has no consignee email')
  const conf = await getMailConfig()
  const rule = await one('email_rules', (q) => q.eq('key', 'delivery_received_customer'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the delivery_received_customer email rule first', 409)
  const queued = await enqueue('delivery_received_customer', d.consigneeEmail as string, {
    delivery_number: d.number, consignee_name: d.consigneeName, receiver_name: proof.receiverName, received_at: `${businessDateTime(proof.serverTime as Date)} WIB`, pod_url: `${baseUrl}/pod/view/${d.viewToken}`,
  }, { dedupeKey: `delivery-resend-${proof.id}-${Math.floor(Date.now() / 60_000)}`, verify: [{ kind: 'pod', id: proof.id as number }] })
  if (!queued) throw new ActionError('Email delivery is disabled', 409)
  await recordAudit(actorId, 'resend-received-email', 'delivery', id, d.number as string)
}

// ------------------------------------------------------------------ reading

/** A stored evidence file, re-hashed on every read: a swapped or damaged file is refused, never shown. */
export async function readEvidence(key: string, sha256: string): Promise<Uint8Array> {
  const bytes = await getObject('documents', key, 2_000_000)
  if ((await sha256Hex(bytes)) !== sha256) throw new ActionError('The stored evidence failed its integrity check', 409)
  return bytes
}

export interface DeliveryView {
  id: number; number: string; status: string; customerId: number | null; quotationId: number | null
  /** Empty on a note written before shippers were recorded: nothing is invented for it. */
  shipperName: string; shipperAddress: string; shipperContact: string; shipperPhone: string; shipperEmail: string
  consigneeName: string; consigneeAddress: string; consigneeContact: string; consigneePhone: string; consigneeEmail: string
  origin: string; destination: string; shipmentReference: string; poNumber: string; carrier: string; vehicle: string; vehiclePlate: string; driverName: string; driverPhone: string
  deliveryDate: string; notes: string; captureToken: string; viewToken: string; createdAt: Date; issuedAt: Date | null; deliveredAt: Date | null
  items: ItemInput[]
}
export interface ProofView {
  id: number; status: string; receiverName: string; receiverPosition: string; receiverPhone: string; receiverEmail: string; receiverIdNumber: string; courierName: string; courierPhone: string
  condition: string; conditionNote: string; signatureKey: string; signatureSha256: string
  latitude: number | null; longitude: number | null; accuracyM: number | null; locationStatus: string; locationNote: string
  deviceTime: string; serverTime: Date; ip: string; userAgent: string; rejectedAt: Date | null; rejectReason: string
  photos: Array<{ position: number; key: string; sha256: string }>
}

export async function deliveryBy(column: 'id' | 'capture_token' | 'view_token', value: number | string): Promise<DeliveryView | null> {
  const d = await one('deliveries', (q) => q.eq(column, value))
  if (!d) return null
  const items = await many('delivery_items', (q) => q.eq('delivery_id', d.id as number).order('position').order('id'), 'description,quantity,unit,remarks')
  const raw = d as unknown as Omit<DeliveryView, 'items'>
  return { ...raw, shipperName: raw.shipperName ?? '', shipperAddress: raw.shipperAddress ?? '', shipperContact: raw.shipperContact ?? '', shipperPhone: raw.shipperPhone ?? '', shipperEmail: raw.shipperEmail ?? '', items: items.map((i) => ({ description: i.description as string, quantity: i.quantity as string, unit: i.unit as string, remarks: i.remarks as string })) }
}

/** The proofs of a delivery, newest first: the live one (if any) and the rejected ones. */
export async function proofsOf(deliveryId: number): Promise<ProofView[]> {
  const rows = await many('delivery_proofs', (q) => q.eq('delivery_id', deliveryId).order('id', { ascending: false }))
  if (!rows.length) return []
  const photos = await many('delivery_proof_photos', (q) => q.in('proof_id', rows.map((r) => r.id as number)).order('position').order('id'), 'proof_id,position,storage_key,sha256')
  return rows.map((r) => ({
    id: r.id as number, status: r.status as string, receiverName: r.receiverName as string, receiverPosition: r.receiverPosition as string, receiverPhone: r.receiverPhone as string,
    receiverEmail: r.receiverEmail as string, receiverIdNumber: r.receiverIdNumber as string, courierName: r.courierName as string, courierPhone: r.courierPhone as string, condition: r.receivedCondition as string, conditionNote: r.conditionNote as string,
    signatureKey: r.signatureKey as string, signatureSha256: r.signatureSha256 as string, latitude: r.latitude as number | null, longitude: r.longitude as number | null,
    accuracyM: r.accuracyM as number | null, locationStatus: r.locationStatus as string, locationNote: r.locationNote as string, deviceTime: r.deviceTime as string,
    serverTime: r.serverTime as Date, ip: r.ip as string, userAgent: r.userAgent as string, rejectedAt: r.rejectedAt as Date | null, rejectReason: r.rejectReason as string,
    photos: photos.filter((p) => p.proofId === r.id).map((p) => ({ position: p.position as number, key: p.storageKey as string, sha256: p.sha256 as string })),
  }))
}

/** One piece of evidence of a proof (`signature` or `photo-N`), checked against its stored hash. Null when the proof has no such piece. */
export async function proofEvidence(proof: ProofView, file: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (file === 'signature') return { bytes: await readEvidence(proof.signatureKey, proof.signatureSha256), type: 'image/png' }
  const m = /^photo-([1-9])$/.exec(file)
  const photo = m ? proof.photos[Number(m[1]) - 1] : undefined
  return photo ? { bytes: await readEvidence(photo.key, photo.sha256), type: 'image/jpeg' } : null
}
