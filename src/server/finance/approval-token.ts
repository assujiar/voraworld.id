import { createHmac } from 'node:crypto'
import type { Db } from '../db'

/** The random secret generated for this database by migration 0023 (table app_secrets, locked from the Data API). */
export async function approvalSecret(db: Db): Promise<string> {
  const [row] = await db`select value from app_secrets where key = 'approval_link'`
  if (!row) throw new Error('The approval-link secret is missing: apply migration 0023')
  return row.value as string
}

/**
 * The private upload address of an approval request is DERIVED, not stored. That lets the same address be printed into the PDF at
 * any moment (the email attachment, the administrator's download, the customer's own copy) while the database keeps only its
 * SHA-256 and so cannot reveal it. 42 bytes (56 characters) of an HMAC-SHA-512 keyed with the database's own random secret, one per request number.
 */
export function approvalToken(secret: string, approvalId: number): string {
  return createHmac('sha512', secret).update(`vora:quotation-approval-link:v1:${approvalId}`).digest().subarray(0, 42).toString('base64url')
}
