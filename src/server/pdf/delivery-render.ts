import { businessDateTime } from '../dates'
import { deliveryBy, proofEvidence, proofsOf, type DeliveryView } from '../delivery/deliveries'
import { ActionError } from '../errors'
import { one, rpc } from '../data'
import { settingMap } from '../settings'
import { renderDeliveryNote, renderPod } from './delivery'
import { trustedPdf } from '../trust/serve'
import type { DeliveryNoteData, Issuer } from './types'

async function issuerOf(): Promise<Issuer> {
  const s = await settingMap()
  return { legalName: s.legal_name || 'PT Satu Arah International', address: s.address || '', email: s.email || 'info@voraworld.id', taxId: (s.tax_id || '').trim() }
}

/** The names of the customer and quotation a note was made under, for its reference line. */
async function references(d: DeliveryView): Promise<{ customerName: string; quotationNumber: string }> {
  const customer = d.customerId ? await one('customers', (q) => q.eq('id', d.customerId!), 'name') : undefined
  const quotation = d.quotationId ? await one('quotations', (q) => q.eq('id', d.quotationId!), 'number') : undefined
  return { customerName: String(customer?.name ?? ''), quotationNumber: String(quotation?.number ?? '') }
}

/** The verification address of a delivery note or its proof of delivery. Created on first use, because deliveries were never given one before. */
async function verifyUrlOf(kind: 'delivery' | 'pod', id: number, baseUrl: string): Promise<string> {
  return `${baseUrl.replace(/\/+$/, '')}/verify/${await rpc<string>('trust_ensure_verification', { p_kind: kind, p_document: id })}`
}

const noteData = (d: DeliveryView, captureUrl: string, verifyUrl: string, ref: { customerName: string; quotationNumber: string }): DeliveryNoteData => ({
  number: d.number, status: d.status, deliveryDate: d.deliveryDate, customerName: ref.customerName, quotationNumber: ref.quotationNumber,
  shipperName: d.shipperName, shipperAddress: d.shipperAddress, shipperContact: d.shipperContact, shipperPhone: d.shipperPhone, shipperEmail: d.shipperEmail,
  consigneeName: d.consigneeName, consigneeAddress: d.consigneeAddress, consigneeContact: d.consigneeContact, consigneePhone: d.consigneePhone, consigneeEmail: d.consigneeEmail,
  origin: d.origin, destination: d.destination, shipmentReference: d.shipmentReference, poNumber: d.poNumber, carrier: d.carrier, vehicle: d.vehicle, vehiclePlate: d.vehiclePlate,
  driverName: d.driverName, driverPhone: d.driverPhone, notes: d.notes, items: d.items, captureUrl, verifyUrl,
})

/** The delivery note as a PDF. Its QR code opens the page where the receiver signs; a draft or void note is marked across every page. */
export async function deliveryNotePdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const d = await deliveryBy('id', id)
  if (!d) throw new ActionError('Delivery note not found', 404)
  return trustedPdf({
    kind: 'delivery', id, number: d.number, candidate: { status: d.status, createdAt: d.createdAt },
    render: async () => renderDeliveryNote(noteData(d, `${baseUrl.replace(/\/+$/, '')}/pod/${d.captureToken}`, await verifyUrlOf('delivery', id, baseUrl), await references(d)), await issuerOf()),
  })
}

/** The proof of delivery as a PDF: the live proof, or the latest rejected one (marked) when none is live. */
export async function podPdf(id: number, baseUrl: string): Promise<Uint8Array> {
  const d = await deliveryBy('id', id)
  if (!d) throw new ActionError('Delivery note not found', 404)
  const proofs = await proofsOf(id)
  const proof = proofs.find((p) => p.status === 'submitted') ?? proofs[0]
  if (!proof) throw new ActionError('This delivery has no recorded proof of delivery', 409)
  // The proof of delivery is verified under the PROOF's own record (a rejected proof is revoked and a new one gets a new record), not the delivery's.
  return trustedPdf({
    kind: 'pod', id: proof.id, number: d.number, candidate: { status: proof.status === 'submitted' ? 'delivered' : 'rejected', createdAt: proof.serverTime },
    render: () => renderProof(d, proof, baseUrl),
  })
}

async function renderProof(d: DeliveryView, proof: Awaited<ReturnType<typeof proofsOf>>[number], baseUrl: string): Promise<Uint8Array> {
  const signature = await proofEvidence(proof, 'signature')
  const photos = await Promise.all(proof.photos.map(async (_photo, i) => (await proofEvidence(proof, `photo-${i + 1}`))!.bytes))
  const { captureUrl: _none, ...note } = noteData(d, '', await verifyUrlOf('pod', proof.id, baseUrl), await references(d))
  return renderPod({
    ...note, viewUrl: `${baseUrl.replace(/\/+$/, '')}/pod/view/${d.viewToken}`,
    proof: {
      status: proof.status, receivedAt: `${businessDateTime(proof.serverTime)} WIB`, deviceTime: proof.deviceTime ? `${businessDateTime(new Date(proof.deviceTime))} WIB` : '',
      receiverName: proof.receiverName, receiverPosition: proof.receiverPosition, receiverPhone: proof.receiverPhone, receiverEmail: proof.receiverEmail, receiverIdNumber: proof.receiverIdNumber, courierName: proof.courierName, courierPhone: proof.courierPhone,
      condition: proof.condition, conditionNote: proof.conditionNote, latitude: proof.latitude, longitude: proof.longitude, accuracyM: proof.accuracyM,
      locationStatus: proof.locationStatus, locationNote: proof.locationNote,
      signature: signature!.bytes, signatureSha256: proof.signatureSha256, photos: photos.map((bytes, i) => ({ bytes, sha256: proof.photos[i].sha256 })),
    },
  }, await issuerOf())
}
