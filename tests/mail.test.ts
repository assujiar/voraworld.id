import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from '@/server/db'
import { EVENTS, EVENT_KEYS } from '@/server/mail/events'
import { safeSubstitute, renderTemplate } from '@/server/mail/template'
import { decryptSecret, encryptSecret } from '@/server/mail/secret'
import { emailAddress } from '@/server/mail/address'
import { getMailConfig, saveMailConfig } from '@/server/mail/config'
import { dispatch, enqueue, retryJob, MAX_ATTEMPTS } from '@/server/mail/outbox'
import { setSender, type Sender } from '@/server/mail/transport'

process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
const BASE = 'https://testserver'

async function smtp(enabled = true) {
  await saveMailConfig(sql, { host: 'smtp.example.invalid', port: 587, security: 'starttls', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled })
}
async function rule(key: string, enabled = true) { await sql`update email_rules set enabled = ${enabled} where key = ${key}` }

beforeEach(async () => {
  setSender(null)
  await sql`delete from email_jobs`
  await sql`update email_rules set enabled = false`
  await sql`delete from mail_config`
  for (const [key, e] of Object.entries(EVENTS)) await sql`update email_templates set subject = ${e.subject}, html = ${e.html} where key = ${key}`
})

describe('seed data', () => {
  it('the seeding migrations (0014, plus 0021 for the pre-payment receipt) hold exactly the templates and rules the code defines', () => {
    const sqlText = ['0014_seed_email_templates.sql', '0021_prepayment_receipts.sql'].map((f) => readFileSync(`migrations/${f}`, 'utf8')).join('\n')
    const rows = [...sqlText.matchAll(/\('(\w+)', \$vora\$(.*?)\$vora\$, \$vora\$(.*?)\$vora\$\)/gs)]
    expect(Object.fromEntries(rows.map(([, k, s, h]) => [k, { subject: s, html: h }]))).toEqual(EVENTS)
    expect([...sqlText.matchAll(/^\s+\('(\w+)', FALSE\)/gm)].map((m) => m[1]).sort()).toEqual([...EVENT_KEYS].sort())
  })
  it('exist in the database of a fresh install', async () => {
    const t = await sql`select key from email_templates order by key`
    const r = await sql`select key from email_rules order by key`
    expect(t.map((x) => x.key)).toEqual([...EVENT_KEYS].sort())
    expect(r.map((x) => x.key)).toEqual([...EVENT_KEYS].sort())
  })
})

describe('templates', () => {
  it('substitutes like Python string.Template.safe_substitute', () => {
    expect(safeSubstitute('Hi $name, ${name}! $$5 $missing ${also}', { name: 'Ana' })).toBe('Hi Ana, Ana! $5 $missing ${also}')
  })
  it('escapes data in the body, strips line breaks from the subject and sanitises markup', async () => {
    await sql`update email_templates set subject = 'Hello $name', html = ${'<p>Dear $name</p><script>x()</script><a href="javascript:1">l</a>'} where key = 'lead_reply'`
    const out = await renderTemplate(sql, 'lead_reply', { name: '<b>Ana</b>\r\nBcc: evil@example.invalid' })
    expect(out.subject).toBe('Hello <b>Ana</b> Bcc: evil@example.invalid')
    expect(out.subject).not.toMatch(/[\r\n]/)
    expect(out.html).toBe('<p>Dear &lt;b&gt;Ana&lt;/b&gt;<br />Bcc: evil@example.invalid</p><a>l</a>')
    await expect(renderTemplate(sql, 'nope', {})).rejects.toThrow('Missing email template')
    await sql`update email_templates set subject = '   ' where key = 'lead_reply'`
    await expect(renderTemplate(sql, 'lead_reply', {})).rejects.toThrow('subject is empty')
  })
})

