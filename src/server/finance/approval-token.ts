import { createHmac } from 'node:crypto'
import { sessionSecret } from '../env'

/**
 * The private upload address of an approval request is DERIVED, not stored. That lets the same address be printed into the PDF at
 * any moment (the email attachment, the administrator's download, the customer's own copy) while the database keeps only its
 * SHA-256 and so cannot reveal it. 42 bytes (56 characters) of an HMAC-SHA-512 keyed with the server secret, one per request number.
 * Consequence: rotating SESSION_SECRET also ends every open approval link; send a new request.
 */
export function approvalToken(approvalId: number): string {
  return createHmac('sha512', sessionSecret()).update(`vora:quotation-approval-link:v1:${approvalId}`).digest().subarray(0, 42).toString('base64url')
}
