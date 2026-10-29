'use server'
import { ActionError, adminRun, adminRunForm, type FormState } from '@/server/action'
import { afterResponse } from '@/server/after'
import { maxUploadBytes, publicBaseUrl } from '@/server/env'
import { createBank, updateBank, type BankAction } from '@/server/finance/banks'
import { saveCustomer } from '@/server/finance/customers'
import { createInvoice, sendInvoice, setInvoiceStatus } from '@/server/finance/invoices'
import { cancelPayment, confirmPayment, recordPayment } from '@/server/finance/payments'
import { createQuotation, requestApproval, reviewApproval, setQuotationStatus } from '@/server/finance/quotations'
import { uploadReceiptStamp, voidReceipt } from '@/server/finance/receipts'
import { fileBytes, int, rawStr, str } from '@/server/http'
import { dispatch } from '@/server/mail/outbox'

/** Emails queued by an action go out right after the response, not in the user's wait. The daily cron retries what fails. */
const sendSoon = () => afterResponse(() => dispatch(publicBaseUrl(), 10))
const ids = (form: FormData, key: string) => form.getAll(key).map((v) => {
  const n = Number.parseInt(String(v), 10)
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) throw new ActionError('Invalid selected bank account')
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
    const id = int(form, 'id') || null
    const saved = await saveCustomer(user.id, id, {
      name: str(form, 'name', 200), email: str(form, 'email', 200), address: rawStr(form, 'address', 3000), taxId: str(form, 'tax_id', 100),
      currency: str(form, 'currency', 3), termsDays: str(form, 'terms_days', 4),
    })
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
    await updateBank(user.id, int(form, 'id'), action, action === 'save' ? bankFields(form) : undefined)
    return { to: '/admin/bank-accounts', notice: 'Bank account updated' }
  })
}

// ------------------------------------------------------------------ quotations
export async function createQuotationAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const id = await createQuotation(user.id, {
      recipient: str(form, 'recipient', 30), issuedAt: str(form, 'issued_at', 10), validUntil: str(form, 'valid_until', 10), taxPercent: str(form, 'tax_percent', 20),
      notes: rawStr(form, 'notes', 2500), items: rawStr(form, 'items', 30_000),
    })
    return { to: `/admin/quotations/${id}`, notice: 'Quotation draft created' }
  })
}

export async function quotationStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'id')
    await setQuotationStatus(user.id, id, str(form, 'action', 10))
    return { to: `/admin/quotations/${id}`, notice: 'Quotation state updated' }
  })
}

export async function requestApprovalAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'id')
    await requestApproval(user.id, id, publicBaseUrl())
    sendSoon()
    return { to: `/admin/quotations/${id}`, notice: 'Approval email queued. Check the SMTP outbox for delivery status' }
  })
}

export async function reviewApprovalAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const quotationId = await reviewApproval(user.id, int(form, 'id'), str(form, 'action', 10), form.get('signature_and_stamp_verified') === 'yes', rawStr(form, 'review_note', 2000))
    sendSoon()
    return { to: `/admin/quotations/${quotationId}`, notice: 'Customer document reviewed; quotation status updated' }
  })
}

// -------------------------------------------------------------------- invoices
export async function createInvoiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const id = await createInvoice(user.id, {
      customerId: int(form, 'customer_id'), issuedAt: str(form, 'issued_at', 10), dueAt: str(form, 'due_at', 10), taxPercent: str(form, 'tax_percent', 20),
      withholdingPercent: str(form, 'withholding_percent', 20), discount: str(form, 'discount', 30), poNumber: str(form, 'po_number', 100),
      shipmentReference: str(form, 'shipment_reference', 120), serviceMode: str(form, 'service_mode', 120), origin: str(form, 'origin', 180),
      destination: str(form, 'destination', 180), transportDocumentRef: str(form, 'transport_document_ref', 150), notes: rawStr(form, 'notes', 2500),
      items: rawStr(form, 'items', 30_000), bankAccountIds: ids(form, 'bank_account_ids'),
    })
    return { to: `/admin/invoices/${id}`, notice: 'Invoice draft created' }
  })
}

export async function invoiceStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'id')
    await setInvoiceStatus(user.id, id, str(form, 'action', 10))
    return { to: `/admin/invoices/${id}`, notice: 'Invoice state updated' }
  })
}

export async function sendInvoiceAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'id')
    await sendInvoice(user.id, id, publicBaseUrl())
    sendSoon()
    return { to: `/admin/invoices/${id}`, notice: 'Invoice email queued. Check the SMTP outbox for delivery status' }
  })
}

// -------------------------------------------------------------------- payments
export async function recordPaymentAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const invoiceId = int(form, 'id')
    await recordPayment(user.id, invoiceId, {
      amount: str(form, 'amount', 30), date: str(form, 'date', 10), method: str(form, 'method', 100), reference: str(form, 'reference', 160),
      receivingBankId: int(form, 'receiving_bank_id') || null,
    })
    return { to: `/admin/invoices/${invoiceId}`, notice: 'Payment saved and waiting for bank confirmation. The invoice balance has not changed' }
  })
}

export async function confirmPaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const result = await confirmPayment(user.id, int(form, 'id'), { fundsCleared: form.get('funds_cleared') === 'yes', receivingBankId: int(form, 'receiving_bank_id') || null }, publicBaseUrl())
    sendSoon()
    return {
      to: result.stampRequired ? `/admin/receipts/${result.receiptId}` : `/admin/invoices/${result.invoiceId}`,
      notice: result.stampRequired ? 'Funds confirmed. This receipt needs a manual e-meterai before it is released' : 'Funds confirmed: invoice recalculated, receipt issued, customer emails queued',
    }
  })
}

export async function cancelPaymentAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const invoiceId = await cancelPayment(user.id, int(form, 'id'))
    return { to: `/admin/invoices/${invoiceId}`, notice: 'Pending payment cancelled' }
  })
}

// -------------------------------------------------------------------- receipts
export async function uploadStampAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'id')
    await uploadReceiptStamp(user.id, id, {
      providerReference: str(form, 'stamp_provider_reference', 160), reviewed: form.get('approved') === '1', file: await fileBytes(form, 'stamped_pdf', maxUploadBytes()),
    }, publicBaseUrl())
    sendSoon()
    return { to: `/admin/receipts/${id}`, notice: 'Stamped receipt stored privately; the customer email is queued' }
  })
}

export async function voidReceiptAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'id')
    await voidReceipt(user.id, id)
    return { to: `/admin/receipts/${id}`, notice: 'Receipt voided: the payment was reversed and the invoice recalculated' }
  })
}
