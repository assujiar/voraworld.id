import { randomBytes } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { tx, type Db } from '../db'
import { recordAudit } from '../audit'
import { sha256Hex } from '../crypto'
import { businessDateTime, isIsoDay, today } from '../dates'
import { ActionError } from '../errors'
import { bestEffort } from '../finance/notify'
import { getMailConfig } from '../mail/config'
import { emailAddress } from '../mail/address'
import { enqueue } from '../mail/outbox'
import { ensureCompanyCode, ensurePublicCode, nextNumber } from '../numbering'
import { getObject, putObject } from '../storage'

/**
 * Delivery notes (surat jalan) and their proof of delivery (POD).
 *
 * VORA writes and issues a delivery note; it travels with the goods and carries a QR code. Whoever receives the goods scans it and, on
 * their own phone, signs on the screen, photographs the goods, gives their details; the phone's position and time are recorded. That
 * is the POD: it needs no account, only the unguessable address in the QR code, and it can be given ONCE (until Finance rejects it).
 * The consignee is emailed a second, different address with which the finished POD can be read.
 */
export const MAX_ITEMS = 100
export const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 1_200_000
const MAX_SIGNATURE_BYTES = 300_000
/** An empty canvas compresses to a few hundred bytes; any real signature is larger. */
const MIN_SIGNATURE_BYTES = 1_000
export const TOKEN = /^[A-Za-z0-9_-]{36,150}$/
export const CONDITIONS = ['good', 'damaged', 'partial'] as const

export interface DeliveryInput {
  customerId: number | null; consigneeName: string; consigneeAddress: string; consigneeContact: string; consigneePhone: string; consigneeEmail: string
  origin: string; destination: string; shipmentReference: string; poNumber: string; carrier: string; vehicle: string; vehiclePlate: string
  driverName: string; driverPhone: string; deliveryDate: string; notes: string; items: string
}

/** A text field: trimmed, and refused (never cut short) when it is too long. */
function field(value: string, max: number, label: string, required = false): string {
  const v = String(value ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim()
  if (required && !v) throw new ActionError(`${label} is required`)
  if (v.length > max) throw new ActionError(`${label} is too long: ${v.length} characters, at most ${max}`)
  return v
}
const oneLine = (value: string, max: number, label: string, required = false) => field(value, max, label, required).replace(/\s*\n\s*/g, ' ')

/** `description | quantity | unit | remarks`, one item per line; unit and remarks are optional. */
export function parseItems(raw: string): Array<{ description: string; quantity: string; unit: string; remarks: string }> {
  const rows = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!rows.length) throw new ActionError('Add at least one item: description | quantity | unit | remarks')
  if (rows.length > MAX_ITEMS) throw new ActionError(`A delivery note holds at most ${MAX_ITEMS} items`)
  return rows.map((row, i) => {
    const [description = '', quantity = '', unit = '', ...rest] = row.split('|').map((p) => p.trim())
    const n = `Item ${i + 1}`
    if (!description || !quantity) throw new ActionError(`${n}: write it as description | quantity | unit | remarks`)
    if (description.length > 500) throw new ActionError(`${n}: the description is too long (at most 500 characters)`)
    if (quantity.length > 40) throw new ActionError(`${n}: the quantity is too long (at most 40 characters)`)
    if (unit.length > 30) throw new ActionError(`${n}: the unit is too long (at most 30 characters)`)
    const remarks = rest.join(' | ').trim()
    if (remarks.length > 240) throw new ActionError(`${n}: the remarks are too long (at most 240 characters)`)
    return { description, quantity, unit: unit || 'pcs', remarks }
  })
}

interface Prepared { customerId: number | null; values: Record<string, string | number | null>; items: ReturnType<typeof parseItems> }