describe('secrets and addresses', () => {
  it('encrypt with AES-GCM, detect tampering and a wrong key', () => {
    const c = encryptSecret('p@ss w0rd')
    expect(c).toMatch(/^v1:/); expect(c).not.toContain('p@ss')
    expect(decryptSecret(c)).toBe('p@ss w0rd')
    expect(encryptSecret('p@ss w0rd')).not.toBe(c)
    expect(decryptSecret('')).toBe('')
    const tampered = c.slice(0, -4) + (c.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptSecret(tampered)).toThrow('cannot be decrypted')
    const saved = process.env.MAIL_ENCRYPTION_KEY
    process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    expect(() => decryptSecret(c)).toThrow('cannot be decrypted')
    process.env.MAIL_ENCRYPTION_KEY = 'short'
    expect(() => encryptSecret('x')).toThrow('32 random bytes')
    process.env.MAIL_ENCRYPTION_KEY = ''
    expect(() => encryptSecret('x')).toThrow('MAIL_ENCRYPTION_KEY must be configured')
    process.env.MAIL_ENCRYPTION_KEY = saved
  })
  it('accept only plain addresses', () => {
    expect(emailAddress(' info@voraworld.id ')).toBe('info@voraworld.id')
    for (const bad of ['', 'x', 'Name <a@b.co>', 'a@b', 'a b@c.co', 'a@b.co,c@d.co', 'a@b.co\r\nBcc: x@y.co', 'a@@b.co']) expect(() => emailAddress(bad)).toThrow('Invalid plain email address')
  })
})

describe('SMTP settings', () => {
  it('validate input, keep a blank password and never store it in plain text', async () => {
    await saveMailConfig(sql, { host: 'SMTP.Example.Invalid', username: 'u', password: 'secret-pw', enabled: true, adminEmail: 'ops@example.invalid' })
    let conf = (await getMailConfig(sql))!
    expect(conf).toMatchObject({ host: 'smtp.example.invalid', port: 587, security: 'starttls', enabled: true })
    expect(conf.encryptedPassword).not.toContain('secret-pw')
    expect(decryptSecret(conf.encryptedPassword!)).toBe('secret-pw')
    const before = conf.encryptedPassword
    await saveMailConfig(sql, { host: 'smtp.example.invalid', username: 'u', password: '', enabled: true })
    conf = (await getMailConfig(sql))!
    expect(conf.encryptedPassword).toBe(before)
    await expect(saveMailConfig(sql, { host: 'bad host!' })).rejects.toThrow('Invalid SMTP hostname')
    await expect(saveMailConfig(sql, { host: 'a.co', port: 70000 })).rejects.toThrow('Invalid SMTP port')
    await expect(saveMailConfig(sql, { host: 'a.co', security: 'none' })).rejects.toThrow('STARTTLS or implicit TLS')
    await expect(saveMailConfig(sql, { host: '', enabled: true })).rejects.toThrow('must be configured before enabling')
    await expect(saveMailConfig(sql, { host: 'a.co', fromEmail: 'nope' })).rejects.toThrow('Invalid plain email address')
  })
})

describe('enqueue', () => {
  const ctx = { name: 'Ana', lead_id: '7', reply_message: 'Hello' }
  it('does nothing while the rule or SMTP is off, and is idempotent per dedupe key', async () => {
    expect(await enqueue(sql, 'lead_reply', 'a@example.invalid', ctx)).toBeNull()   // no SMTP
    await smtp()
    expect(await enqueue(sql, 'lead_reply', 'a@example.invalid', ctx)).toBeNull()   // rule disabled
    await rule('lead_reply')
    const a = await enqueue(sql, 'lead_reply', 'a@example.invalid', ctx, { dedupeKey: 'k1' })
    const b = await enqueue(sql, 'lead_reply', 'a@example.invalid', ctx, { dedupeKey: 'k1' })
    expect(a!.id).toBe(b!.id)
    const [{ n }] = await sql`select count(*)::int as n from email_jobs`
    expect(n).toBe(1)
    expect((await enqueue(sql, 'lead_reply', 'a@example.invalid', ctx, { force: true }))).not.toBeNull()
    await expect(enqueue(sql, 'lead_reply', 'bad address', ctx, { force: true })).rejects.toThrow('Invalid plain email address')
  })
  it('survives concurrent duplicate enqueues', async () => {
    await smtp(); await rule('lead_reply')
    const jobs = await Promise.all(Array.from({ length: 8 }, () => enqueue(sql, 'lead_reply', 'a@example.invalid', ctx, { dedupeKey: 'race' })))
    expect(new Set(jobs.map((j) => j!.id)).size).toBe(1)
  })
})

