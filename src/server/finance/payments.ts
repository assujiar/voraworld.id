import { one, rpc } from '../data'
import { isIsoDay, today } from '../dates'
import { ActionError } from '../errors'
import { enqueue } from '../mail/outbox'
import { money, units } from '../money'
import { bestEffort } from './notify'
import { requiresStamp } from './pdf-inspect'
import { moneyErrors } from './parse'

export interface PaymentInput { amount: string; date: string; method: string; reference: string; receivingBankId: number | null }

/**
 * Records a payment CLAIM. Nothing is credited: the invoice balance stays unchanged and no receipt exists until
 * Finance confirms that the money reached the company's bank account. Open claims reserve part of the balance,
 * so two people cannot claim the same money twice. The balance is checked again under a row lock in `payment_record`.
 */
export async function recordPayment(actorId: number, invoiceId: number, input: PaymentInput): Promise<number> {
  const inv = await one('invoices', (q) => q.eq('id', invoiceId), 'id,currency,status')
  if (!inv) throw new ActionError('Invoice not found', 404)
  if (!['issued', 'partially_paid'].includes(inv.status as string)) throw new ActionError('The invoice must be issued and have an unpaid balance', 409)
  const amount = moneyErrors(() => units(input.amount, inv.currency as string))
  const date = input.date.trim() || today()
  if (!isIsoDay(date)) throw new ActionError('Payment date must be a valid date (YYYY-MM-DD)')
  return rpc<number>('payment_record', {
    p_actor: actorId, p_invoice: invoiceId, p_amount: amount, p_date: date,
    p_method: input.method.trim().slice(0, 100) || 'bank transfer', p_reference: input.reference.trim().slice(0, 160), p_bank: input.receivingBankId,
  })
}

export async function cancelPayment(actorId: number, paymentId: number): Promise<number> {
  return rpc<number>('payment_cancel', { p_actor: actorId, p_payment: paymentId })
}

export interface Confirmation { receiptId: number; invoiceId: number; stampRequired: boolean }

interface Confirmed {
  receipt_id: number; receipt_number: string; token: string; invoice_id: number; invoice_number: string; currency: string; invoice_status: string
  outstanding_minor: number; stamp_required: boolean
  payment: { amount_minor: number; date: string; reference: string }
  customer: { id: number; name: string; email: string }
}

/**
 * Finance confirms that the funds are credited. ONE database function (`payment_confirm`) does it in a single transaction, under row locks
 * (invoice first, then payment, the same order everywhere): the payment becomes recorded, the invoice balance and status are recomputed, the
 * receipt and its verification link are created. Concurrent confirmations of the same payment: exactly one succeeds. The customer emails are
 * queued afterwards, and a mail problem never undoes the accounting.
 */
export async function confirmPayment(actorId: number, paymentId: number, input: { fundsCleared: boolean; receivingBankId: number | null }, baseUrl: string): Promise<Confirmation> {
  if (!input.fundsCleared) throw new ActionError('Confirm that the funds are credited to the bank account before a receipt is issued')
  const p = await one('payments', (q) => q.eq('id', paymentId), 'invoice_id,amount_minor')
  if (!p) throw new ActionError('Payment not found', 404)
  const inv = await one('invoices', (q) => q.eq('id', p.invoiceId as number), 'currency')
  const needsStamp = requiresStamp(inv!.currency as string, p.amountMinor as number)
  const r = await rpc<Confirmed>('payment_confirm', { p_actor: actorId, p_payment: paymentId, p_bank: input.receivingBankId, p_stamp_required: needsStamp })

  const email = r.customer.email
  if (email) {
    await bestEffort('payment_confirmed', () => enqueue('payment_confirmed', email, {
      customer_name: r.customer.name, invoice_number: r.invoice_number, payment_amount: money(r.payment.amount_minor, r.currency), payment_date: r.payment.date,
      payment_reference: r.payment.reference || 'Not provided', invoice_status: r.invoice_status === 'paid' ? 'OFFICIALLY PAID' : 'PARTIALLY PAID',
      outstanding_amount: money(r.outstanding_minor, r.currency),
    }, { dedupeKey: `payment-confirmed-${paymentId}` }))
    if (!needsStamp) {
      await bestEffort('receipt_customer', () => enqueue('receipt_customer', email, {
        customer_name: r.customer.name, document_number: r.receipt_number, invoice_number: r.invoice_number, payment_amount: money(r.payment.amount_minor, r.currency),
        payment_date: r.payment.date, verify_url: `${baseUrl}/verify/${r.token}`,
      }, { attachmentKind: 'receipt', attachmentId: r.receipt_id, dedupeKey: `receipt-send-${r.receipt_id}` }))
    }
  }
  return { receiptId: r.receipt_id, invoiceId: r.invoice_id, stampRequired: needsStamp }
}