async function prepare(t: Db, input: DeliveryInput): Promise<Prepared> {
  let customer: { id: number; name: string; address: string; email: string } | undefined
  if (input.customerId) {
    const [c] = await t`select id, name, address, email from customers where id = ${input.customerId}`
    if (!c) throw new ActionError('Select an existing customer')
    customer = { id: c.id as number, name: c.name as string, address: String(c.address ?? ''), email: String(c.email ?? '') }
  }
  const name = oneLine(input.consigneeName || customer?.name || '', 240, 'Consignee name', true)
  let email = oneLine(input.consigneeEmail || customer?.email || '', 200, 'Consignee email')
  if (email) { try { email = emailAddress(email) } catch { throw new ActionError('Consignee email is not a valid address') } }
  const date = input.deliveryDate.trim() || today()
  if (!isIsoDay(date)) throw new ActionError('The delivery date must be a valid date (YYYY-MM-DD)')
  return {
    customerId: customer?.id ?? null,
    items: parseItems(input.items),
    values: {
      consignee_name: name, consignee_address: field(input.consigneeAddress || customer?.address || '', 1000, 'Consignee address'), consignee_contact: oneLine(input.consigneeContact, 160, 'Contact person'),
      consignee_phone: oneLine(input.consigneePhone, 60, 'Consignee phone'), consignee_email: email,
      origin: oneLine(input.origin, 240, 'Origin'), destination: oneLine(input.destination, 240, 'Destination'), shipment_reference: oneLine(input.shipmentReference, 120, 'Shipment reference'),
      po_number: oneLine(input.poNumber, 100, 'PO number'), carrier: oneLine(input.carrier, 160, 'Carrier'), vehicle: oneLine(input.vehicle, 120, 'Vehicle'),
      vehicle_plate: oneLine(input.vehiclePlate, 30, 'Vehicle plate'), driver_name: oneLine(input.driverName, 160, 'Driver'), driver_phone: oneLine(input.driverPhone, 60, 'Driver phone'),
      delivery_date: date, notes: field(input.notes, 2000, 'Notes'),
    },
  }
}

async function writeItems(t: Db, id: number, items: Prepared['items']): Promise<void> {
  await t`delete from delivery_items where delivery_id = ${id}`
  for (const [position, item] of items.entries()) {
    await t`insert into delivery_items (delivery_id, position, description, quantity, unit, remarks) values (${id}, ${position}, ${item.description}, ${item.quantity}, ${item.unit}, ${item.remarks})`
  }
}

const newToken = () => randomBytes(36).toString('base64url')

export async function createDelivery(actorId: number, input: DeliveryInput): Promise<number> {
  return tx(async (t) => {
    const p = await prepare(t, input)
    const owner = p.customerId ? await ensurePublicCode(t, 'customers', p.customerId) : await ensureCompanyCode(t)
    const number = await nextNumber(t, 'DLV', owner, p.values.delivery_date as string)
    const v = p.values
    const [row] = await t`insert into deliveries (number, status, customer_id, consignee_name, consignee_address, consignee_contact, consignee_phone, consignee_email, origin, destination,
        shipment_reference, po_number, carrier, vehicle, vehicle_plate, driver_name, driver_phone, delivery_date, notes, capture_token, view_token, created_by)
      values (${number}, 'draft', ${p.customerId}, ${v.consignee_name}, ${v.consignee_address}, ${v.consignee_contact}, ${v.consignee_phone}, ${v.consignee_email}, ${v.origin}, ${v.destination},
        ${v.shipment_reference}, ${v.po_number}, ${v.carrier}, ${v.vehicle}, ${v.vehicle_plate}, ${v.driver_name}, ${v.driver_phone}, ${v.delivery_date}, ${v.notes}, ${newToken()}, ${newToken()}, ${actorId}) returning id`
    const id = row.id as number
    await writeItems(t, id, p.items)
    await recordAudit(t, actorId, 'create', 'delivery', id, number)
    return id
  })
}

