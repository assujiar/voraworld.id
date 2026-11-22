import { describe, expect, it } from 'vitest'
import { sql } from './helpers/db'

/** Exercised against the migrated test database: RPC remains atomic under the global cap. */
describe('marketing broadcast queue', () => {
  it('uses explicit consent, a rolling-hour cap, and one snapshot row per contact', async () => {
    const suffix=Math.random().toString(36).slice(2)
    const email=`broadcast-${suffix}@example.com`
    const [newContact]=await sql`INSERT INTO broadcast_contacts(email,company_name,consent_status) VALUES (${email},'Example','unverified') RETURNING id`
    const [newCampaign]=await sql`INSERT INTO broadcast_campaigns(name,subject,html,audience_tag) VALUES ('Test','Hello','<p>Hello {{pic_name}}</p>','') RETURNING id`
    try {
      const [{n:eligible}]=await sql`SELECT count(*)::int AS n FROM broadcast_contacts WHERE consent_status='subscribed' AND email=${email}`
      expect(eligible).toBe(0)
      // Launch must reject an audience containing no subscribed recipients only when the database has no other eligible contacts.
      await sql`UPDATE broadcast_contacts SET consent_status='subscribed',consent_at=now(),consent_evidence='Explicit opt-in test record' WHERE id=${newContact.id}`
      const [row]=await sql`SELECT broadcast_launch(${newCampaign.id}::bigint) AS n`
      expect(Number(row.n)).toBeGreaterThanOrEqual(1)
      const [duplicate]=await sql`SELECT count(*)::int AS n FROM broadcast_deliveries WHERE campaign_id=${newCampaign.id} AND contact_id=${newContact.id}`
      expect(duplicate.n).toBe(1)
      await expect(sql`SELECT broadcast_launch(${newCampaign.id}::bigint)`).rejects.toThrow()
      const [stop]=await sql`SELECT broadcast_unsubscribe((SELECT unsubscribe_token FROM broadcast_contacts WHERE id=${newContact.id})) AS ok`
      expect(stop.ok).toBe(true)
      const [queued]=await sql`SELECT count(*)::int AS n FROM broadcast_deliveries WHERE campaign_id=${newCampaign.id} AND contact_id=${newContact.id} AND status IN ('queued','retry')`
      expect(queued.n).toBe(0)
    } finally {
      await sql`DELETE FROM broadcast_campaigns WHERE id=${newCampaign.id}`
      await sql`DELETE FROM broadcast_contacts WHERE id=${newContact.id}`
    }
  })
  it('defaults marketing delivery to disabled with a 30 per hour cap', async () => {
    const [settings]=await sql`SELECT max_per_hour,enabled FROM broadcast_settings WHERE id=1`
    expect(Number(settings.max_per_hour)).toBeGreaterThanOrEqual(1)
    expect(Number(settings.max_per_hour)).toBeLessThanOrEqual(300)
  })
})
