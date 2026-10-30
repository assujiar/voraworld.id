import { one, rpc } from '../data'
import { recordAudit } from '../audit'
import { isoDay, today } from '../dates'
import { ActionError, isUnique } from '../errors'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { calcLines, units } from '../money'
import { getVerification } from '../verification'
import { moneyErrors, parseLines } from './parse'
import { requiresStamp } from './pdf-inspect'
import { sendWithInvoice } from './prepayments'

export interface InvoiceInput {
  customerId: number; issuedAt: string; dueAt: string; taxPercent: string; withholdingPercent: string; discount: string
  poNumber: string; shipmentReference: string; serviceMode: string; origin: string; destination: string; transportDocumentRef: string
  notes: string; items: string; bankAccountIds: number[]
}

const MAX_BANKS = 8

/**
 * Parses and calculates what was typed, then hands the finished figures to ONE database function (`invoice_create`) that, in one transaction,
 * allocates the number, stores the invoice with its bank snapshots, items, QR link and pre-payment receipt, and writes the audit row.
 */
export async function createInvoice(actorId: number, input: InvoiceInput): Promise<number> {
  const lines = parseLines(input.items)
  const ids = input.bankAccountIds
  if (new Set(ids).size !== ids.length || ids.length > MAX_BANKS) throw new ActionError(`Select at most ${MAX_BANKS} distinct bank accounts`)
  const issued = isoDay(input.issuedAt, today(), 'Issue date')
  const c = await one('customers', (q) => q.eq('id', input.customerId), 'id,currency,terms_days')
  if (!c) throw new ActionError('Select an existing customer')
  const currency = c.currency as string
  // No due date typed: use the customer's payment terms.
  const fallbackDue = new Date(Date.parse(issued + 'T00:00:00Z') + (c.termsDays as number) * 86_400_000).toISOString().slice(0, 10)
  const due = isoDay(input.dueAt, fallbackDue, 'Due date')
  if (due < issued) throw new ActionError('The due date is before the issue date')
  const discountMinor = moneyErrors(() => units(input.discount.trim() || '0', currency))
  if (discountMinor < 0) throw new ActionError('Discount cannot be negative')
  const taxPercent = input.taxPercent.trim().slice(0, 20) || '0'
  const withholdingPercent = input.withholdingPercent.trim().slice(0, 20) || '0'
  const calc = moneyErrors(() => calcLines(lines, currency, taxPercent, withholdingPercent, discountMinor))
  try {
    return await rpc<number>('invoice_create', {
      p_actor: actorId,
      p: {
        customer_id: c.id, currency, issued_at: issued, due_at: due, po_number: input.poNumber.slice(0, 100), shipment_reference: input.shipmentReference.slice(0, 120),
        service_mode: input.serviceMode.slice(0, 120), origin: input.origin.slice(0, 180), destination: input.destination.slice(0, 180),
        transport_document_ref: input.transportDocumentRef.slice(0, 150), notes: input.notes.slice(0, 2500), tax_percent: taxPercent, withholding_percent: withholdingPercent,
        discount_minor: discountMinor, subtotal_minor: calc.subtotalMinor, tax_minor: calc.taxMinor, withholding_minor: calc.withholdingMinor, total_minor: calc.totalMinor,
        bank_ids: ids, stamp_required: requiresStamp(currency, calc.totalMinor),
        items: calc.items.map((i) => ({ description: i.description, unit: i.unit, quantity: i.quantity, price_minor: i.priceMinor, amount_minor: i.amountMinor })),
      },
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Invoice numbering collision, please retry', 409)
    throw e
  }
}

/** issue: draft -> issued. void: only while nothing has been confirmed; open payment claims are cancelled with it. */
export async function setInvoiceStatus(actorId: number, id: number, action: string): Promise<void> {
  await rpc('invoice_set_status', { p_actor: actorId, p_id: id, p_action: action })
}

/** Queues the invoice PDF for the customer. Pressing twice within a minute sends once; a later press sends again on purpose. */
export async function sendInvoice(actorId: number, id: number, baseUrl: string): Promise<void> {
  const inv = await one('invoices', (q) => q.eq('id', id))
  if (!inv) throw new ActionError('Invoice not found', 404)
  const customer = await one('customers', (q) => q.eq('id', inv.customerId as number), 'name,email')
  if (['draft', 'void'].includes(inv.status as string)) throw new ActionError('Issue the invoice before emailing it', 409)
  if (!customer?.email) throw new ActionError('The customer has no billing email')
  const conf = await getMailConfig()
  const rule = await one('email_rules', (q) => q.eq('key', 'invoice_customer'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the invoice_customer email rule first', 409)
  const ver = await getVerification('invoice', id)
  if (!ver || ver.revoked) throw new ActionError('The invoice has no active verification link', 409)
  const queued = await enqueue('invoice_customer', customer.email as string, {
    customer_name: customer.name, document_number: inv.number, document_date: inv.issuedAt, verify_url: `${baseUrl}/verify/${ver.token}`,
  }, { attachmentKind: 'invoice', attachmentId: id, dedupeKey: `invoice-customer-${id}-${Math.floor(Date.now() / 60_000)}` })
  if (!queued) throw new ActionError('Email delivery is disabled', 409)
  await sendWithInvoice(id, baseUrl)   // the released pre-payment receipt travels with the invoice
  await recordAudit(actorId, 'send-invoice', 'invoice', id, 'Invoice PDF queued through the configured SMTP')
}