/** Only a draft can be edited: once issued, the note is on its way with a printed QR code. */
export async function updateDelivery(actorId: number, id: number, input: DeliveryInput): Promise<void> {
  await tx(async (t) => {
    const [d] = await t`select * from deliveries where id = ${id} for update`
    if (!d) throw new ActionError('Delivery note not found', 404)
    if (d.status !== 'draft') throw new ActionError('Only a draft can be edited: void this delivery note and write a new one', 409)
    const p = await prepare(t, input)
    const v = p.values
    await t`update deliveries set customer_id = ${p.customerId}, consignee_name = ${v.consignee_name}, consignee_address = ${v.consignee_address}, consignee_contact = ${v.consignee_contact},
      consignee_phone = ${v.consignee_phone}, consignee_email = ${v.consignee_email}, origin = ${v.origin}, destination = ${v.destination}, shipment_reference = ${v.shipment_reference},
      po_number = ${v.po_number}, carrier = ${v.carrier}, vehicle = ${v.vehicle}, vehicle_plate = ${v.vehicle_plate}, driver_name = ${v.driver_name}, driver_phone = ${v.driver_phone},
      delivery_date = ${v.delivery_date}, notes = ${v.notes}, updated_at = now() where id = ${id}`
    await writeItems(t, id, p.items)
    await recordAudit(t, actorId, 'update', 'delivery', id, d.number as string)
  })
}

/** issue: draft -> issued (its QR code starts to work). void: a draft or issued note (its QR code stops). A received one needs its POD rejected first. */
export async function setDeliveryStatus(actorId: number, id: number, action: string): Promise<void> {
  await tx(async (t) => {
    const [d] = await t`select * from deliveries where id = ${id} for update`
    if (!d) throw new ActionError('Delivery note not found', 404)
    if (action === 'issue' && d.status === 'draft') {
      await t`update deliveries set status = 'issued', issued_at = now(), updated_at = now() where id = ${id}`
    } else if (action === 'void' && ['draft', 'issued'].includes(d.status as string)) {
      await t`update deliveries set status = 'void', updated_at = now() where id = ${id}`
    } else if (action === 'void' && d.status === 'delivered') {
      throw new ActionError('The goods were received: reject the proof of delivery first if it was recorded by mistake', 409)
    } else {
      throw new ActionError('Invalid state change', 409)
    }
    await recordAudit(t, actorId, action, 'delivery', id, d.number as string)
  })
}

/** The recorded POD was wrong (wrong person, wrong goods): it stays as history and the same QR code can be used again. */
export async function rejectProof(actorId: number, id: number, reason: string): Promise<void> {
  const why = oneLine(reason, 500, 'The reason', true)
  if (why.length < 5) throw new ActionError('Give a reason of at least 5 characters')
  await tx(async (t) => {
    const [d] = await t`select * from deliveries where id = ${id} for update`
    if (!d) throw new ActionError('Delivery note not found', 404)
    if (d.status !== 'delivered') throw new ActionError('This delivery has no recorded proof of delivery', 409)
    await t`update delivery_proofs set status = 'rejected', rejected_at = now(), rejected_by = ${actorId}, reject_reason = ${why} where delivery_id = ${id} and status = 'submitted'`
    await t`update deliveries set status = 'issued', delivered_at = null, updated_at = now() where id = ${id}`
    await recordAudit(t, actorId, 'reject-proof', 'delivery', id, `${d.number}: ${why}`)
  })
}

// ------------------------------------------------------------------ the proof of delivery

