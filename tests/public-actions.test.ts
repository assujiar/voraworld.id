import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from './helpers/db'
import { submitContact, submitQuote } from '@/actions/public'
import { saveMailConfig } from '@/server/mail/config'
import { setSender } from '@/server/mail/transport'
import { INQUIRY_MAX_PER_EMAIL } from '@/server/leads'
import { act, q } from './helpers/actions'

process.env.MAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
const good = { locale: 'en', name: 'Sample QA', email: 'Qa@Example.Invalid', message: 'Please evaluate shipment', consent: 'yes', company: 'Only for test', _back: '/en/contact' }
const rfq = { ...good, _back: '/en/request-quote', mode: 'sea-freight', origin: 'Jakarta', destination: 'Singapore', cargo: '12 crates', pickup: '2026-11-10' }

beforeEach(async () => {
  setSender(null)
  await sql`delete from leads`
  await sql`delete from email_jobs`
  await sql`delete from mail_config`
  await sql`update email_rules set enabled = false`
})

describe('contact form', () => {
  it('stores the inquiry with a permanent lead code and an INQ reference, then shows the success page', async () => {
    const r = await act(submitContact, good)
    expect(r.redirect).toBe('/en/contact?sent=1')
    const [lead] = await sql`select * from leads`
    expect(lead).toMatchObject({ type: 'contact', name: 'Sample QA', email: 'qa@example.invalid', status: 'new', source: 'website', mode: '' })
    expect(lead.publicCode).toMatch(/^L[0-9A-F]{10}$/)
    expect(lead.reference).toMatch(new RegExp(`^INQ-VORA-${lead.publicCode}-\\d{6}-\\d{5}$`))
  })
  it('keeps the visitor on the form with a message when something is wrong', async () => {
    for (const [patch, message] of [
      [{ name: '' }, 'Name, message and valid email are required'],
      [{ message: '' }, 'Name, message and valid email are required'],
      [{ email: 'not-an-email' }, 'Name, message and valid email are required'],
      [{ consent: '' }, 'Consent required'],
    ] as const) {
      const r = await act(submitContact, { ...good, ...patch })
      expect(r.redirect).toMatch(/^\/en\/contact\?error=/)
      expect(q(r.redirect).get('error')).toBe(message)
    }
    expect(await sql`select id from leads`).toHaveLength(0)
  })
  it('silently drops bot submissions that fill the honeypot', async () => {
    const r = await act(submitContact, { ...good, website: 'http://spam.example' })
    expect(r.redirect).toBe('/en/contact?sent=1')
    expect(await sql`select id from leads`).toHaveLength(0)
  })
  it('limits each email address to four submissions per 15 minutes', async () => {
    for (let i = 0; i < INQUIRY_MAX_PER_EMAIL; i++) expect((await act(submitContact, good)).redirect).toContain('sent=1')
    const r = await act(submitContact, good)
    expect(q(r.redirect).get('error')).toBe('Too many submissions; try again later')
    expect((await act(submitContact, { ...good, email: 'someone.else@example.invalid' })).redirect).toContain('sent=1')
  })
  it('truncates over-long fields instead of storing them', async () => {
    await act(submitContact, { ...good, name: 'n'.repeat(400), message: 'm'.repeat(9000), company: 'c'.repeat(500) })
    const [lead] = await sql`select name, message, company from leads`
    expect([lead.name.length, lead.message.length, lead.company.length]).toEqual([140, 6000, 200])
  })
  it('refuses a cross-site form post', async () => {
    const r = await act(submitContact, good, { headers: { origin: 'https://evil.example' } })
    expect(r.error).toMatchObject({ status: 403 })
    expect(await sql`select id from leads`).toHaveLength(0)
  })
  it('accepts a same-site Origin (what browsers send)', async () => {
    expect((await act(submitContact, good, { headers: { origin: 'http://testserver' } })).redirect).toContain('sent=1')
  })
})

describe('request-for-quotation form', () => {
  it('stores the shipment details and an RFQ reference', async () => {
    const r = await act(submitQuote, rfq)
    expect(r.redirect).toBe('/en/request-quote?sent=1')
    const [lead] = await sql`select * from leads`
    expect(lead).toMatchObject({ type: 'RFQ', mode: 'sea-freight', origin: 'Jakarta', destination: 'Singapore', cargo: '12 crates', pickup: '2026-11-10' })
    expect(lead.reference).toMatch(/^RFQ-VORA-L[0-9A-F]{10}-\d{6}-\d{5}$/)
  })
  it('requires service, origin and destination', async () => {
    for (const missing of ['mode', 'origin', 'destination'] as const) {
      const r = await act(submitQuote, { ...rfq, [missing]: '' })
      expect(q(r.redirect).get('error')).toBe('Service, origin and destination required')
      expect(r.redirect).toMatch(/^\/en\/request-quote\?error=/)
    }
    expect(await sql`select id from leads`).toHaveLength(0)
  })
  it('sends the user back to the page they came from, but only to local paths', async () => {
    expect((await act(submitQuote, { ...rfq, origin: '', _back: '/id/request-quote' })).redirect).toMatch(/^\/id\/request-quote\?error=/)
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil']) {
      expect((await act(submitQuote, { ...rfq, origin: '', _back: evil })).redirect).toMatch(/^\/en\/request-quote\?error=/)
    }
  })
})

describe('notification emails', () => {
  it('queue an admin alert and a customer acknowledgement once SMTP and the rules are on', async () => {
    await saveMailConfig(sql, { host: 'smtp.example.invalid', fromEmail: 'info@voraworld.id', adminEmail: 'ops@example.invalid', enabled: true })
    await sql`update email_rules set enabled = true where key in ('lead_admin', 'lead_customer')`
    const sent: Array<[string, string]> = []
    setSender(async (_c, to, subject) => { sent.push([to, subject]) })
    await act(submitContact, good)
    await new Promise((r) => setTimeout(r, 200))   // the dispatch runs after the response
    const jobs = await sql`select event, recipient from email_jobs order by id`
    expect(jobs.map((j) => [j.event, j.recipient])).toEqual([['lead_admin', 'ops@example.invalid'], ['lead_customer', 'qa@example.invalid']])
    expect(sent.map((s) => s[0]).sort()).toEqual(['ops@example.invalid', 'qa@example.invalid'])
    expect(sent.every(([, subject]) => /INQ-VORA-L[0-9A-F]{10}-\d{6}-\d{5}/.test(subject))).toBe(true)
  })
  it('queue nothing while SMTP is disabled, and never block the visitor', async () => {
    await sql`update email_rules set enabled = true`
    expect((await act(submitContact, good)).redirect).toContain('sent=1')
    expect(await sql`select id from email_jobs`).toHaveLength(0)
  })
})
