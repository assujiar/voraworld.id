import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { runMigrations } from '../scripts/lib/migrations'
import { authAdmin, ensureAuthAccount } from './helpers/auth'

/**
 * What migration 0023 adds, on a database that has the REAL `auth` schema of Supabase Auth next to VORA's tables, with Supabase's own roles
 * (anon, authenticated, service_role) and its default privileges: the situation inside a Supabase project.
 */
let db: postgres.Sql
beforeAll(async () => {
  db = postgres(inject('authDatabaseUrl'), { max: 1, onnotice: () => undefined })
  await db.unsafe(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
                   alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
                   alter default privileges in schema public grant all on functions to anon, authenticated, service_role`)
  await runMigrations(db, { apply: true })
})
afterAll(async () => { await db.end({ timeout: 5 }) })

const asRole = async <T>(role: 'anon' | 'authenticated', run: (c: postgres.Sql) => Promise<T>): Promise<T> => {
  const c = postgres(inject('authDatabaseUrl'), { max: 1, onnotice: () => undefined, connection: { role } })
  try { return await run(c) } finally { await c.end({ timeout: 5 }) }
}

describe('promote_admin and deactivate_admin', () => {
  it('turn an existing Supabase Auth account into a portal administrator, and back, with an audit trail', async () => {
    const id = await ensureAuthAccount('first-admin@vora.test', 'A-very-long-first-password-1')
    expect((await db`select count(*)::int as n from users where email = 'first-admin@vora.test'`)[0].n).toBe(0)     // having an Auth account is not access
    const [{ msg }] = await db`select public.promote_admin('  First-Admin@VORA.test ') as msg`
    expect(msg).toContain('first-admin@vora.test')
    const [u] = await db`select id, role, active, auth_user_id as "authUserId" from users where email = 'first-admin@vora.test'`
    expect(u).toMatchObject({ role: 'admin', active: true, authUserId: id })
    await db`select public.promote_admin('first-admin@vora.test')`                                                   // idempotent
    expect((await db`select count(*)::int as n from users where email = 'first-admin@vora.test'`)[0].n).toBe(1)

    await db`select public.deactivate_admin('first-admin@vora.test')`
    expect((await db`select active from users where email = 'first-admin@vora.test'`)[0].active).toBe(false)
    await db`select public.promote_admin('first-admin@vora.test')`
    expect((await db`select active from users where email = 'first-admin@vora.test'`)[0].active).toBe(true)
    const verbs = (await db`select verb from audit_logs where object_type = 'user' and object_id = ${u.id} order by id`).map((r) => r.verb)
    expect(verbs).toEqual(['promote-admin', 'promote-admin', 'deactivate-admin', 'promote-admin'])
  })

  it('refuses an address that has no Supabase Auth account, and one that was deleted', async () => {
    await expect(db`select public.promote_admin('nobody@vora.test')`).rejects.toThrow(/No Supabase Auth account/)
    await expect(db`select public.promote_admin('   ')`).rejects.toThrow(/email address is required/)
    const id = await ensureAuthAccount('leaver@vora.test', 'A-very-long-leaver-password-1')
    await authAdmin().deleteUser(id)
    await expect(db`select public.promote_admin('leaver@vora.test')`).rejects.toThrow(/No Supabase Auth account/)
    await expect(db`select public.deactivate_admin('never-promoted@vora.test')`).rejects.toThrow(/No portal account/)
  })

  it('cannot be run through the Data API: anon and authenticated may not execute them', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(asRole(role, (c) => c`select public.promote_admin('first-admin@vora.test')`), role).rejects.toThrow(/permission denied/)
      await expect(asRole(role, (c) => c`select public.deactivate_admin('first-admin@vora.test')`), role).rejects.toThrow(/permission denied/)
    }
  })
})

describe('the membership and secret tables are closed to the Data API', () => {
  it.each(['users', 'app_secrets', 'login_attempts', 'audit_logs', 'invoices', 'payments', 'receipts', 'documents', 'prepayment_receipts'])('anon and authenticated can read and write nothing in %s', async (table) => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(asRole(role, (c) => c.unsafe(`select * from public.${table} limit 1`)), `${role} select ${table}`).rejects.toThrow(/permission denied/)
      await expect(asRole(role, (c) => c.unsafe(`delete from public.${table}`)), `${role} delete ${table}`).rejects.toThrow(/permission denied/)
    }
  })
  it('keeps the approval-link secret random, long and unique to this database', async () => {
    const [{ value }] = await db`select value from app_secrets where key = 'approval_link'`
    expect(String(value)).toMatch(/^[0-9a-f]{64}$/)
  })
})