export interface ProofInput {
  token: string
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

export interface Received { number: string; consignee: string; receiver: string; at: Date }

/** The receiver's submission. One transaction: the proof, its files and the delivery's new state go together or not at all. */
export async function submitProof(input: ProofInput, baseUrl: string): Promise<Received> {
  if (!TOKEN.test(input.token)) throw new ActionError('This delivery link is not valid', 404)
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

  const located = input.locationStatus === 'captured'
  if (!located && input.locationStatus !== 'unavailable') throw new ActionError('The location was not recorded: allow location access, or say why it is not available')
  const latitude = located ? coordinate(input.latitude, -90, 90, 'The latitude') : null
  const longitude = located ? coordinate(input.longitude, -180, 180, 'The longitude') : null
  const accuracy = located && String(input.accuracy ?? '').trim() ? coordinate(input.accuracy, 0, 1_000_000, 'The accuracy') : null
  const locationNote = oneLine(input.locationNote, 240, 'The note on the location')
  if (!located && locationNote.length < 5) throw new ActionError('Say why the location is not available (at least 5 characters)')
  const when = new Date(input.deviceTime)
  const deviceTime = Number.isNaN(when.getTime()) ? '' : when.toISOString()

  return tx(async (t) => {
    const [d] = await t`select * from deliveries where capture_token = ${input.token} for update`
    if (!d) throw new ActionError('This delivery link is not valid', 404)
    if (d.status === 'delivered') throw new ActionError('The receipt of this delivery has already been recorded', 409)
    if (d.status === 'draft') throw new ActionError('This delivery note has not been issued yet', 409)
    if (d.status !== 'issued') throw new ActionError('This delivery note was cancelled', 409)

    const base = `pod/${d.id}/${randomBytes(12).toString('base64url')}`
    const signatureKey = `${base}-signature.png`
    const [proof] = await t`insert into delivery_proofs (delivery_id, status, receiver_name, receiver_position, receiver_phone, receiver_email, receiver_id_number, received_condition, condition_note,
        signature_key, signature_sha256, latitude, longitude, accuracy_m, location_status, location_note, device_time, ip, user_agent)
      values (${d.id as number}, 'submitted', ${name}, ${position}, ${phone}, ${email}, ${idNumber}, ${condition}, ${conditionNote}, ${signatureKey}, ${await sha256Hex(signature)},
        ${latitude}, ${longitude}, ${accuracy}, ${located ? 'captured' : 'unavailable'}, ${locationNote}, ${deviceTime}, ${input.ip.slice(0, 64)}, ${input.userAgent.slice(0, 300)}) returning id, server_time`
    await putObject('documents', signatureKey, signature, 'image/png')
    for (const [position0, bytes] of photos.entries()) {
      const key = `${base}-photo-${position0 + 1}.jpg`
      await putObject('documents', key, bytes, 'image/jpeg')
      await t`insert into delivery_proof_photos (proof_id, position, storage_key, sha256) values (${proof.id as number}, ${position0}, ${key}, ${await sha256Hex(bytes)})`
    }
    await t`update deliveries set status = 'delivered', delivered_at = ${proof.serverTime as Date}, updated_at = now() where id = ${d.id as number}`
    await recordAudit(t, null, 'receive', 'delivery', d.id as number, `${d.number}: received by ${name}`)

    const receivedAt = `${businessDateTime(proof.serverTime as Date)} WIB`
    const context = { delivery_number: d.number, consignee_name: d.consigneeName, receiver_name: name, received_at: receivedAt }
    if (d.consigneeEmail) {
      await bestEffort(t, 'delivery_received_customer', (s) => enqueue(s, 'delivery_received_customer', d.consigneeEmail as string, { ...context, pod_url: `${baseUrl}/pod/view/${d.viewToken}` }, { dedupeKey: `delivery-received-customer-${proof.id}` }))
    }
    await bestEffort(t, 'delivery_received_admin', async (s) => {
      const conf = await getMailConfig(s)
      if (conf?.enabled) await enqueue(s, 'delivery_received_admin', conf.adminEmail ?? 'info@voraworld.id', { ...context, admin_url: `${baseUrl}/admin/deliveries/${d.id}` }, { dedupeKey: `delivery-received-admin-${proof.id}` })
    })
    return { number: d.number as string, consignee: d.consigneeName as string, receiver: name, at: proof.serverTime as Date }
  })
}

/** Re-sends the "your goods were received" email to the consignee (for example after the email address was corrected). */
export async function resendReceivedEmail(actorId: number, id: number, baseUrl: string): Promise<void> {
  await tx(async (t) => {
    const [d] = await t`select d.*, p.receiver_name, p.server_time, p.id as proof_id from deliveries d join delivery_proofs p on p.delivery_id = d.id and p.status = 'submitted' where d.id = ${id}`
    if (!d) throw new ActionError('This delivery has no recorded proof of delivery', 409)
    if (!d.consigneeEmail) throw new ActionError('The delivery note has no consignee email')
    const conf = await getMailConfig(t)
    const [rule] = await t`select enabled from email_rules where key = 'delivery_received_customer'`
    if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the delivery_received_customer email rule first', 409)
    const queued = await enqueue(t, 'delivery_received_customer', d.consigneeEmail as string, {
      delivery_number: d.number, consignee_name: d.consigneeName, receiver_name: d.receiverName, received_at: `${businessDateTime(d.serverTime as Date)} WIB`, pod_url: `${baseUrl}/pod/view/${d.viewToken}`,
    }, { dedupeKey: `delivery-resend-${d.proofId}-${Math.floor(Date.now() / 60_000)}` })
    if (!queued) throw new ActionError('Email delivery is disabled', 409)
    await recordAudit(t, actorId, 'resend-received-email', 'delivery', id, d.number as string)
  })
}

// ------------------------------------------------------------------ reading

/** A stored evidence file, re-hashed on every read: a swapped or damaged file is refused, never shown. */
export async function readEvidence(key: string, sha256: string): Promise<Uint8Array> {
  const bytes = await getObject('documents', key, 2_000_000)
  if ((await sha256Hex(bytes)) !== sha256) throw new ActionError('The stored evidence failed its integrity check', 409)
  return bytes
}

export interface DeliveryView {
  id: number; number: string; status: string; customerId: number | null
  consigneeName: string; consigneeAddress: string; consigneeContact: string; consigneePhone: string; consigneeEmail: string
  origin: string; destination: string; shipmentReference: string; poNumber: string; carrier: string; vehicle: string; vehiclePlate: string; driverName: string; driverPhone: string
  deliveryDate: string; notes: string; captureToken: string; viewToken: string; createdAt: Date; issuedAt: Date | null; deliveredAt: Date | null
  items: Array<{ description: string; quantity: string; unit: string; remarks: string }>
}
export interface ProofView {
  id: number; status: string; receiverName: string; receiverPosition: string; receiverPhone: string; receiverEmail: string; receiverIdNumber: string
  condition: string; conditionNote: string; signatureKey: string; signatureSha256: string
  latitude: number | null; longitude: number | null; accuracyM: number | null; locationStatus: string; locationNote: string
  deviceTime: string; serverTime: Date; ip: string; userAgent: string; rejectedAt: Date | null; rejectReason: string
  photos: Array<{ position: number; key: string; sha256: string }>
}

export async function deliveryBy(db: Db, column: 'id' | 'capture_token' | 'view_token', value: number | string): Promise<DeliveryView | null> {
  const [d] = column === 'id' ? await db`select * from deliveries where id = ${value}`
    : column === 'capture_token' ? await db`select * from deliveries where capture_token = ${String(value)}`
      : await db`select * from deliveries where view_token = ${String(value)}`
  if (!d) return null
  const items = await db`select description, quantity, unit, remarks from delivery_items where delivery_id = ${d.id as number} order by position, id`
  return { ...(d as unknown as Omit<DeliveryView, 'items'>), items: items.map((i) => ({ description: i.description as string, quantity: i.quantity as string, unit: i.unit as string, remarks: i.remarks as string })) }
}

/** The proofs of a delivery, newest first: the live one (if any) and the rejected ones. */
export async function proofsOf(db: Db, deliveryId: number): Promise<ProofView[]> {
  const rows = await db`select * from delivery_proofs where delivery_id = ${deliveryId} order by id desc`
  const out: ProofView[] = []
  for (const r of rows) {
    const photos = await db`select position, storage_key, sha256 from delivery_proof_photos where proof_id = ${r.id as number} order by position`
    out.push({
      id: r.id as number, status: r.status as string, receiverName: r.receiverName as string, receiverPosition: r.receiverPosition as string, receiverPhone: r.receiverPhone as string,
      receiverEmail: r.receiverEmail as string, receiverIdNumber: r.receiverIdNumber as string, condition: r.receivedCondition as string, conditionNote: r.conditionNote as string,
      signatureKey: r.signatureKey as string, signatureSha256: r.signatureSha256 as string, latitude: r.latitude as number | null, longitude: r.longitude as number | null,
      accuracyM: r.accuracyM as number | null, locationStatus: r.locationStatus as string, locationNote: r.locationNote as string, deviceTime: r.deviceTime as string,
      serverTime: r.serverTime as Date, ip: r.ip as string, userAgent: r.userAgent as string, rejectedAt: r.rejectedAt as Date | null, rejectReason: r.rejectReason as string,
      photos: photos.map((p) => ({ position: p.position as number, key: p.storageKey as string, sha256: p.sha256 as string })),
    })
  }
  return out
}
