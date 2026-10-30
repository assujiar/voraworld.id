import { saveDeliveryAction } from '@/actions/deliveries'
import { ActionForm, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { many } from '@/server/data'
import { today } from '@/server/dates'
import { MAX_ITEMS, type DeliveryView, itemsText } from '@/server/delivery/deliveries'

/** One form for a new delivery note and for editing a draft. */
export async function DeliveryForm({ delivery }: { delivery?: DeliveryView }) {
  const customers = await many('customers', (q) => q.order('name'), 'id,name', 500)
  const d = delivery
  return (
    <div className="admin-panel">
      <h3>{d ? `Edit ${d.number}` : 'New delivery note'} <small className="muted">(Surat Jalan)</small></h3>
      <p className="note">A delivery note travels with the goods. Once issued it carries a QR code: the receiver scans it, signs on their phone, photographs the goods, and that is the proof of delivery. Nothing is cut short: text that is too long is refused with a message.</p>
      <ActionForm action={saveDeliveryAction}>
        {d ? <input type="hidden" name="record" value={d.id} /> : null}
        <div className="admin-form-grid">
          <div className="field"><label>Delivery date</label><FInput name="delivery_date" type="date" fallback={d?.deliveryDate ?? today()} required /></div>
          <div className="field"><label>Customer (optional)</label>
            <FSelect name="customer_id" fallback={d?.customerId ? String(d.customerId) : ''}>
              <option value="">None: a delivery of the company</option>
              {customers.map((c) => <option key={c.id as number} value={c.id as number}>{c.name as string}</option>)}
            </FSelect>
            <span className="mini muted">Numbered under the customer&apos;s code. Their name, address and email fill the consignee when left empty.</span>
          </div>
          <h4 style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>Consignee <small className="muted">(Penerima)</small></h4>
          <div className="field"><label>Consignee name *</label><FInput name="consignee_name" fallback={d?.consigneeName ?? ''} maxLength={241} /></div>
          <div className="field"><label>Contact person</label><FInput name="consignee_contact" fallback={d?.consigneeContact ?? ''} /></div>
          <div className="field wide"><label>Address</label><FTextarea name="consignee_address" rows={2} fallback={d?.consigneeAddress ?? ''} /></div>
          <div className="field"><label>Phone</label><FInput name="consignee_phone" fallback={d?.consigneePhone ?? ''} /></div>
          <div className="field"><label>Email (receives the link to the proof of delivery)</label><FInput name="consignee_email" type="email" fallback={d?.consigneeEmail ?? ''} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>Shipment <small className="muted">(Pengiriman)</small></h4>
          <div className="field"><label>Origin</label><FInput name="origin" fallback={d?.origin ?? ''} /></div>
          <div className="field"><label>Destination</label><FInput name="destination" fallback={d?.destination ?? ''} /></div>
          <div className="field"><label>Shipment reference</label><FInput name="shipment_reference" fallback={d?.shipmentReference ?? ''} /></div>
          <div className="field"><label>PO number</label><FInput name="po_number" fallback={d?.poNumber ?? ''} /></div>
          <div className="field"><label>Carrier</label><FInput name="carrier" fallback={d?.carrier ?? ''} /></div>
          <div className="field"><label>Vehicle</label><FInput name="vehicle" fallback={d?.vehicle ?? ''} /></div>
          <div className="field"><label>Vehicle plate</label><FInput name="vehicle_plate" fallback={d?.vehiclePlate ?? ''} /></div>
          <div className="field"><label>Driver</label><FInput name="driver_name" fallback={d?.driverName ?? ''} /></div>
          <div className="field"><label>Driver phone</label><FInput name="driver_phone" fallback={d?.driverPhone ?? ''} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>Items <small className="muted">(Barang)</small></h4>
          <div className="field wide"><label>Items * (one per line)</label>
            <FTextarea name="items" rows={7} fallback={d ? itemsText(d.items) : ''} placeholder={'Cartons of spare parts | 24 | ctn | fragile\nPallet of cables | 2 | plt'} />
            <span className="mini muted">Write each line as <code>description | quantity | unit | remarks</code>. Unit and remarks are optional (the unit defaults to pcs). At most {MAX_ITEMS} items.</span>
          </div>
          <div className="field wide"><label>Notes</label><FTextarea name="notes" rows={3} fallback={d?.notes ?? ''} /></div>
        </div>
        <Submit>Save draft</Submit>
      </ActionForm>
    </div>
  )
}
