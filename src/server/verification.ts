import { one } from './data'
import { sha256Hex } from './crypto'

export type DocumentKind = 'invoice' | 'receipt' | 'quotation' | 'prepayment' | 'document' | 'delivery'

/** The QR token of a document is created inside the database function that creates the document (`vr_create_verification`). */
export async function getVerification(kind: DocumentKind, documentId: number) {
  const row = await one('document_verification_tokens', (q) => q.eq('kind', kind).eq('document_id', documentId).order('id'), 'id,token,kind,document_id,revoked')
  return row as { id: number; token: string; kind: string; documentId: number; revoked: boolean } | undefined
}

/** Finds a document by the token printed in its QR code. Only the SHA-256 of the token is stored for lookup. */
export async function findVerification(token: string) {
  if (!token || token.length > 150) return undefined
  const hash = await sha256Hex(token)
  const row = await one('document_verification_tokens', (q) => q.eq('token_hash', hash), 'id,kind,document_id,revoked')
  return row as { id: number; kind: string; documentId: number; revoked: boolean } | undefined
}
