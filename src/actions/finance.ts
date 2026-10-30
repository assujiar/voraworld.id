'use server'
import { ActionError, adminRun, adminRunForm, type FormState } from '@/server/action'
import { afterResponse } from '@/server/after'
import { maxUploadBytes, publicBaseUrl } from '@/server/env'
import { createBank, updateBank, type BankAction } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { createInvoice, sendInvoice, setInvoiceStatus } from '@/server/finance/invoices'
import { cancelPayment, confirmPayment, recordPayment } from '@/server/finance/payments'
import { ensurePrepayment, sendPrepayment, uploadPrepaymentStamp, voidPrepayment } from '@/server/finance/prepayments'
import { createQuotation, requestApproval, reviewApproval, setQuotationStatus } from '@/server/finance/quotations'
import { resendReceipt, uploadReceiptStamp, voidReceipt } from '@/server/finance/receipts'
import { rowsFromForm } from '@/server/form-rows'
import { fileBytes, int, rawStr, str } from '@/server/http'
import { dispatch } from '@/server/mail/outbox'

/** Emails queued by an action go out right after the response, not in the user's wait. The daily cron retries what fails. */
const sendSoon = () => afterResponse(() => dispatch(publicBaseUrl(), 10))
const ids = (form: FormData, key: string, message: string) => form.getAll(key).map((v) => {
  const n = Number.parseInt(String(v), 10)
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) throw new ActionError(message)
  return n
})
const bankFields = (form: FormData) => ({
  bankName: str(form, 'bank_name', 120), accountNumber: str(form, 'account_number', 80), accountHolder: str(form, 'account_holder', 200),
  currency: str(form, 'currency', 3), branch: str(form, 'branch', 150), swiftCode: str(form, 'swift_code', 25), notes: str(form, 'notes', 250),
  makeDefault: form.get('is_default') === '1',
})

// ----------------------------------------------------------------- customers
export async function saveCustomerAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const id = int(form, 'record') || null
    const saved = await saveCustomer(user.id, id, {
      name: rawStr(form, 'name', 201), email: rawStr(form, 'email', 201), phone: rawStr(form, 'phone', 61), address: rawStr(form, 'address', 3000), taxId: rawStr(form, 'tax_id', 101),
      currency: str(form, 'currency', 3), termsDays: str(form, 'terms_days', 4),
      picName: rawStr(form, 'pic_name', 161), picPosition: rawStr(form, 'pic_position', 161), picEmail: rawStr(form, 'pic_email', 201), picPhone: rawStr(form, 'pic_phone', 61),
    }, { acknowledgeDuplicates: form.get('different_customer') === 'yes' })
    return { to: `/admin/customers/${saved}`, notice: 'Customer saved' }
  })
}

// --------------------------------------------------------------- bank accounts
export async function createBankAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    await createBank(user.id, bankFields(form))
    return { to: '/admin/bank-accounts', notice: 'Bank account saved' }
  })
}

export async function updateBankAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const action = str(form, 'action', 10) as BankAction
    await updateBank(user.id, int(form, 'record'), action, action === 'save' ? bankFields(form) : undefined)
    return { to: '/admin/bank-accounts', notice: 'Bank account updated' }
  })
}

// ------------------------------------------------------------------ quotations
export async function createQuotationAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const id = await createQuotation(user.id, {
      customerId: int(form, 'customer_id'), leadId: int(form, 'lead_id') || null,
      issuedAt: str(form, 'issued_at', 10), validUntil: str(form, 'valid_until', 10), taxPercent: str(form, 'tax_percent', 20),
      paymentTerms: rawStr(form, 'payment_terms', 20_000), termsConditions: rawStr(form, 'terms_conditions', 20_000), notes: rawStr(form, 'notes', 2500),
      rows: rowsFromForm(form, 'item', { description: 500, quantity: 30, unit: 30, price: 40 }),
      picName: rawStr(form, 'pic_name', 161), picEmail: rawStr(form, 'pic_email', 201), picPhone: rawStr(form, 'pic_phone', 61),
      serviceMode: rawStr(form, 'service_mode', 121), origin: rawStr(form, 'origin', 241), destination: rawStr(form, 'destination', 241), cargoInfo: rawStr(form, 'cargo_info', 3001),
    })
    return { to: `/admin/quotations/${id}`, notice: 'Quotation draft created' }
  })
}

export async function quotationStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await setQuotationStatus(user.id, id, str(form, 'action', 10))
    return { to: `/admin/quotations/${id}`, notice: 'Quotation state updated' }
  })
}

export async function requestApprovalAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await requestApproval(user.id, id, publicBaseUrl())
    sendSoon()
    return { to: `/admin/quotations/${id}`, notice: 'Approval email queued. Check the SMTP outbox for delivery status' }
  })
}

export async function reviewApprovalAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const quotationId = await reviewApproval(user.id, int(form, 'record'), str(form, 'action', 10), form.get('signature_and_stamp_verified') === 'yes', rawStr(form, 'review_note', 2000))
    sendSoon()
    return { to: `/admin/quotations/${quotationId}`, notice: form.get('action') === 'reject' ? 'The signed document was rejected: the quotation needs correction and can be sent again' : 'Quotation validated: delivery notes can now be made from it' }
  })
}

