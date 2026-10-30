import { tx, type Db } from '../db'
import { recordAudit } from '../audit'
import { isoDay, today } from '../dates'
import { ActionError, isUnique } from '../errors'
import { getMailConfig } from '../mail/config'
import { enqueue } from '../mail/outbox'
import { calcLines, units } from '../money'
import { ensurePublicCode, nextNumber } from '../numbering'
import { createVerification, getVerification } from '../verification'
import { bankSnapshot } from './banks'
import { moneyErrors, parseLines } from './parse'
import { createPrepayment, releasePrepayment, sendWithInvoice, voidPrepaymentsOf } from './prepayments'

export interface InvoiceInput {
  customerId: number; issuedAt: string; dueAt: string; taxPercent: string; withholdingPercent: string; discount: string
  poNumber: string; shipmentReference: string; serviceMode: string; origin: string; destination: string; transportDocumentRef: string
  notes: string; items: string; bankAccountIds: number[]
}

const MAX_BANKS = 8

export async function createInvoice(actorId: number, input: InvoiceInput): Promise<number> {
  const lines = parseLines(input.items)
  const ids = input.bankAccountIds
  if (new Set(ids).size !== ids.length || ids.length > MAX_BANKS) throw new ActionError(`Select at most ${MAX_BANKS} distinct bank accounts`)
  const issued = isoDay(input.issuedAt, today(), 'Issue date')
  try {
    return await tx(async (t) => {
      const [c] = await t`select id, currency, terms_days from customers where id = ${input.customerId}`
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

      let bankIds = ids
      if (!bankIds.length) {
        const [def] = await t`select id from bank_accounts where currency = ${currency} and active and is_default`
        if (def) bankIds = [def.id as number]
      }
      const banks = []
      for (const bankId of bankIds) {
        const [b] = await t`select * from bank_accounts where id = ${bankId}`
        if (!b || !b.active || b.currency !== currency) throw new ActionError('Only active bank accounts in the invoice currency can be selected')
        banks.push(b)
      }

      const code = await ensurePublicCode(t, 'customers', c.id as number)
      const number = await nextNumber(t, 'INV', code, issued)
      const [inv] = await t`insert into invoices (number, customer_id, status, currency, issued_at, due_at, po_number, shipment_reference, service_mode, origin, destination,
          transport_document_ref, notes, tax_percent, withholding_percent, discount_minor, subtotal_minor, tax_minor, withholding_minor, total_minor, outstanding_minor)
        values (${number}, ${c.id as number}, 'draft', ${currency}, ${issued}, ${due}, ${input.poNumber.slice(0, 100)}, ${input.shipmentReference.slice(0, 120)}, ${input.serviceMode.slice(0, 120)},
          ${input.origin.slice(0, 180)}, ${input.destination.slice(0, 180)}, ${input.transportDocumentRef.slice(0, 150)}, ${input.notes.slice(0, 2500)}, ${taxPercent}, ${withholdingPercent},
          ${discountMinor}, ${calc.subtotalMinor}, ${calc.taxMinor}, ${calc.withholdingMinor}, ${calc.totalMinor}, ${calc.totalMinor}) returning id`
      const invoiceId = inv.id as number
      for (const [position, b] of banks.entries()) {
        const s = bankSnapshot(b as never)
        await t`insert into invoice_bank_instructions (invoice_id, bank_account_id, bank_name, account_number, account_holder, currency, branch, swift_code, position)
                values (${invoiceId}, ${b.id as number}, ${s.bank_name}, ${s.account_number}, ${s.account_holder}, ${s.currency}, ${s.branch}, ${s.swift_code}, ${position})`
      }
      for (const item of calc.items) {
        await t`insert into invoice_items (invoice_id, description, unit, quantity, price_minor, amount_minor)
                values (${invoiceId}, ${item.description}, ${item.unit}, ${item.quantity}, ${item.priceMinor}, ${item.amountMinor})`
      }
      await createVerification(t, 'invoice', invoiceId)
      // Every invoice comes with its pre-payment receipt (a draft until the invoice is issued).
      await createPrepayment(t, { id: invoiceId, customerId: c.id as number, currency, totalMinor: calc.totalMinor, issuedAt: issued })
      await recordAudit(t, actorId, 'create', 'invoice', invoiceId, number)
      return invoiceId
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Invoice numbering collision, please retry', 409)
    throw e
  }
}

/** Recomputes balance and status from the confirmed payments. A payment total above the invoice is a hard error. */
export async function recomputeOutstanding(t: Db, invoiceId: number): Promise<{ outstanding: number; status: string }> {
  const [inv] = await t`select total_minor, status from invoices where id = ${invoiceId}`
  const [{ paid }] = await t`select coalesce(sum(amount_minor), 0)::bigint as paid from payments where invoice_id = ${invoiceId} and status = 'recorded'`
  const total = inv.totalMinor as number
  if ((paid as number) > total) throw new ActionError('Confirmed payments exceed the invoice total', 409)
  const outstanding = total - (paid as number)
  const status = inv.status === 'void' ? 'void' : !outstanding ? 'paid' : paid ? 'partially_paid' : 'issued'
  await t`update invoices set outstanding_minor = ${outstanding}, status = ${status} where id = ${invoiceId}`
  return { outstanding, status }
}

/** issue: draft -> issued. void: only while nothing has been confirmed; open payment claims are cancelled with it. */
export async function setInvoiceStatus(actorId: number, id: number, action: string): Promise<void> {
  await tx(async (t) => {
    const [inv] = await t`select * from invoices where id = ${id} for update`
    if (!inv) throw new ActionError('Invoice not found', 404)
    if (action === 'issue' && inv.status === 'draft') {
      await t`update invoices set status = 'issued' where id = ${id}`
      await releasePrepayment(t, id)
    } else if (action === 'void' && !['void', 'paid', 'partially_paid'].includes(inv.status as string)) {
      await t`update invoices set status = 'void' where id = ${id}`
      await t`update document_verification_tokens set revoked = true where kind = 'invoice' and document_id = ${id}`
      await voidPrepaymentsOf(t, id)
      const cancelled = await t`update payments set status = 'cancelled' where invoice_id = ${id} and status = 'pending_confirmation' returning id`
      if (cancelled.length) await recordAudit(t, actorId, 'cancel-unconfirmed-payment', 'invoice', id, `${cancelled.length} open payment claim(s) cancelled with the void`)
    } else {
      throw new ActionError('Invalid state change. Reverse confirmed payments (void their receipts) before voiding an invoice', 409)
    }
    await recordAudit(t, actorId, action, 'invoice', id, inv.number as string)
  })
}

/** Queues the invoice PDF for the customer. Pressing twice within a minute sends once; a later press sends again on purpose. */
export async function sendInvoice(actorId: number, id: number, baseUrl: string): Promise<void> {
  await tx(async (t) => {
    const [inv] = await t`select i.*, c.name as customer_name, c.email as customer_email from invoices i join customers c on c.id = i.customer_id where i.id = ${id}`
    if (!inv) throw new ActionError('Invoice not found', 404)
    if (['draft', 'void'].includes(inv.status as string)) throw new ActionError('Issue the invoice before emailing it', 409)
    if (!inv.customerEmail) throw new ActionError('The customer has no billing email')
    const conf = await getMailConfig(t)
    const [rule] = await t`select enabled from email_rules where key = 'invoice_customer'`
    if (!conf?.enabled || !rule?.enabled) throw new ActionError('Enable SMTP and the invoice_customer email rule first', 409)
    const ver = await getVerification(t, 'invoice', id)
    if (!ver || ver.revoked) throw new ActionError('The invoice has no active verification link', 409)
    const queued = await enqueue(t, 'invoice_customer', inv.customerEmail as string, {
      customer_name: inv.customerName, document_number: inv.number, document_date: inv.issuedAt, verify_url: `${baseUrl}/verify/${ver.token}`,
    }, { attachmentKind: 'invoice', attachmentId: id, dedupeKey: `invoice-customer-${id}-${Math.floor(Date.now() / 60_000)}` })
    if (!queued) throw new ActionError('Email delivery is disabled', 409)
    await sendWithInvoice(t, id, baseUrl)   // the released pre-payment receipt travels with the invoice
    await recordAudit(t, actorId, 'send-invoice', 'invoice', id, 'Invoice PDF queued through the configured SMTP')
  })
}

