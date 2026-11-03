/** Direct-SQL assertions for legacy numbering tests. Production uses the Data API RPCs. */
import type { Sql, TransactionSql } from 'postgres'
type Connection = Sql | TransactionSql
export async function ensurePublicCode(sql: Connection, table: 'customers' | 'leads', id: number): Promise<string> {
  const [row] = await sql`select vr_public_code(${table}, ${id}) as code`
  return row.code as string
}
export async function nextNumber(sql: Connection, kind: string, owner: string, issued: string | null = null): Promise<string> {
  const [row] = await sql`select vr_next_number(${kind}, ${owner}, ${issued}::date) as number`
  return row.number as string
}
export async function createVerification(sql: Connection, kind: string, id: number): Promise<string> {
  const [row] = await sql`select vr_create_verification(${kind}, ${id}) as token`
  return row.token as string
}