// -------------------------------------------------------------------- invoices
export async function createInvoiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const id = await createInvoice(user.id, {
      customerId: int(form, 'customer_id'), quotationId: int(form, 'quotation_id'), deliveryIds: ids(form, 'delivery_ids', 'Invalid selected delivery note'),
      issuedAt: str(form, 'issued_at', 10), dueAt: str(form, 'due_at', 10), taxPercent: str(form, 'tax_percent', 20),
      withholdingPercent: str(form, 'withholding_percent', 20), discount: str(form, 'discount', 30), poNumber: str(form, 'po_number', 100),
      shipmentReference: str(form, 'shipment_reference', 120), serviceMode: str(form, 'service_mode', 120), origin: str(form, 'origin', 180),
      destination: str(form, 'destination', 180), transportDocumentRef: str(form, 'transport_document_ref', 150), notes: rawStr(form, 'notes', 2500),
      rows: rowsFromForm(form, 'item', { description: 500, quantity: 30, unit: 30, price: 40 }), bankAccountIds: ids(form, 'bank_account_ids', 'Invalid selected bank account'),
      overQuotationAck: form.get('over_quotation_ack') === 'yes',
    })
    return { to: `/admin/invoices/${id}`, notice: 'Invoice draft created, with its pre-payment receipt' }
  })
}

export async function invoiceStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await setInvoiceStatus(user.id, id, str(form, 'action', 10))
    return { to: `/admin/invoices/${id}`, notice: 'Invoice state updated' }
  })
}

export async function sendInvoiceAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await sendInvoice(user.id, id, publicBaseUrl())
    sendSoon()
    return { to: `/admin/invoices/${id}`, notice: 'The invoice and its pre-payment receipt are queued as one email with two PDFs. Check the SMTP outbox for delivery status' }
  })
}

// -------------------------------------------------------------------- payments
export async function recordPaymentAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const invoiceId = int(form, 'record')
    await recordPayment(user.id, invoiceId, {
      amount: str(form, 'amount', 30), date: str(form, 'date', 10), method: str(form, 'method', 100), reference: str(form, 'reference', 160),
      receivingBankId: int(form, 'receiving_bank_id') || null,
    })
    return { to: `/admin/invoices/${invoiceId}`, notice: 'Payment saved and waiting for bank confirmation. The invoice balance has not changed' }
  })
}

export async function confirmPaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const result = await confirmPayment(user.id, int(form, 'record'), { fundsCleared: form.get('funds_cleared') === 'yes', receivingBankId: int(form, 'receiving_bank_id') || null }, publicBaseUrl())
    sendSoon()
    return {
      to: result.stampRequired ? `/admin/receipts/${result.receiptId}` : `/admin/invoices/${result.invoiceId}`,
      notice: result.stampRequired ? 'Funds confirmed. This receipt needs a manual e-meterai before it is released' : 'Funds confirmed: invoice recalculated, receipt issued, customer emails queued',
    }
  })
}

export async function cancelPaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const invoiceId = await cancelPayment(user.id, int(form, 'record'))
    return { to: `/admin/invoices/${invoiceId}`, notice: 'Pending payment cancelled' }
  })
}

// -------------------------------------------------------------------- receipts
export async function uploadStampAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await uploadReceiptStamp(user.id, id, {
      providerReference: str(form, 'stamp_provider_reference', 160), reviewed: form.get('approved') === '1', file: await fileBytes(form, 'stamped_pdf', maxUploadBytes()),
    }, publicBaseUrl())
    sendSoon()
    return { to: `/admin/receipts/${id}`, notice: 'Stamped receipt stored privately; the customer email is queued' }
  })
}

export async function resendReceiptAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await resendReceipt(user.id, id, publicBaseUrl())
    sendSoon()
    return { to: `/admin/receipts/${id}`, notice: 'The official receipt email is queued again. Check the SMTP outbox for delivery status' }
  })
}

export async function voidReceiptAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await voidReceipt(user.id, id)
    return { to: `/admin/receipts/${id}`, notice: 'Receipt voided: the payment was reversed and the invoice recalculated' }
  })
}

// ------------------------------------------------------- pre-payment receipts
export async function ensurePrepaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const invoiceId = int(form, 'record')
    const id = await ensurePrepayment(user.id, invoiceId)
    return { to: `/admin/prepayment-receipts/${id}`, notice: 'Pre-payment receipt created' }
  })
}

export async function uploadPrepaymentStampAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await uploadPrepaymentStamp(user.id, id, {
      providerReference: str(form, 'stamp_provider_reference', 160), reviewed: form.get('approved') === '1', file: await fileBytes(form, 'stamped_pdf', maxUploadBytes()),
    })
    return { to: `/admin/prepayment-receipts/${id}`, notice: 'Stamped pre-payment receipt stored privately and released' }
  })
}

export async function sendPrepaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await sendPrepayment(user.id, id, publicBaseUrl())
    sendSoon()
    return { to: `/admin/prepayment-receipts/${id}`, notice: 'Pre-payment receipt email queued. Check the SMTP outbox for delivery status' }
  })
}

export async function voidPrepaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await voidPrepayment(user.id, id)
    return { to: `/admin/prepayment-receipts/${id}`, notice: 'Pre-payment receipt voided' }
  })
}
