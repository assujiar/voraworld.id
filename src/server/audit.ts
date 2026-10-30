import { insert } from './data'

/** One line in the audit trail. Inside a database function the same row is written by `vr_audit` in the same transaction as the change. */
export async function recordAudit(actorId: number | null, verb: string, objectType: string, objectId: number, summary = ''): Promise<void> {
  await insert('audit_logs', { actor_id: actorId, verb, object_type: objectType, object_id: objectId, summary: String(summary).slice(0, 1000) })
}
