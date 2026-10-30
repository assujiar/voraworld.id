import { saveDeliveryAction } from '@/actions/deliveries'
import { ActionForm, FInput, FTextarea, Submit } from '@/components/admin/ActionForm'
import { CARGO_COLUMNS, ItemsTable } from '@/components/admin/ItemsTable'
import { one } from '@/server/data'
import { today } from '@/server/dates'
import { MAX_ITEMS, type DeliveryView } from '@/server/delivery/deliveries'
import { PartyFill, type PartyData } from './PartyFill'

/**
 * A delivery note is made for a customer's VALIDATED quotation. A new note starts from that customer and quotation (the route fills the form; the
 * shipper and consignee are written for the shipment, with a button to copy the customer's details into either one); an existing draft is edited with its customer and quotation unchanged. The cargo table is what physically travels:
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
  // The customer's details are OFFERED for a party (buttons below), never assumed: the customer who pays is not always the shipper or the consignee.
  const fromCustomer: PartyData | null = customer ? {
    name: customer.name as string, address: String(customer.address ?? ''), contact: String(customer.picName ?? ''),
    phone: String(customer.picPhone || customer.phone || ''), email: String(customer.picEmail || customer.email || ''),
  } : null
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
          <h4 style={{ gridColumn: '1 / -1', margin: '0' }}>A. Commercial reference <small className="muted">(Referensi)</small></h4>
          <div className="field"><label>Delivery note date *</label><FInput name="delivery_date" type="date" fallback={d?.deliveryDate ?? today()} required /></div>
          <div className="field"><label>Shipment reference</label><FInput name="shipment_reference" fallback={d?.shipmentReference ?? ''} /></div>
          <div className="field"><label>Customer PO number</label><FInput name="po_number" fallback={d?.poNumber ?? ''} /></div>

          <h4 style={{ gridColumn: '1 / -1', margin: '18px 0 0' }}>B. Shipper <small className="muted">(Pengirim: who hands the cargo over)</small></h4>
          {fromCustomer ? <div className="field wide"><PartyFill prefix="shipper" label="Gunakan data customer sebagai Pengirim" data={fromCustomer} /> <span className="mini muted">Only if the customer is also the sender. Nothing is filled in unless you press it.</span></div> : null}
          <div className="field"><label>Shipper name *</label><FInput name="shipper_name" fallback={d?.shipperName ?? ''} maxLength={241} /></div>
          <div className="field"><label>Contact person</label><FInput name="shipper_contact" fallback={d?.shipperContact ?? ''} /></div>
          <div className="field"><label>Phone / mobile</label><FInput name="shipper_phone" fallback={d?.shipperPhone ?? ''} /></div>
          <div className="field"><label>Email</label><FInput name="shipper_email" type="email" fallback={d?.shipperEmail ?? ''} /></div>
          <div className="field wide"><label>Full pickup / shipper address *</label><FTextarea name="shipper_address" rows={3} fallback={d?.shipperAddress ?? ''} placeholder="Street, building, city, province, postal code, directions" /></div>

          <h4 style={{ gridColumn: '1 / -1', margin: '18px 0 0' }}>C. Consignee <small className="muted">(Penerima: who receives the cargo)</small></h4>
          {fromCustomer ? <div className="field wide"><PartyFill prefix="consignee" label="Gunakan data customer sebagai Penerima" data={fromCustomer} /> <span className="mini muted">Only if the customer is also the receiver. Nothing is filled in unless you press it.</span></div> : null}
          <div className="field"><label>Consignee name *</label><FInput name="consignee_name" fallback={d?.consigneeName ?? ''} maxLength={241} /></div>
          <div className="field"><label>Contact person</label><FInput name="consignee_contact" fallback={d?.consigneeContact ?? ''} /></div>
          <div className="field"><label>Phone / mobile</label><FInput name="consignee_phone" fallback={d?.consigneePhone ?? ''} /></div>
          <div className="field"><label>Email (receives the link to the proof of delivery)</label><FInput name="consignee_email" type="email" fallback={d?.consigneeEmail ?? ''} /></div>
          <div className="field wide"><label>Full delivery / consignee address *</label><FTextarea name="consignee_address" rows={3} fallback={d?.consigneeAddress ?? ''} placeholder="Street, building, city, province, postal code, directions" /></div>

          <h4 style={{ gridColumn: '1 / -1', margin: '18px 0 0' }}>D. Transport <small className="muted">(Pengangkutan)</small></h4>
          <div className="field"><label>Origin</label><FInput name="origin" fallback={d?.origin ?? (quotation?.origin as string) ?? ''} /></div>
          <div className="field"><label>Destination</label><FInput name="destination" fallback={d?.destination ?? (quotation?.destination as string) ?? ''} /></div>
          <div className="field"><label>Carrier</label><FInput name="carrier" fallback={d?.carrier ?? ''} /></div>
          <div className="field"><label>Vehicle</label><FInput name="vehicle" fallback={d?.vehicle ?? ''} /></div>
          <div className="field"><label>Vehicle plate</label><FInput name="vehicle_plate" fallback={d?.vehiclePlate ?? ''} /></div>
          <div className="field"><label>Driver</label><FInput name="driver_name" fallback={d?.driverName ?? ''} /></div>
          <div className="field"><label>Driver phone</label><FInput name="driver_phone" fallback={d?.driverPhone ?? ''} /></div>
          <h4 style={{ gridColumn: '1 / -1', margin: '18px 0 0' }}>E. Cargo items <small className="muted">(Barang)</small></h4>
          <div className="field wide">
            {quotation?.cargoInfo ? <p className="mini muted" style={{ whiteSpace: 'pre-wrap' }}>From the quotation: {quotation.cargoInfo as string}</p> : null}
            <ItemsTable columns={CARGO_COLUMNS} initial={initialRows} addLabel="Add cargo item" />
            <span className="mini muted">What physically travels, at most {MAX_ITEMS} rows. The quotation&apos;s charges are not cargo and are not copied here.</span>
          </div>
          <h4 style={{ gridColumn: '1 / -1', margin: '18px 0 0' }}>F. Notes <small className="muted">(Catatan)</small></h4>
          <div className="field wide"><label>Delivery instructions and special remarks</label><FTextarea name="notes" rows={3} fallback={d?.notes ?? ''} /></div>
        </div>
        <Submit>Save draft</Submit>
      </ActionForm>
    </div>
  )
}
