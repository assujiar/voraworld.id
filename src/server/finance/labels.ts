/** What a person reads for each state, instead of the code stored in the database. */
export const QUOTATION_LABEL: Record<string, string> = {
  draft: 'Draft', issued: 'Issued', awaiting_approval: 'Awaiting customer approval', customer_approved: 'Approved by customer (to validate)', validated: 'Validated',
  rejected: 'Rejected: needs correction', void: 'Void', approved: 'Approved (earlier record)',
}
export const QUOTATION_STATUSES = ['draft', 'issued', 'awaiting_approval', 'customer_approved', 'validated', 'rejected', 'void', 'approved']
export const DELIVERY_LABEL: Record<string, string> = { draft: 'Draft', issued: 'Issued (awaiting proof of delivery)', delivered: 'Delivered (proof recorded)', void: 'Void' }
export const INVOICE_LABEL: Record<string, string> = { draft: 'Draft', issued: 'Issued', partially_paid: 'Partially paid', paid: 'Paid', void: 'Void' }
export const PAYMENT_LABEL: Record<string, string> = { pending_confirmation: 'Menunggu Konfirmasi Pembayaran', recorded: 'Dana diterima (terkonfirmasi)', cancelled: 'Cancelled', void: 'Void' }
export const LEAD_LABEL: Record<string, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', quotation_sent: 'Quotation sent', negotiation: 'Negotiation', won: 'Won', lost: 'Lost', archived: 'Archived' }
export const PRIORITY_LABEL: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
/** Official and pre-payment receipts. A receipt that needs an e-meterai is held back until the stamped file is stored. */
export const RECEIPT_LABEL: Record<string, string> = { draft: 'Draft', pending_stamp: 'Menunggu E-Meterai', issued: 'Issued', void: 'Void' }
export const DOCUMENT_LABEL: Record<string, string> = { draft: 'Draft', issued: 'Issued', void: 'Void' }
export const PUBLISH_LABEL: Record<string, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }
/** The customer's approval request of a quotation: what has happened to the link, not the state of the quotation. */
export const APPROVAL_LABEL: Record<string, string> = { pending: 'Waiting for the customer', submitted: 'Signed copy received', approved: 'Validated by VORA', rejected: 'Returned for correction', expired: 'Link expired', revoked: 'Replaced by a newer link' }
export const PROOF_LABEL: Record<string, string> = { submitted: 'Recorded', rejected: 'Rejected', accepted: 'Accepted' }
export const label = (map: Record<string, string>, key: unknown): string => map[String(key)] ?? String(key)
