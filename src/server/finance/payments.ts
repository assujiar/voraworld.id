import { tx } from '../db'
import { recordAudit } from '../audit'
import { isIsoDay, today } from '../dates'
import { ActionError } from '../errors'
import { enqueue } from '../mail/outbox'
import { money, units } from '../money'
import { ensurePublicCode, nextNumber } from '../numbering'
import { createVerification } from '../verification'
import { bankSnapshot } from './banks'
import { recomputeOutstanding } from './invoices'
import { bestEffort } from './notify'
import { requiresStamp } from './pdf-inspect'
import { moneyErrors } from './parse'

export interface PaymentInput { amount: string; date: string; method: string; reference: string; receivingBankId: number | null }

/**
 * Records a payment CLAIM. Nothing is credited: the invoice balance stays unchanged and no receipt exists until
 * Finance confirms that the money reached the company's bank account. Open claims reserve part of the balance,
 * so two people cannot claim the same money twice.
 */
export async function recordPayment(actorId: number, invoiceId: number, input: PaymentInput): Promise<number> {
  return tx(async (t) => {
    const [inv] = await t`select * from invoices where id = ${invoiceId} for update`
    if (!inv) throw new ActionError('Invoice not found', 404)
    if (!['issued', 'partially_paid'].includes(inv.status as string)) throw new ActionError('The invoice must be issued and have an unpaid balance', 409)
    const { outstanding } = await recomputeOutstanding(t, invoiceId)
    const [{ reserved }] = await t`select coalesce(sum(amount_minor), 0)::bigint as reserved from payments where invoice_id = ${invoiceId} and status = 'pending_confirmation'`
    const currency = inv.currency as string
    const amount = moneyErrors(() => units(input.amount, currency))
    if (amount <= 0 || amount > outstanding - (reserved as number)) throw new ActionError('The amount exceeds the unreserved outstanding balance')
    const date = input.date.trim() || today()
    if (!isIsoDay(date)) throw new ActionError('Payment date must be a valid date (YYYY-MM-DD)')
    if (date > today()) throw new ActionError('Payment date cannot be in the future')
    let bank: Record<string, string> | null = null
    let bankId: number | null = null
    if (input.receivingBankId) {
      const [b] = await t`select * from bank_accounts where id = ${input.receivingBankId}`
      if (!b || !b.active || b.currency !== currency) throw new ActionError('The receiving bank account is inactive or does not match the invoice currency')
      bank = bankSnapshot(b as never); bankId = b.id as number
    }
    const [p] = await t`insert into payments (invoice_id, amount_minor, date, method, reference, status, receiving_bank_id, receiving_bank_snapshot)
      values (${invoiceId}, ${amount}, ${date}, ${input.method.trim().slice(0, 100) || 'bank transfer'}, ${input.reference.trim().slice(0, 160)}, 'pending_confirmation',
              ${bankId}, ${bank ? t.json(bank as never) : null}) returning id`
    await recordAudit(t, actorId, 'payment-pending', 'invoice', invoiceId, `Payment #${p.id}: ${amount} ${currency}; not cleared`)
    return p.id as number
  })
}

export async function cancelPayment(actorId: number, paymentId: number): Promise<number> {
  return tx(async (t) => {
    const [ref] = await t`select invoice_id from payments where id = ${paymentId}`
    if (!ref) throw new ActionError('Payment not found', 404)
    await t`select id from invoices where id = ${ref.invoiceId as number} for update`
    const [p] = await t`select * from payments where id = ${paymentId} for update`
    if (p.status !== 'pending_confirmation') throw new ActionError('Only unconfirmed payments can be cancelled here', 409)
    await t`update payments set status = 'cancelled' where id = ${paymentId}`
    await recordAudit(t, actorId, 'cancel-unconfirmed-payment', 'payment', paymentId, 'No funds confirmed')
    return p.invoiceId as number
  })
}

export interface Confirmation { receiptId: number; invoiceId: number; stampRequired: boolean }

/**
 * Finance confirms that the funds are credited. In ONE transaction, under row locks (invoice first, then payment,
 * the same order everywhere): the payment becomes recorded, the invoice balance and status are recomputed, the
 * receipt and its verification link are created and the customer emails are queued. Concurrent confirmations of
 * the same payment: exactly one succeeds. A mail problem never undoes the accounting.
 */
