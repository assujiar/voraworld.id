import { PDFDocument } from 'pdf-lib'
import { one } from '../data'
import { ActionError } from '../errors'
import type { DocumentKind } from '../verification'
import { isTrustKind, trustPolicy } from '../../content/trust-policy'
import { issueArtifact, latestArtifact, readArtifact } from './artifacts'

/**
 * The single gate every issued PDF passes through. A document in an issued state, created after the trust system started, is archived the first time its PDF
 * is made and from then on is served from the archive: the bytes never change again, whatever happens to the document's business status afterwards. A document
 * in any other state (a draft, a void document) and a document created before the system started are rendered live, exactly as before.
 */

/** Which statuses of each kind of document are "issued": the file is final and is archived. */
const ISSUED_STATES: Record<DocumentKind, readonly string[]> = {
  invoice: ['issued', 'partially_paid', 'paid'],
  quotation: ['issued', 'awaiting_approval', 'approved', 'validated'],
  receipt: ['issued'],
  prepayment: ['issued'],
  document: ['issued'],
  delivery: ['issued', 'delivered'],
  pod: ['issued', 'delivered'],
}

export interface ArchiveCandidate { status: string; createdAt: Date | string | null; /** A receipt that needs an e-meterai is released as the stamped file the administrator uploaded, which has its own stored fingerprint. */ stampRequired?: boolean }

/** Pure: is this document to be archived? `cutoff` is when the system started (an ISO time), null when it has not been enabled. */
export function archiveEligible(kind: DocumentKind, d: ArchiveCandidate, cutoff: string | null, documentKind?: string): boolean {
  if (trustPolicy(kind, documentKind).archive === 'live') return false
  if (!cutoff || !ISSUED_STATES[kind].includes(d.status) || d.stampRequired) return false
  const created = d.createdAt ? new Date(d.createdAt).getTime() : NaN
  return Number.isFinite(created) && created >= new Date(cutoff).getTime()
}

/** When the trust system started (settings.trust_enabled_at, written once by migration 0029); null if the migration has not been applied. */
export async function trustStartedAt(): Promise<string | null> {
  const row = await one('settings', (q) => q.eq('key', 'trust_enabled_at'), 'value')
  return row ? String(row.value) : null
}

export interface TrustedPdfInput {
  kind: DocumentKind; id: number; number: string
  /** documents.kind, for a general document: it decides the policy. */
  documentKind?: string
  candidate: ArchiveCandidate
  actorId?: number | null
  sourceSha256?: string | null
  /** Makes the file. */
  render: () => Promise<Uint8Array>
}

export async function trustedPdf(i: TrustedPdfInput): Promise<Uint8Array> {
  if (!archiveEligible(i.kind, i.candidate, await trustStartedAt(), i.documentKind)) return i.render()
  const existing = await latestArtifact(i.kind, i.id)
  if (existing) return readArtifact(existing)
  const bytes = await i.render()
  try {
    await issueArtifact({
      kind: i.kind, documentId: i.id, number: i.number, documentType: i.documentKind ?? i.kind, bytes, pages: (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount(),
      role: 'issued', actorId: i.actorId ?? null, sourceSha256: i.sourceSha256 ?? null, summary: { policy: trustPolicy(isTrustKind(i.kind) ? i.kind : 'document', i.documentKind).family },
    })
    return bytes
  } catch (e) {
    // Another request archived it first (409): serve what won, so that every caller gets the same bytes.
    if (e instanceof ActionError && e.status === 409) { const won = await latestArtifact(i.kind, i.id); if (won) return readArtifact(won) }
    throw e
  }
}
