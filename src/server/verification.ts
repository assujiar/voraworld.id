import { randomBytes } from 'node:crypto'
import { sha256Hex } from './crypto'
import type { Db } from './db'

export type DocumentKind = 'invoice' | 'receipt' | 'quotation'

/** Opaque public token for the QR code. Only its SHA-256 is needed for lookup; the token is kept to print the URL. */
export async function createVerification(db: Db, kind: DocumentKind, documentId: number): Promise<string> {
  const token = randomBytes(36).toString('base64url')
  await db`insert into document_verification_tokens (token, token_hash, kind, document_id)
           values (${token}, ${await sha256Hex(token)}, ${kind}, ${documentId})`
  return token
}

export async function getVerification(db: Db, kind: DocumentKind, documentId: number) {
  const [row] = await db`select id, token, kind, document_id, revoked from document_verification_tokens where kind = ${kind} and document_id = ${documentId} order by id limit 1`
  return row as { id: number; token: string; kind: string; documentId: number; revoked: boolean } | undefined
}

export async function findVerification(db: Db, token: string) {
  if (!token || token.length > 150) return undefined
  const [row] = await db`select id, kind, document_id, revoked from document_verification_tokens where token_hash = ${await sha256Hex(token)}`
  return row as { id: number; kind: string; documentId: number; revoked: boolean } | undefined
}