export async function confirmPayment(actorId: number, paymentId: number, input: { fundsCleared: boolean; receivingBankId: number | null }, baseUrl: string): Promise<Confirmation> {
  if (!input.fundsCleared) throw new ActionError('Confirm that the funds are credited to the bank account before a receipt is issued')
  return tx(async (t) => {
    const [ref] = await t`select invoice_id from payments where id = ${paymentId}`
    if (!ref) throw new ActionError('Payment not found', 404)
    const [inv] = await t`select * from invoices where id = ${ref.invoiceId as number} for update`
    const [p] = await t`select * from payments where id = ${paymentId} for update`
    if (p.status !== 'pending_confirmation') throw new ActionError('The payment was already confirmed, cancelled or voided', 409)
    if (['draft', 'void'].includes(inv.status as string)) throw new ActionError('The invoice is not eligible for payment confirmation', 409)
    const [{ confirmed }] = await t`select coalesce(sum(amount_minor), 0)::bigint as confirmed from payments where invoice_id = ${inv.id as number} and status = 'recorded'`
    if ((p.amountMinor as number) > (inv.totalMinor as number) - (confirmed as number)) throw new ActionError('The payment exceeds the invoice balance', 409)

    const currency = inv.currency as string
    let snapshot = p.receivingBankSnapshot as Record<string, string> | null
    if (input.receivingBankId) {
      const [b] = await t`select * from bank_accounts where id = ${input.receivingBankId}`
      if (!b || !b.active || b.currency !== currency) throw new ActionError('The receiving bank account is inactive or does not match the invoice currency')
      snapshot = bankSnapshot(b as never)
      await t`update payments set receiving_bank_id = ${b.id as number}, receiving_bank_snapshot = ${t.json(snapshot as never)} where id = ${paymentId}`
    }
    if (!snapshot && /^(bank )?transfer$/.test(String(p.method).toLowerCase().trim())) {
      throw new ActionError('Select the VORA bank account that received the transfer')
    }

    await t`update payments set status = 'recorded', confirmed_at = now(), confirmed_by = ${actorId} where id = ${paymentId}`
    const { status } = await recomputeOutstanding(t, inv.id as number)
    const [after] = await t`select outstanding_minor from invoices where id = ${inv.id as number}`
    const needsStamp = requiresStamp(currency, p.amountMinor as number)
    const [customer] = await t`select id, name, email from customers where id = ${inv.customerId as number}`
    const code = await ensurePublicCode(t, 'customers', customer.id as number)
    const number = await nextNumber(t, 'RCP', code, (p.date as string) || today())
    const [receipt] = await t`insert into receipts (number, invoice_id, payment_id, status, stamp_required) values (${number}, ${inv.id as number}, ${paymentId}, ${needsStamp ? 'pending_stamp' : 'issued'}, ${needsStamp}) returning id`
    const receiptId = receipt.id as number
    const token = await createVerification(t, 'receipt', receiptId)

    if (customer.email) {
      await bestEffort(t, 'payment_confirmed', (s) => enqueue(s, 'payment_confirmed', customer.email as string, {
        customer_name: customer.name, invoice_number: inv.number, payment_amount: money(p.amountMinor as number, currency), payment_date: p.date,
        payment_reference: p.reference || 'Not provided', invoice_status: status === 'paid' ? 'OFFICIALLY PAID' : 'PARTIALLY PAID',
        outstanding_amount: money(after.outstandingMinor as number, currency),
      }, { dedupeKey: `payment-confirmed-${paymentId}` }))
      if (!needsStamp) {
        await bestEffort(t, 'receipt_customer', (s) => enqueue(s, 'receipt_customer', customer.email as string, {
          customer_name: customer.name, document_number: number, verify_url: `${baseUrl}/verify/${token}`,
        }, { attachmentKind: 'receipt', attachmentId: receiptId, dedupeKey: `receipt-send-${receiptId}` }))
      }
    }
    await recordAudit(t, actorId, 'confirm-cleared-payment', 'payment', paymentId, `Invoice ${inv.number}; receipt ${number}; ${status}; bank credit confirmed`)
    return { receiptId, invoiceId: inv.id as number, stampRequired: needsStamp }
  })
}

