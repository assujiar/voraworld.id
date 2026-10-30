'use server'
import { ActionError, adminRun, adminRunForm, type FormState } from '@/server/action'
import { createDelivery, rejectProof, resendReceivedEmail, setDeliveryStatus, updateDelivery, type DeliveryInput } from '@/server/delivery/deliveries'
import { publicBaseUrl } from '@/server/env'
import { rowsFromForm } from '@/server/form-rows'
import { int, rawStr, str } from '@/server/http'

/** One character more than a field allows is read, so that too much text is refused with a message rather than quietly cut short. */
const text = (form: FormData, key: string, max: number) => rawStr(form, key, max + 1)

function inputOf(form: FormData): DeliveryInput {
  return {
    customerId: int(form, 'customer_id') || null, quotationId: int(form, 'quotation_id') || null,
    consigneeName: text(form, 'consignee_name', 240), consigneeAddress: text(form, 'consignee_address', 1000), consigneeContact: text(form, 'consignee_contact', 160),
    consigneePhone: text(form, 'consignee_phone', 60), consigneeEmail: text(form, 'consignee_email', 200),
    origin: text(form, 'origin', 240), destination: text(form, 'destination', 240), shipmentReference: text(form, 'shipment_reference', 120), poNumber: text(form, 'po_number', 100),
    carrier: text(form, 'carrier', 160), vehicle: text(form, 'vehicle', 120), vehiclePlate: text(form, 'vehicle_plate', 30), driverName: text(form, 'driver_name', 160), driverPhone: text(form, 'driver_phone', 60),
    deliveryDate: str(form, 'delivery_date', 10), notes: text(form, 'notes', 2000),
    items: rowsFromForm(form, 'item', { description: 500, quantity: 40, unit: 30, remarks: 240 }),
  }
}

/** Creates a draft, or saves one when the form carries `record`. */
export async function saveDeliveryAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const record = int(form, 'record')
    if (record) {
      await updateDelivery(user.id, record, inputOf(form))
      return { to: `/admin/deliveries/${record}`, notice: 'Delivery note saved' }
    }
    const id = await createDelivery(user.id, inputOf(form))
    return { to: `/admin/deliveries/${id}`, notice: 'Delivery note draft created' }
  })
}

export async function deliveryStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await setDeliveryStatus(user.id, id, str(form, 'action', 10))
    return { to: `/admin/deliveries/${id}`, notice: 'Delivery note state updated' }
  })
}

export async function rejectProofAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await rejectProof(user.id, id, str(form, 'reason', 500))
    return { to: `/admin/deliveries/${id}`, notice: 'Proof of delivery rejected: the QR code can be used again' }
  })
}

export async function resendReceivedAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    if (!id) throw new ActionError('Delivery note not found', 404)
    await resendReceivedEmail(user.id, id, publicBaseUrl())
    return { to: `/admin/deliveries/${id}`, notice: 'The email was queued' }
  })
}
