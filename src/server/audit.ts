import type { Db } from './db'

export async function recordAudit(db: Db, actorId: number | null, verb: string, objectType: string, objectId: number, summary = ''): Promise<void> {
  await db`insert into audit_logs (actor_id, verb, object_type, object_id, summary)
           values (${actorId}, ${verb}, ${objectType}, ${objectId}, ${String(summary).slice(0, 1000)})`
}
