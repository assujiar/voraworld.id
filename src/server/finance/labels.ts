/** What a person reads for each state, instead of the code stored in the database. */
export const QUOTATION_LABEL: Record<string, string> = {
  draft: 'Draft', issued: 'Issued', awaiting_approval: 'Awaiting customer approval', customer_approved: 'Approved by customer (to validate)', validated: 'Validated',
  rejected: 'Rejected: needs correction', void: 'Void', approved: 'Approved (earlier record)',
}
export const QUOTATION_STATUSES = ['draft', 'issued', 'awaiting_approval', 'customer_approved', 'validated', 'rejected', 'void', 'approved']
export const DELIVERY_LABEL: Record<string, string> = { draft: 'Draft', issued: 'Issued', delivered: 'Delivered (proof recorded)', void: 'Void' }
export const INVOICE_LABEL: Record<string, string> = { draft: 'Draft', issued: 'Issued', partially_paid: 'Partially paid', paid: 'Paid', void: 'Void' }
export const PAYMENT_LABEL: Record<string, string> = { pending_confirmation: 'Menunggu Konfirmasi Pembayaran', recorded: 'Dana diterima (terkonfirmasi)', cancelled: 'Cancelled', void: 'Void' }
