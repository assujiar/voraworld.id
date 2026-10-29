import { describe, expect, it } from 'vitest'
import { sql, tx } from '@/server/db'
import { ensurePublicCode, nextNumber } from '@/server/numbering'
import { createVerification, findVerification, getVerification } from '@/server/verification'
import { cleanHtml } from '@/server/sanitize'
import { settingMap, saveSettings } from '@/server/settings'
import { slugify } from '@/server/slug'

async function customer(name = 'ACME') {
  const [c] = await sql`insert into customers (name) values (${name}) returning id`
  return c.id as number
}
const NUMBER = /^(INV|RCP|QUO)-VORA-[CL][0-9A-F]{10}-\d{6}-\d{5}$/

describe('owner codes', () => {
  it('are random, permanent and stable under concurrent requests', async () => {
    const id = await customer()
    const codes = await Promise.all(Array.from({ length: 12 }, () => ensurePublicCode(sql, 'customers', id)))
    expect(new Set(codes).size).toBe(1)
    expect(codes[0]).toMatch(/^C[0-9A-F]{10}$/)
    expect(await ensurePublicCode(sql, 'customers', id)).toBe(codes[0])
    const other = await ensurePublicCode(sql, 'customers', await customer('OTHER'))
    expect(other).not.toBe(codes[0])
    const [lead] = await sql`insert into leads (name, email) values ('L', 'l@x.invalid') returning id`
    expect(await ensurePublicCode(sql, 'leads', lead.id as number)).toMatch(/^L[0-9A-F]{10}$/)
    await expect(ensurePublicCode(sql, 'customers', 999999)).rejects.toThrow('Owner not found')
  })
})

describe('document numbers', () => {
  it('follow KIND-VORA-OWNER-YYYYMM-RANDOM5 and use the issue month', async () => {
    const code = await ensurePublicCode(sql, 'customers', await customer())
    const n = await tx((t) => nextNumber(t, 'INV', code, '2026-10-29'))
    expect(n).toMatch(NUMBER)
    expect(n.startsWith(`INV-VORA-${code}-202610-`)).toBe(true)
    expect((await tx((t) => nextNumber(t, 'quo', code, '2027-01-02'))).startsWith(`QUO-VORA-${code}-202701-`)).toBe(true)
    await expect(tx((t) => nextNumber(t, 'XYZ', code))).rejects.toThrow('Unsupported document kind')
    await expect(tx((t) => nextNumber(t, 'INV', 'bad-code'))).rejects.toThrow('Invalid owner code')
  })
  it('stay unique when sixteen requests allocate at once', async () => {
    const id = await customer('PARALLEL')
    const code = await ensurePublicCode(sql, 'customers', id)
    const numbers = await Promise.all(Array.from({ length: 16 }, () => tx(async (t) => {
      const number = await nextNumber(t, 'INV', code, '2026-10-29')
      await t`insert into invoices (number, customer_id, issued_at) values (${number}, ${id}, '2026-10-29')`
      return number
    })))
    expect(new Set(numbers).size).toBe(16)
    numbers.forEach((n) => expect(n).toMatch(NUMBER))
  })
  it('retry past collisions and never reuse a number; the database rejects duplicates', async () => {
    const id = await customer('COLLIDE')
    const code = await ensurePublicCode(sql, 'customers', id)
    const scope = `INV-VORA-${code}-202610-`
    // Half of the five-digit space is taken: roughly every second draw collides and must be redrawn.
    await sql`insert into invoices (number, customer_id, issued_at) select ${scope} || lpad(g::text, 5, '0'), ${id}, '2026-10-01' from generate_series(0, 49999) g`
    for (let i = 0; i < 20; i++) {
      const n = await tx((t) => nextNumber(t, 'INV', code, '2026-10-05'))
      expect(Number(n.slice(-5))).toBeGreaterThanOrEqual(50000)
    }
    await expect(sql`insert into invoices (number, customer_id, issued_at) values (${scope + '00000'}, ${id}, '2026-10-01')`).rejects.toThrow(/duplicate key/)
  }, 60_000)
  it('fail explicitly when the month is completely used up', async () => {
    const id = await customer('FULL')
    const code = await ensurePublicCode(sql, 'customers', id)
    await sql`insert into invoices (number, customer_id, issued_at) select ${`INV-VORA-${code}-202611-`} || lpad(g::text, 5, '0'), ${id}, '2026-11-01' from generate_series(0, 99999) g`
    await expect(tx((t) => nextNumber(t, 'INV', code, '2026-11-09'))).rejects.toThrow('Could not allocate a unique five-digit document number')
  }, 60_000)
})

describe('verification tokens', () => {
  it('are opaque, looked up by hash, and revocable', async () => {
    const token = await createVerification(sql, 'invoice', 42)
    expect(token).toMatch(/^[A-Za-z0-9_-]{48}$/)
    expect(await findVerification(sql, token)).toMatchObject({ kind: 'invoice', documentId: 42, revoked: false })
    expect((await getVerification(sql, 'invoice', 42))?.token).toBe(token)
    expect(await findVerification(sql, token + 'x')).toBeUndefined()
    expect(await findVerification(sql, 'x'.repeat(200))).toBeUndefined()
    const [row] = await sql`select token_hash from document_verification_tokens where token = ${token}`
    expect(row.tokenHash).not.toContain(token)
  })
})

describe('sanitizer', () => {
  it('removes scripts, handlers and unsafe URLs but keeps editorial markup', () => {
    const dirty = '<h2 onclick="x()">Title</h2><script>alert(1)</script><p style="x">Hi <a href="javascript:alert(1)">bad</a> <a href="//evil.example">proto</a> <a href="https://ok.example" target="_blank">ok</a> <a href="/en/about">rel</a></p><img src="data:image/png;base64,AAAA" alt="x"><img src="https://img.example/a.png" alt="ok"><iframe src="https://x"></iframe><table><tr><td colspan="2">c</td></tr></table>'
    const clean = cleanHtml(dirty)
    expect(clean).not.toMatch(/script|onclick|javascript:|style=|iframe|\/\/evil|data:/i)
    expect(clean).toContain('<h2>Title</h2>')
    expect(clean).toContain('<a href="https://ok.example" target="_blank" rel="noopener noreferrer">ok</a>')
    expect(clean).toContain('<a href="/en/about">rel</a>')
    expect(clean).toContain('<img src="https://img.example/a.png" alt="ok" />')
    expect(clean).toContain('colspan="2"')
    expect(cleanHtml(null)).toBe('')
  })
})

describe('settings and slugs', () => {
  it('serve the approved contact details unless an admin overrides them', async () => {
    await sql`delete from settings where key in ('email','address')`
    expect(await settingMap()).toMatchObject({ email: 'info@voraworld.id', address: expect.stringContaining('Gedung Nucira') })
    await saveSettings(sql, ['email'], { email: ' sales@voraworld.id ' })
    expect((await settingMap()).email).toBe('sales@voraworld.id')
    await saveSettings(sql, ['email'], { email: 'x'.repeat(20000) })
    expect((await settingMap()).email).toHaveLength(12000)
  })
  it('slugify matches the previous behaviour', () => {
    expect(slugify('Hello, World! 2026')).toBe('hello-world-2026')
    expect(slugify('--Air  Import--')).toBe('air-import')
    expect(slugify('a'.repeat(300))).toHaveLength(160)
  })
})
