import { saveDeliveryAction } from '@/actions/deliveries'
import { ActionForm, FInput, FTextarea, Submit } from '@/components/admin/ActionForm'
import { CARGO_COLUMNS, ItemsTable } from '@/components/admin/ItemsTable'
import { one } from '@/server/data'
import { today } from '@/server/dates'
import { MAX_ITEMS, type DeliveryView } from '@/server/delivery/deliveries'

/**
 * A delivery note is made for a customer's VALIDATED quotation. A new note starts from that customer and quotation (their contact, route and
 * address fill the form); an existing draft is edited with its customer and quotation unchanged. The cargo table is what physically travels:
 * the quotation's charges (freight, documentation, ...) are never copied into it.
 */
export async function DeliveryForm({ delivery, customerId, quotationId }: { delivery?: DeliveryView; customerId?: number; quotationId?: number }) {
  const cid = delivery?.customerId ?? customerId ?? 0
  const qid = delivery?.quotationId ?? quotationId ?? 0
  const customer = cid ? await one('customers', (q) => q.eq('id', cid), 'id,name,address,email,phone,pic_name,pic_phone,pic_email,public_code') : undefined
  const quotation = qid ? await one('quotations', (q) => q.eq('id', qid), 'id,number,status,pic_name,pic_phone,origin,destination,service_mode,cargo_info') : undefined
  if (!delivery && (!customer || !quotation || quotation.status !== 'validated')) {
    return <div className="admin-panel"><p>Choose a customer and one of their validated quotations first. <a href="/admin/deliveries/new">Start again</a></p></div>
  }
  const d = delivery
  const initialRows = d ? d.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit, remarks: i.remarks })) : []
  return (
    <div className="admin-panel">
      <h3>{d ? `Edit ${d.number}` : 'New delivery note'} <small className="muted">(Surat Jalan)</small></h3>
      <p>For {customer ? <a href={`/admin/customers/${customer.id}`}><strong>{customer.name as string}</strong></a> : 'a customer'}{quotation ? <> · under quotation <a href={`/admin/quotations/${quotation.id}`}>{quotation.number as string}</a></> : <span className="muted"> · an earlier note, made without a quotation</span>}</p>
      <p className="note">A delivery note travels with the goods. Once issued it carries a QR code: the driver scans it at the handover, the receiver signs on the driver&apos;s phone, and that is the proof of delivery. Nothing is cut short: text that is too long is refused with a message.</p>
      <ActionForm action={saveDeliveryAction}>
        {d ? <input type="hidden" name="record" value={d.id} /> : null}
        {!d ? <><input type="hidden" name="customer_id" value={cid} /><input type="hidden" name="quotation_id" value={qid} /></> : null}
        <div className="admin-form-grid">
          <div className="field"><label>Delivery date</label><FInput name="delivery_date" type="date" fallback={d?.deliveryDate ?? today()} required /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>Consignee <small className="muted">(Penerima)</small></h4>
          <div className="field"><label>Consignee name *</label><FInput name="consignee_name" fallback={d?.consigneeName ?? (customer?.name as string) ?? ''} maxLength={241} /></div>
          <div className="field"><label>Contact person</label><FInput name="consignee_contact" fallback={d?.consigneeContact ?? ((quotation?.picName as string) || (customer?.picName as string) || '')} /></div>
          <div className="field wide"><label>Address</label><FTextarea name="consignee_address" rows={2} fallback={d?.consigneeAddress ?? (customer?.address as string) ?? ''} /></div>
          <div className="field"><label>Phone</label><FInput name="consignee_phone" fallback={d?.consigneePhone ?? ((quotation?.picPhone as string) || (customer?.picPhone as string) || (customer?.phone as string) || '')} /></div>
          <div className="field"><label>Email (receives the link to the proof of delivery)</label><FInput name="consignee_email" type="email" fallback={d?.consigneeEmail ?? ((customer?.picEmail as string) || (customer?.email as string) || '')} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>Shipment <small className="muted">(Pengiriman)</small></h4>
          <div className="field"><label>Origin</label><FInput name="origin" fallback={d?.origin ?? (quotation?.origin as string) ?? ''} /></div>
          <div className="field"><label>Destination</label><FInput name="destination" fallback={d?.destination ?? (quotation?.destination as string) ?? ''} /></div>
          <div className="field"><label>Shipment reference</label><FInput name="shipment_reference" fallback={d?.shipmentReference ?? ''} /></div>
          <div className="field"><label>PO number</label><FInput name="po_number" fallback={d?.poNumber ?? ''} /></div>
          <div className="field"><label>Carrier</label><FInput name="carrier" fallback={d?.carrier ?? ''} /></div>
          <div className="field"><label>Vehicle</label><FInput name="vehicle" fallback={d?.vehicle ?? ''} /></div>
          <div className="field"><label>Vehicle plate</label><FInput name="vehicle_plate" fallback={d?.vehiclePlate ?? ''} /></div>
          <div className="field"><label>Driver</label><FInput name="driver_name" fallback={d?.driverName ?? ''} /></div>
          <div className="field"><label>Driver phone</label><FInput name="driver_phone" fallback={d?.driverPhone ?? ''} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>Cargo <small className="muted">(Barang)</small></h4>
          <div className="field wide">
            {quotation?.cargoInfo ? <p className="mini muted" style={{ whiteSpace: 'pre-wrap' }}>From the quotation: {quotation.cargoInfo as string}</p> : null}
            <ItemsTable columns={CARGO_COLUMNS} initial={initialRows} addLabel="Add cargo item" />
            <span className="mini muted">What physically travels, at most {MAX_ITEMS} rows. The quotation&apos;s charges are not cargo and are not copied here.</span>
          </div>
          <div className="field wide"><label>Notes</label><FTextarea name="notes" rows={3} fallback={d?.notes ?? ''} /></div>
        </div>
        <Submit>Save draft</Submit>
      </ActionForm>
    </div>
  )
}
