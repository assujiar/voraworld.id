import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveMailConfig } from '@/server/mail/config'
import { sql } from '@/server/db'
import { setupChecklist } from '@/server/setup-check'

const KEYS = ['APP_ENV', 'PUBLIC_BASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MAIL_ENCRYPTION_KEY', 'CRON_SECRET']
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } })
beforeEach(async () => { await sql`truncate bank_accounts, users, mail_config restart identity cascade`; await sql`update email_rules set enabled = false`; await put('privacy', ''); await put('terms', '') })
const put = (key: string, value: string) => sql`insert into settings (key, value) values (${key}, ${value}) on conflict (key) do update set value = excluded.value`
const by = async () => Object.fromEntries((await setupChecklist()).map((c) => [c.id, c]))

describe('setup checklist', () => {
  it('starts with everything to do on a fresh, unconfigured server', async () => {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.MAIL_ENCRYPTION_KEY; delete process.env.CRON_SECRET
    process.env.APP_ENV = 'development'; process.env.PUBLIC_BASE_URL = 'http://localhost:3000'
    const c = await by()
    for (const id of ['mode', 'https', 'storage', 'encryption', 'cron', 'smtp', 'rules', 'bank', 'legal', 'admin']) expect(c[id].ok, id).toBe(false)
    expect(c.company.ok).toBe(true)                      // the approved company details are seeded
    for (const check of Object.values(c)) if (!check.ok) expect(check.hint.length).toBeGreaterThan(20)
  })

  it('turns each item green when it is really done', async () => {
    process.env.APP_ENV = 'production'; process.env.PUBLIC_BASE_URL = 'https://voraworld.id'
    process.env.SUPABASE_URL = 'https://abc.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_x'
    process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64'); process.env.CRON_SECRET = 'c'.repeat(40)
    await saveMailConfig(sql, { host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
    await sql`update email_rules set enabled = true where key = 'invoice_customer'`
    await sql`insert into bank_accounts (bank_name, account_number, account_holder, currency, active, is_default, position) values ('B', '1234567890', 'PT', 'IDR', true, true, 1)`
    await put('privacy', '<p>Privacy text</p>'); await put('terms', '<p>Terms text</p>')
    await sql`insert into users (email, password_hash, role, active) values ('a@x.invalid', 'x', 'admin', true)`
    const c = await by()
    expect(Object.values(c).filter((x) => !x.ok).map((x) => x.id)).toEqual([])
  })

  it('does not accept look-alikes: a short cron secret, a bad key, empty legal HTML, a disabled bank or admin', async () => {
    process.env.CRON_SECRET = 'short'; process.env.MAIL_ENCRYPTION_KEY = 'not-base64-32-bytes'
    await put('privacy', '<p> </p>'); await put('terms', '<p>ok</p>')
    await sql`insert into bank_accounts (bank_name, account_number, account_holder, currency, active, is_default, position) values ('B', '1234567890', 'PT', 'IDR', false, false, 1)`
    await sql`insert into users (email, password_hash, role, active) values ('a@x.invalid', 'x', 'finance', true), ('b@x.invalid', 'x', 'admin', false)`
    await saveMailConfig(sql, { host: 'smtp.example.invalid', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: false })
    const c = await by()
    for (const id of ['cron', 'encryption', 'legal', 'bank', 'admin', 'smtp']) expect(c[id].ok, id).toBe(false)
  })

  it('never puts a configured value into its answer', async () => {
    const secrets = ['sb_secret_SENTINEL_VALUE_123', 'https://sentinel-project.supabase.co', 'cron-secret-SENTINEL-' + 'x'.repeat(30), randomBytes(32).toString('base64')]
    process.env.SUPABASE_SERVICE_ROLE_KEY = secrets[0]; process.env.SUPABASE_URL = secrets[1]; process.env.CRON_SECRET = secrets[2]; process.env.MAIL_ENCRYPTION_KEY = secrets[3]
    process.env.PUBLIC_BASE_URL = 'https://sentinel-domain.example'
    const text = JSON.stringify(await setupChecklist())
    for (const s of [...secrets, 'sentinel-domain.example']) expect(text).not.toContain(s)
  })
})
