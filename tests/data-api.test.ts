import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { ActionError } from '@/server/errors'
import { count, ilikeValue, insert, many, one, remove, rpc, slice, update, upsert } from '@/server/data'
import { setupChecklist } from '@/server/setup-check'
import { sql } from './helpers/db'

/**
 * The server's only road to the database is the Supabase Data API. These tests run against a real PostgREST on a database that has the roles and
 * default privileges of a Supabase project: what the public keys can reach, what the secret key can, and how rows and errors come back.
 */
const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const asKey = (key: string) => createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } })

describe('who can reach the database', () => {
  it('lets the publishable (anon) key read and write nothing in any application table', async () => {
    const anon = asKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
    const tables = (await sql`select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`).map((r) => r.name as string)
    expect(tables.length).toBeGreaterThan(25)
    for (const t of tables) {
      const read = await anon.from(t).select('*').limit(1)
      expect(read.error?.code, `anon select ${t}`).toBe('42501')               // permission denied
      expect((await anon.from(t).insert({}).select()).error?.code, `anon insert ${t}`).toBe('42501')
      expect((await anon.from(t).delete().not('id', 'is', null)).error, `anon delete ${t}`).toBeTruthy()
    }
  })

  it('lets the publishable key call none of the database functions', async () => {
    const anon = asKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
    const fns = (await sql`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'vr\_%' or p.proname ~ '^(customer|bank|invoice|prepayment|payment|receipt|quotation|approval|mail|delivery)_')`).map((r) => r.name as string)
    expect(fns.length).toBeGreaterThan(25)
    for (const f of fns) {
      const r = await anon.rpc(f, {})
      expect(r.error, `anon rpc ${f}`).toBeTruthy()
      expect(['42501', 'PGRST202'], `anon rpc ${f}: ${r.error?.message}`).toContain(r.error?.code)      // denied, or not even visible
    }
  })

  it('lets the secret key do both, and nothing is callable by PUBLIC', async () => {
    expect(await rpc<string>('vr_today')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const open = await sql`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (p.proname like 'vr\_%' or p.proname ~ '^(customer|bank|invoice|prepayment|payment|receipt|quotation|approval|mail|delivery)_')
        and (has_function_privilege('public', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`
    expect(open.map((r) => r.name)).toEqual([])
  })

  it('pins the search_path of every function and runs none of them with their owner\'s rights', async () => {
    const rows = await sql`select p.proname as name, p.prosecdef as definer, p.proconfig as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (p.proname like 'vr\_%' or p.proname ~ '^(customer|bank|invoice|prepayment|payment|receipt|quotation|approval|mail|delivery)_')`
    for (const r of rows) {
      expect(r.definer, `${r.name} is SECURITY DEFINER`).toBe(false)
      expect((r.config as string[] | null)?.some((c) => c.startsWith('search_path=')), `${r.name} has no pinned search_path`).toBe(true)
    }
  })
})

describe('rows, filters and writes', () => {
  it('returns camelCase rows with Date objects for points in time, and writes snake_case values', async () => {
    const [created] = await insert('customers', { name: 'Data API Customer', currency: 'USD', terms_days: 21 })
    expect(created).toMatchObject({ name: 'Data API Customer', currency: 'USD', termsDays: 21 })
    expect(created.createdAt).toBeInstanceOf(Date)
    const found = await one('customers', (q) => q.eq('id', created.id as number))
    expect(found?.name).toBe('Data API Customer')
    expect(await one('customers', (q) => q.eq('id', 999999))).toBeUndefined()
    const [changed] = await update('customers', { terms_days: 30, tax_id: 'X-1' }, (q) => q.eq('id', created.id as number))
    expect(changed).toMatchObject({ termsDays: 30, taxId: 'X-1' })
    await remove('customers', (q) => q.eq('id', created.id as number))
    expect(await count('customers', (q) => q.eq('name', 'Data API Customer'))).toBe(0)
  })

  it('reads a list longer than the API\'s 1000-row cap in full, and a page on request', async () => {
    await sql`insert into login_attempts (email, ip, succeeded) select 'bulk-' || g || '@x.invalid', '10.0.0.1', false from generate_series(1, 2350) g`
    const all = await many('login_attempts', (q) => q.eq('ip', '10.0.0.1').order('id'))
    expect(all).toHaveLength(2350)
    expect(new Set(all.map((r) => r.id)).size).toBe(2350)
    expect(await count('login_attempts', (q) => q.eq('ip', '10.0.0.1'))).toBe(2350)
    const page = await slice('login_attempts', (q) => q.eq('ip', '10.0.0.1').order('id'), 'id,email', 1000, 5)
    expect(page.map((r) => r.id)).toEqual(all.slice(1000, 1005).map((r) => r.id))
    expect(await many('login_attempts', (q) => q.eq('ip', '10.0.0.1').order('id'), 'id', 3)).toHaveLength(3)
  })

  it('counts tables that have no id column, and fails loudly on a missing table instead of returning 0', async () => {
    // The dashboard counts email_rules, which is keyed by `key`; counting through `id` broke the page after login.
    for (const t of ['email_rules', 'settings', 'email_templates', 'app_secrets']) expect(await count(t), `count ${t}`).toBeGreaterThanOrEqual(0)
    await expect(count('no_such_table')).rejects.toThrow(/no_such_table/)
  })

  it('reads everything the admin dashboard reads', async () => {
    const checks = await setupChecklist()
    expect(checks.map((c) => c.id)).toContain('admin')
    expect(await count('leads', (f) => f.eq('status', 'new'))).toBeGreaterThanOrEqual(0)
    expect(await count('invoices', (f) => f.in('status', ['issued', 'partially_paid']))).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(await many('invoices', (f) => f.order('id', { ascending: false }), 'id,number,status,outstanding_minor,currency', 8))).toBe(true)
  })

  it('upserts on a key and can leave an existing row alone', async () => {
    await upsert('settings', [{ key: 'k1', value: 'one' }, { key: 'k2', value: 'two' }], 'key')
    await upsert('settings', { key: 'k1', value: 'uno' }, 'key')
    expect((await many('settings', (q) => q.in('key', ['k1', 'k2']).order('key'), 'key,value')).map((r) => r.value)).toEqual(['uno', 'two'])
    const kept = await upsert('settings', { key: 'k1', value: 'ignored' }, 'key', true)
    expect(kept).toEqual([])
    expect((await one('settings', (q) => q.eq('key', 'k1')))?.value).toBe('uno')
  })

  it('searches text safely: wildcards typed by a visitor match literally and cannot change the filter', async () => {
    await insert('articles', [
      { slug: 'a-1', title: '100% reliable, really (almost)', excerpt: '', body: '', locale: 'en', status: 'published' },
      { slug: 'a-2', title: '100 percent reliable', excerpt: '', body: '', locale: 'en', status: 'published' },
      { slug: 'a-3', title: 'Under_score', excerpt: '', body: '', locale: 'en', status: 'published' },
      { slug: 'a-4', title: 'UnderXscore', excerpt: '', body: '', locale: 'en', status: 'published' },
    ])
    const find = async (text: string) => (await many('articles', (q) => q.or(`title.ilike.${ilikeValue(text)},excerpt.ilike.${ilikeValue(text)}`).order('slug'), 'slug')).map((r) => r.slug)
    expect(await find('100%')).toEqual(['a-1'])
    expect(await find('under_s')).toEqual(['a-3'])
    expect(await find('reliable, really (almost)')).toEqual(['a-1'])
    expect(await find('x),id.gt.0,(title.ilike.%')).toEqual([])                  // a filter-injection attempt is just text
    expect(await find('"')).toEqual([])
  })
})

describe('database functions', () => {
  it('turn a business refusal raised inside the database (SQLSTATE VRnnn) into an ActionError with that status', async () => {
    const err = await rpc('invoice_set_status', { p_actor: null, p_id: 999999, p_action: 'issue' }).catch((e) => e)
    expect(err).toBeInstanceOf(ActionError)
    expect(err).toMatchObject({ message: 'Invoice not found', status: 404 })
  })

  it('report an unexpected failure as an ordinary error that keeps the SQLSTATE', async () => {
    const err = await rpc('vr_next_number', { p_kind: 'INV', p_owner: 'not-a-code', p_date: null }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(ActionError)
    expect(err.message).toContain('Invalid owner code')
    expect(err.code).toBe('P0001')
  })

  it('surface a unique violation as code 23505', async () => {
    await insert('settings', { key: 'dup', value: 'x' })
    const err = await insert('settings', { key: 'dup', value: 'y' }).catch((e) => e)
    expect(err.code).toBe('23505')
  })
})
