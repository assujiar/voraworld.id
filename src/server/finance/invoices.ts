import { one, rpc } from '../data'
import { recordAudit } from '../audit'
import { isoDay, today } from '../dates'
import { ActionError, isUnique } from '../errors'
import { getMailConfig } from '../mail/config'
import { enqueueWithAttachments } from '../mail/outbox'
import { calcLines, units } from '../money'
import { getVerification } from '../verification'
import { chargeLines, moneyErrors, type ChargeRow } from './parse'
import { requiresStamp } from './pdf-inspect'

export interface InvoiceInput {
  /** The customer, one of their VALIDATED quotations and the delivery notes (with a proof of delivery) this invoice bills. All required. */
  customerId: number; quotationId: number; deliveryIds: number[]
  issuedAt: string; dueAt: string; taxPercent: string; withholdingPercent: string; discount: string
  poNumber: string; shipmentReference: string; serviceMode: string; origin: string; destination: string; transportDocumentRef: string
  notes: string
  /** The charge table: description, quantity, unit, unit price. */
  rows: ChargeRow[]
  bankAccountIds: number[]
  /** The administrator saw that the invoices of the quotation will total more than was quoted, and means it. */
  overQuotationAck?: boolean
}

const MAX_BANKS = 8
const MAX_DELIVERIES = 60

/**
 * Parses and calculates what was typed, then hands the finished figures to ONE database function (`invoice_create`) that, in one transaction,
 * checks the customer, the validated quotation and the delivery notes (each belongs to that customer and quotation, has its proof of delivery and
 * is not billed elsewhere), allocates the number, stores the invoice with its bank snapshots, items, QR link and pre-payment receipt, and writes
 * the audit row. The quotation's total is never multiplied by the number of delivery notes: the amounts are the ones on the charge table.
 */
export async function createInvoice(actorId: number, input: InvoiceInput): Promise<number> {
  const lines = chargeLines(input.rows)
  const ids = input.bankAccountIds
  if (new Set(ids).size !== ids.length || ids.length > MAX_BANKS) throw new ActionError(`Select at most ${MAX_BANKS} distinct bank accounts`)
  if (!input.quotationId) throw new ActionError('Select one of the customer\'s validated quotations')
  if (!input.deliveryIds.length) throw new ActionError('Select at least one delivery note to bill')
  if (input.deliveryIds.length > MAX_DELIVERIES) throw new ActionError(`An invoice bills at most ${MAX_DELIVERIES} delivery notes`)
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
        customer_id: c.id, quotation_id: input.quotationId, delivery_ids: input.deliveryIds, over_quotation_ack: Boolean(input.overQuotationAck),
        currency, issued_at: issued, due_at: due, po_number: input.poNumber.slice(0, 100), shipment_reference: input.shipmentReference.slice(0, 120),
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
  if (action === 'void') { const { recordVoided } = await import('../trust/revocation'); await recordVoided(actorId, 'invoice', id); const pre = await one('prepayment_receipts', (q) => q.eq('invoice_id', id), 'id'); if (pre) await recordVoided(actorId, 'prepayment', pre.id as number, 'The invoice was voided') }
}

/**
 * "Send invoice and pre-payment receipt": ONE email with TWO PDFs. Both documents must be ready (the invoice issued, the pre-payment receipt
 * released with its e-meterai when one is required) and both PDFs must build now; otherwise nothing is sent, and the message says which part
 * is missing. The invoice is never sent alone with its receipt silently left out. Sending is not payment: the balance does not move.
 * Pressing twice within a minute queues once; a later press sends again on purpose.
 */
export async function sendInvoice(actorId: number, id: number, baseUrl: string): Promise<void> {
  const inv = await one('invoices', (q) => q.eq('id', id))
  if (!inv) throw new ActionError('Invoice not found', 404)
  if (['draft', 'void'].includes(inv.status as string)) throw new ActionError('Issue the invoice before emailing it', 409)
  const customer = await one('customers', (q) => q.eq('id', inv.customerId as number), 'name,email')
  if (!customer?.email) throw new ActionError('The customer has no billing email')
  const pre = await one('prepayment_receipts', (q) => q.eq('invoice_id', id).neq('status', 'void').order('id', { ascending: false }), 'id,number,status,stamp_required,stamp_storage_key')
  if (!pre) throw new ActionError('This invoice has no pre-payment receipt: create it first, then send both together', 409)
  if (pre.status === 'pending_stamp' || (pre.stampRequired && !pre.stampStorageKey)) throw new ActionError('The pre-payment receipt is waiting for its e-meterai: upload the stamped PDF first. Nothing was sent', 409)
  if (pre.status !== 'issued') throw new ActionError('The pre-payment receipt is not released yet. Nothing was sent', 409)
  const conf = await getMailConfig()
  const rule = await one('email_rules', (q) => q.eq('key', 'invoice_customer'), 'enabled')
  if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the invoice_customer email rule first', 409)
  const ver = await getVerification('invoice', id)
  if (!ver || ver.revoked) throw new ActionError('The invoice has no active verification link', 409)
  const preVer = await getVerification('prepayment', pre.id as number)
  if (!preVer || preVer.revoked) throw new ActionError('The pre-payment receipt has no active verification link', 409)
  // Both final PDFs exist now (a stamped file is read back and its fingerprint checked): a package that cannot be built is not queued.
  const { renderDocumentPdf } = await import('../pdf/documents')
  try {
    await renderDocumentPdf('invoice', id, baseUrl)
    await renderDocumentPdf('prepayment', pre.id as number, baseUrl)
  } catch (e) {
    throw new ActionError(`A PDF of the package could not be prepared, so nothing was sent: ${e instanceof Error ? e.message : 'unknown error'}`, 409)
  }
  const queued = await enqueueWithAttachments('invoice_customer', customer.email as string, {
    customer_name: customer.name, document_number: inv.number, document_date: inv.issuedAt, verify_url: `${baseUrl}/verify/${ver.token}`,
    prepayment_number: pre.number, prepayment_verify_url: `${baseUrl}/verify/${preVer.token}`,
  }, [{ kind: 'invoice', id }, { kind: 'prepayment', id: pre.id as number }], { dedupeKey: `invoice-package-${id}-${Math.floor(Date.now() / 60_000)}` })
  if (!queued) throw new ActionError('Email delivery is disabled', 409)
  await recordAudit(actorId, 'send-invoice-package', 'invoice', id, `Invoice and pre-payment receipt ${pre.number} queued as one message with two PDFs`)
}