describe('dispatch', () => {
  const ctx = { name: 'Ana', lead_id: '7', reply_message: 'Hello' }
  const seed = async (n: number) => { for (let i = 0; i < n; i++) await enqueue(sql, 'lead_reply', `c${i}@example.invalid`, ctx, { dedupeKey: `d${i}` }) }

  it('sends queued mail and records the result', async () => {
    await smtp(); await rule('lead_reply'); await seed(3)
    const sent: string[] = []
    setSender(async (_c, to) => { sent.push(to) })
    expect(await dispatch(BASE)).toEqual({ sent: 3, failed: 0 })
    expect(sent.sort()).toEqual(['c0@example.invalid', 'c1@example.invalid', 'c2@example.invalid'])
    const rows = await sql`select status, attempts, error, sent_at from email_jobs`
    expect(rows.every((r) => r.status === 'sent' && r.attempts === 1 && r.error === '' && r.sentAt)).toBe(true)
    expect(await dispatch(BASE)).toEqual({ sent: 0, failed: 0 })
  })
  it('reports SMTP disabled without touching the queue', async () => {
    await smtp(false); await rule('lead_reply')
    expect(await dispatch(BASE)).toEqual({ sent: 0, failed: 0, reason: 'SMTP disabled' })
  })
  it('backs off after each failure and parks the message as failed after five attempts', async () => {
    await smtp(); await rule('lead_reply'); await seed(1)
    setSender(async () => { throw new Error('smtp.example.invalid refused the connection') })
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await sql`update email_jobs set next_attempt_at = now() - interval '1 second'`
      expect((await dispatch(BASE)).failed).toBe(1)
      const [job] = await sql`select status, attempts, error, next_attempt_at from email_jobs`
      expect(job).toMatchObject({ attempts: attempt, status: attempt === MAX_ATTEMPTS ? 'failed' : 'retry' })
      expect(job.error).toContain('refused')
      expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now())
    }
    await sql`update email_jobs set next_attempt_at = now() - interval '1 second'`
    expect(await dispatch(BASE)).toEqual({ sent: 0, failed: 0 })            // failed jobs are not retried automatically
  })
  it('never sends one message twice when two workers run at once', async () => {
    await smtp(); await rule('lead_reply'); await seed(12)
    const sent: string[] = []
    const slow: Sender = async (_c, to) => { await new Promise((r) => setTimeout(r, 20)); sent.push(to) }
    setSender(slow)
    const results = await Promise.all([dispatch(BASE, 30), dispatch(BASE, 30), dispatch(BASE, 30)])
    expect(results.reduce((a, r) => a + r.sent, 0)).toBe(12)
    expect(sent).toHaveLength(12)
    expect(new Set(sent).size).toBe(12)
  })
  it('re-claims a job whose worker died (expired lease) but not one still being worked on', async () => {
    await smtp(); await rule('lead_reply'); await seed(2)
    await sql`update email_jobs set status = 'sending', next_attempt_at = now() + interval '5 minutes' where id = (select min(id) from email_jobs)`
    await sql`update email_jobs set status = 'sending', next_attempt_at = now() - interval '1 minute' where id = (select max(id) from email_jobs)`
    setSender(async () => {})
    expect(await dispatch(BASE)).toEqual({ sent: 1, failed: 0 })
  })
  it('retryJob re-queues only failed or waiting messages', async () => {
    await smtp(); await rule('lead_reply'); await seed(1)
    const [{ id }] = await sql`select id from email_jobs`
    const [{ uid }] = await sql`insert into users (email, password_hash, role) values ('r@invalid.example', 'x', 'admin') returning id as uid`
    await expect(retryJob(uid, id)).rejects.toThrow('Only failed or waiting')          // still queued
    await sql`update email_jobs set status = 'failed', attempts = 5, error = 'boom'`
    await retryJob(uid, id)
    expect((await sql`select status, attempts, error from email_jobs`)[0]).toMatchObject({ status: 'queued', attempts: 0, error: '' })
    await expect(retryJob(uid, 999999)).rejects.toThrow('Message not found')
    expect((await sql`select count(*)::int as n from audit_logs where verb = 'retry'`)[0].n).toBe(1)
  })
  it('does not attach documents that are not eligible', async () => {
    await smtp(); await rule('invoice_customer')
    const [c] = await sql`insert into customers (name) values ('X') returning id`
    const [inv] = await sql`insert into invoices (number, customer_id, status, issued_at) values ('INV-X', ${c.id}, 'draft', '2026-01-01') returning id`
    await enqueue(sql, 'invoice_customer', 'a@example.invalid', { customer_name: 'X' }, { attachmentKind: 'invoice', attachmentId: inv.id, dedupeKey: 'att' })
    const spy = vi.fn(async () => {}); setSender(spy)
    expect((await dispatch(BASE)).failed).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    expect((await sql`select error from email_jobs`)[0].error).toContain('not eligible')
  })
})
