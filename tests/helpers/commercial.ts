import { createDelivery, setDeliveryStatus } from '@/server/delivery/deliveries'
import { createInvoice as createInvoiceFor, type InvoiceInput } from '@/server/finance/invoices'
import { calcLines } from '@/server/money'
import { createQuotation as createQuotationFor, type QuotationInput } from '@/server/finance/quotations'
import { today } from '@/server/dates'
import { sql } from './db'

/**
 * Fixtures for the tests that are about something else (a payment, a PDF, an email) but need an invoice. A real invoice is made for a validated
 * quotation and bills delivery notes that have their proof of delivery; here the quotation is validated and the delivery marked delivered by a
 * direct write, which skips the customer's upload and the courier's phone (tests/commercial.test.ts walks those for real).
 */
export interface LegacyInvoice extends Omit<InvoiceInput, 'rows' | 'quotationId' | 'deliveryIds'> {
  /** `description | quantity | unit price | unit`, one per line (the shape the old form took). */
  items: string
  quotationId?: number; deliveryIds?: number[]
}

export const rowsOf = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
  const [description = '', quantity = '', price = '', unit = 'unit'] = line.split('|').map((s) => s.trim())
  return { description, quantity, price, unit }
})

export async function validatedQuotation(actor: number, customerId: number): Promise<number> {
  const id = await createQuotationFor(actor, {
    customerId, issuedAt: '2026-10-01', validUntil: '2027-12-31', taxPercent: '0', paymentTerms: 'Within 14 days', termsConditions: 'Standard terms',
    notes: '', rows: [{ description: 'Freight', quantity: '1', unit: 'shipment', price: '1000000' }],
  })
  await sql`update quotations set status = 'validated', validated_at = now() where id = ${id}`
  return id
}

export async function deliveredNote(actor: number, customerId: number, quotationId: number): Promise<number> {
  const id = await createDelivery(actor, {
    customerId, quotationId, shipperName: 'PT Pengirim', shipperAddress: 'Jl. Pabrik 9, Kawasan Industri, Cikarang, Jawa Barat 17530', shipperContact: 'Rina', shipperPhone: '+62 21 888', shipperEmail: 'gudang@pengirim.example', consigneeName: 'PT Penerima', consigneeAddress: 'Jl. Gudang 5, Bekasi', consigneeContact: '', consigneePhone: '', consigneeEmail: '', origin: '', destination: '', shipmentReference: '', poNumber: '',
    carrier: '', vehicle: '', vehiclePlate: '', driverName: '', driverPhone: '', deliveryDate: '2026-10-02', notes: '', items: [{ description: 'Cargo', quantity: '1', unit: 'pcs', remarks: '' }],
  })
  await setDeliveryStatus(actor, id, 'issue')
  await sql`update deliveries set status = 'delivered', delivered_at = now() where id = ${id}`
  return id
}

/** createInvoice as the old tests call it: with a text of lines. A validated quotation and a delivered note are made for it unless given. */
export async function createInvoice(actor: number, input: LegacyInvoice): Promise<number> {
  const quotationId = input.quotationId ?? await validatedQuotation(actor, input.customerId)
  const deliveryIds = input.deliveryIds ?? [await deliveredNote(actor, input.customerId, quotationId)]
  const { items, ...rest } = input
  return createInvoiceFor(actor, { ...rest, rows: rowsOf(items), quotationId, deliveryIds, overQuotationAck: true })
}

// ---------------------------------------------------------------------------------------------------------------- quotations as the old tests make them

export interface LegacyQuotation extends Omit<QuotationInput, 'customerId' | 'rows'> {
  /** `customer:<id>`, or `lead:<id>` for a quotation of the kind made before the customer became the commercial entity. */
  recipient: string
  /** `description | quantity | unit price | unit`, one per line. */
  items: string
}

/**
 * A customer quotation is made through the real service. A lead quotation is the HISTORICAL kind (customer_id empty): the service no longer creates
 * one, so it is written directly, as the old function wrote it, to check that such records still read, print and approve as they always did.
 */
export async function createQuotation(actor: number, input: LegacyQuotation): Promise<number> {
  const m = /^(customer|lead):(\d+)$/.exec(input.recipient)
  if (!m) throw new Error('recipient must be customer:<id> or lead:<id>')
  const { recipient: _r, items, ...rest } = input
  void _r
  if (m[1] === 'customer') return createQuotationFor(actor, { ...rest, customerId: Number(m[2]), rows: rowsOf(items) })
  const leadId = Number(m[2])
  const totals = calcLines(rowsOf(items).map((r) => ({ description: r.description, quantity: r.quantity, price: r.price, unit: r.unit })), 'IDR', rest.taxPercent || '0')
  const [{ code }] = await sql`select vr_public_code('leads', ${leadId}) as code`
  const issued = rest.issuedAt || today()
  const [{ number }] = await sql`select vr_next_number('QUO', ${code as string}, ${issued}) as number`
  const [q] = await sql`insert into quotations (number, lead_id, status, currency, issued_at, valid_until, payment_terms, terms_conditions, notes, tax_percent, subtotal_minor, tax_minor, total_minor)
    values (${number as string}, ${leadId}, 'draft', 'IDR', ${issued}, ${rest.validUntil || issued}, ${rest.paymentTerms}, ${rest.termsConditions}, ${rest.notes}, ${rest.taxPercent || '0'}, ${totals.subtotalMinor}, ${totals.taxMinor}, ${totals.totalMinor}) returning id`
  for (const i of totals.items) await sql`insert into quotation_items (quotation_id, description, unit, quantity, price_minor, amount_minor) values (${q.id as number}, ${i.description}, ${i.unit}, ${i.quantity}, ${i.priceMinor}, ${i.amountMinor})`
  await sql`select vr_create_verification('quotation', ${q.id as number})`
  return q.id as number
}
