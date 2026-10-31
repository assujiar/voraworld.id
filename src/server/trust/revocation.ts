import { rpc } from '../data'
import type { DocumentKind } from '../verification'

/**
 * Writes the evidence event for a document that was voided. The existing void functions already revoke the QR token (so the verification page says REVOKED at once);
 * this adds the time, the reason and the entry in the document's evidence history. It never undoes or blocks the void: a failure here is logged, because the void
 * (and so the revocation of the QR record) has already happened and is what matters most.
 */
export async function recordVoided(actorId: number, kind: DocumentKind, id: number, reason = 'Voided by an administrator'): Promise<void> {
  try {
    await rpc('trust_revoke', { p_actor: actorId, p_kind: kind, p_document: id, p_reason: reason })
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status !== 404) console.error(`[trust] could not record the revocation of ${kind} ${id}:`, e instanceof Error ? e.message : e)    // 404: it never had a verification record
  }
}
