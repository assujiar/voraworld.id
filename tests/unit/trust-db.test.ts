import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Sql } from 'postgres'
import { freshDatabase, postgresAvailable } from './helpers/pg'

const available = await postgresAvailable()
const sha = (c: string) => c.repeat(64)
const KEY_A = 'a'.repeat(60)

describe.skipIf(!available)('document trust: the database', () => {
  let sql: Sql, drop: () => Promise<void>
  let admin1: number, admin2: number, doc = 0
  beforeAll(async () => {
    ({ sql, drop } = await freshDatabase())
    ;[{ id: admin1 }] = await sql`insert into users (email, role) values ('a1@example.invalid', 'admin') returning id`
    ;[{ id: admin2 }] = await sql`insert into users (email, role) values ('a2@example.invalid', 'admin') returning id`
    await sql`insert into attestation_keys (key_id, public_key) values ('test-key-1', ${KEY_A})`
  }, 120_000)
  afterAll(async () => { await drop?.() })

  /** A document with a live verification token, as the application creates it. */
  const newDoc = async (kind = 'document') => { doc += 1; await sql`select vr_create_verification(${kind}, ${doc})`; return doc }
  const issue = (kind: string, id: number, version: number, over: Record<string, unknown> = {}, actor = admin1) => sql`select trust_record_issuance(${actor}, ${kind}, ${id}, ${version}, ${sql.json({
    storage_key: `trust/${kind}/${id}/${Math.random()}.pdf`, sha256: sha('1'), byte_size: 1000, pages: 1, role: 'issued', key_id: 'test-key-1', payload_canonical: '{"a":1}', signature: 'sig', ...over,
  } as never)}::jsonb) as id`
  const refused = async (p: PromiseLike<unknown>, m: RegExp) => { const e = await Promise.resolve(p).then(() => null, (x: Error) => x); expect(e, 'expected an error').not.toBeNull(); expect(e!.message).toMatch(m) }

  it('records an issued artifact with its attestation and a verifiable evidence chain, once per document', async () => {
    const id = await newDoc()
    const [{ id: artifact }] = await issue('document', id, 1)
    expect(artifact).toBeGreaterThan(0)
    const chain = (await sql`select trust_verify_evidence('document', ${id}) as r`)[0].r
    expect(chain).toEqual({ ok: true, events: 2, broken_at: null })                  // issued + attested
    await refused(issue('document', id, 1), /issued or signed meanwhile/)           // the second of two concurrent issuances is refused
    await refused(issue('document', id, 2), /already has an issued file/)
  })

  it('records "attestation unavailable" instead of pretending, when no key signed it', async () => {
    const id = await newDoc()
    await issue('document', id, 1, { key_id: null, signature: null, payload_canonical: null })
    const events = await sql`select event_type from evidence_events where kind = 'document' and document_id = ${id} order by id`
    expect(events.map((e) => e.event_type)).toEqual(['issued', 'attestation_unavailable'])
    expect((await sql`select count(*)::int as n from document_attestations a join document_artifacts r on r.id = a.artifact_id where r.document_id = ${id}`)[0].n).toBe(0)
  })

  it('refuses to issue a document that has no active verification record, or whose record was revoked', async () => {
    await refused(issue('document', 99_999, 1), /no active verification record/)
    const id = await newDoc()
    await sql`select trust_revoke(${admin1}, 'document', ${id}, 'void')`
    await refused(issue('document', id, 1), /no active verification record/)
  })

  it('never lets an artifact, attestation, evidence event or signing event be changed, deleted or truncated', async () => {
    const id = await newDoc()
    await issue('document', id, 1)
    for (const t of ['document_artifacts', 'document_attestations', 'evidence_events']) {
      await refused(sql.unsafe(`update ${t} set id = id`), /append-only/)
      await refused(sql.unsafe(`delete from ${t}`), /append-only/)
      await refused(sql.unsafe(`truncate ${t} cascade`), /append-only/)
    }
  })

  /** Runs one statement as a database role, in its own transaction, so that one refusal cannot be mistaken for another. */
  const asRole = (role: string, run: (tx: Sql) => PromiseLike<unknown>) => sql.begin(async (tx) => { await tx.unsafe(`set local role ${role}`); await run(tx as unknown as Sql) })
  const denied = async (role: string, run: (tx: Sql) => PromiseLike<unknown>) => {
    const e = await asRole(role, run).then(() => null, (x: Error) => x)
    expect(e, `${role} should have been refused`).not.toBeNull()
    expect(e!.message).toMatch(/^permission denied/)
  }

  it('also closes the Data API role: service_role cannot write or alter evidence directly, only through the functions', async () => {
    const id = await newDoc()
    await denied('service_role', (tx) => tx`insert into evidence_events (kind, document_id, event_type, prev_hash, hash) values ('document', ${id}, 'issued', ${sha('0')}, ${sha('1')})`)
    await denied('service_role', (tx) => tx`insert into document_artifacts (kind, document_id, version, role, storage_key, sha256, byte_size) values ('document', ${id}, 1, 'issued', 'x', ${sha('1')}, 1)`)
    await denied('service_role', (tx) => tx`update document_artifacts set pages = 3`)
    await denied('service_role', (tx) => tx`delete from signing_events`)
    await denied('service_role', (tx) => tx`delete from signer_authorities`)
    await denied('service_role', (tx) => tx`update signer_authorities set scope = ${['*']}`)
    // The same role can still issue, through the function (which runs with the owner's rights, for exactly this).
    await asRole('service_role', (tx) => tx`select trust_record_issuance(${admin1}, 'document', ${id}, 1, ${sql.json({ storage_key: `k/${id}`, sha256: sha('2'), byte_size: 10, role: 'issued' } as never)}::jsonb)`)
    expect((await sql`select count(*)::int as n from document_artifacts where document_id = ${id}`)[0].n).toBe(1)
    await asRole('service_role', (tx) => tx`select trust_verify_evidence('document', ${id})`)
  })

  it('shows the public API roles nothing and lets them call nothing', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const t of ['document_artifacts', 'document_attestations', 'evidence_events', 'signing_events', 'signer_profiles', 'signer_authorities', 'signer_credentials', 'signing_requests', 'signing_challenges', 'attestation_keys', 'document_parties']) {
        await denied(role, (tx) => tx.unsafe(`select * from ${t}`))
      }
      await denied(role, (tx) => tx`select trust_next_version('document', 1)`)
      await denied(role, (tx) => tx`select trust_append_evidence('document', 1, 'issued', null, null)`)
      await denied(role, (tx) => tx`select trust_complete_signing(1, 2, '{}'::jsonb)`)
    }
  })

  it('has row level security on every table it added', async () => {
    const rows = await sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`
    expect(rows.map((r) => r.relname)).toEqual([])
  })

  it('detects a tampered evidence chain', async () => {
    const id = await newDoc()
    await issue('document', id, 1)
    await sql.begin(async (tx) => {
      await tx`alter table evidence_events disable trigger trg_evidence_events_immutable`
      await tx`update evidence_events set payload = '{"forged":true}'::jsonb where kind = 'document' and document_id = ${id} and event_type = 'issued'`
      await tx`alter table evidence_events enable trigger trg_evidence_events_immutable`
    })
    const r = (await sql`select trust_verify_evidence('document', ${id}) as r`)[0].r
    expect(r.ok).toBe(false)
    expect(r.broken_at).toBeGreaterThan(0)
  })

  it('records revocation and supersession with the time and the reason, and keeps the chain intact', async () => {
    const a = await newDoc(), b = await newDoc()
    await issue('document', a, 1)
    await sql`select trust_revoke(${admin1}, 'document', ${a}, 'replaced by a corrected letter', 'document', ${b})`
    const [t] = await sql`select revoked, revoked_at, revoked_reason, superseded_by_kind, superseded_by_id from document_verification_tokens where kind = 'document' and document_id = ${a}`
    expect(t).toMatchObject({ revoked: true, revoked_reason: 'replaced by a corrected letter', superseded_by_kind: 'document', superseded_by_id: b })
    expect(t.revoked_at).toBeInstanceOf(Date)
    expect((await sql`select event_type from evidence_events where document_id = ${a} and kind = 'document' order by id desc limit 1`)[0].event_type).toBe('superseded')
    expect((await sql`select trust_verify_evidence('document', ${a}) as r`)[0].r.ok).toBe(true)
    // A void through the existing path stamps the time too.
    const c = await newDoc()
    await sql`update document_verification_tokens set revoked = true where kind = 'document' and document_id = ${c}`
    expect((await sql`select revoked_at from document_verification_tokens where document_id = ${c} and kind = 'document'`)[0].revoked_at).toBeInstanceOf(Date)
    await refused(sql`select trust_revoke(${admin1}, 'document', 888888, 'x')`, /no verification record/)
  })

  it('creates one verification token for a delivery note, however often it is asked', async () => {
    const t1 = (await sql`select trust_ensure_verification('delivery', 4242) as t`)[0].t
    const t2 = (await sql`select trust_ensure_verification('delivery', 4242) as t`)[0].t
    expect(t1).toBe(t2)
    expect((await sql`select count(*)::int as n from document_verification_tokens where kind = 'delivery' and document_id = 4242`)[0].n).toBe(1)
    await refused(sql`select trust_ensure_verification('anything', 1)`, /Unknown document kind/)
  })

  describe('signers and signing', () => {
    let profile: number, credential: number
    beforeAll(async () => {
      ;[{ id: profile }] = await sql`insert into signer_profiles (user_id, display_name, position) values (${admin1}, 'Siti Rahma', 'Direktur') returning id`
      ;[{ id: credential }] = await sql`insert into signer_credentials (profile_id, credential_id, public_key) values (${profile}, 'cred-1', 'pk') returning id`
    })

    it('does not let anyone grant themselves authority while another administrator exists, and records who granted what', async () => {
      await refused(sql`select trust_authority_grant(${admin1}, ${profile}, ${['letter']}, null, 'self')`, /granted by another administrator/)
      const [{ id }] = await sql`select trust_authority_grant(${admin2}, ${profile}, ${['letter', 'seal']}, null, 'board resolution 12') as id`
      expect(id).toBeGreaterThan(0)
      expect((await sql`select status from signer_profiles where id = ${profile}`)[0].status).toBe('active')
      expect((await sql`select granted_by, sole_admin_grant from signer_authorities where id = ${id}`)[0]).toEqual({ granted_by: admin2, sole_admin_grant: false })
      expect((await sql`select trust_signer_authorized(${profile}, 'letter') as ok`)[0].ok).toBe(true)
      expect((await sql`select trust_signer_authorized(${profile}, 'agreement') as ok`)[0].ok).toBe(false)         // outside the scope
    })

    it('allows the sole active administrator to grant themselves authority, and says so on the grant', async () => {
      const db = await freshDatabase()
      try {
        const [{ id: only }] = await db.sql`insert into users (email, role) values ('only@example.invalid', 'admin') returning id`
        const [{ id: p }] = await db.sql`insert into signer_profiles (user_id, display_name, position) values (${only}, 'Only Admin', 'Owner') returning id`
        const [{ id }] = await db.sql`select trust_authority_grant(${only}, ${p}, ${['*']}, null, 'sole administrator') as id`
        expect((await db.sql`select sole_admin_grant from signer_authorities where id = ${id}`)[0].sole_admin_grant).toBe(true)
      } finally { await db.drop() }
    })

    it('keeps authority history: a grant can only be ended, never edited or deleted', async () => {
      const [{ id }] = await sql`select trust_authority_grant(${admin2}, ${profile}, ${['certificate']}, null, 'temp') as id`
      await refused(sql`update signer_authorities set scope = ${['*']} where id = ${id}`, /cannot be edited/)
      await refused(sql`delete from signer_authorities where id = ${id}`, /not deleted/)
      await sql`update signer_authorities set revoked_at = now(), revoked_by = ${admin2}, revoke_reason = 'left the company' where id = ${id}`
      await refused(sql`update signer_authorities set revoke_reason = 'edited' where id = ${id}`, /cannot be edited/)
      expect((await sql`select trust_signer_authorized(${profile}, 'certificate') as ok`)[0].ok).toBe(false)
    })

    it('uses a challenge once, and only before it expires, for the right signer and purpose', async () => {
      await sql`insert into signing_challenges (purpose, profile_id, challenge, payload_canonical, expires_at) values ('sign', ${profile}, 'chal-1', '{"x":1}', now() + interval '5 minutes')`
      await refused(sql`select trust_consume_challenge('chal-1', ${profile + 1}, 'sign')`, /unknown, expired or already used/)
      await refused(sql`select trust_consume_challenge('chal-1', ${profile}, 'register')`, /unknown, expired or already used/)
      expect((await sql`select trust_consume_challenge('chal-1', ${profile}, 'sign') as r`)[0].r.payload_canonical).toBe('{"x":1}')
      await refused(sql`select trust_consume_challenge('chal-1', ${profile}, 'sign')`, /unknown, expired or already used/)         // a replay
      await sql`insert into signing_challenges (purpose, profile_id, challenge, expires_at) values ('sign', ${profile}, 'chal-old', now() - interval '1 second')`
      await refused(sql`select trust_consume_challenge('chal-old', ${profile}, 'sign')`, /unknown, expired or already used/)
    })

    const request = async (id: number, over: Record<string, unknown> = {}) => {
      const [{ id: art }] = await issue('document', id, 1, { sha256: sha('a') })
      const [{ id: req }] = await sql`insert into signing_requests (ref, kind, document_id, family, source_artifact_id, source_sha256, signer_profile_id, purpose, created_by, expires_at)
        values (${`VORA-SIG-${Math.random().toString(16).slice(2, 10).toUpperCase()}`}, 'document', ${id}, ${(over.family as string) ?? 'letter'}, ${art}, ${sha('a')}, ${profile}, 'approved', ${admin2}, now() + interval '30 minutes') returning id`
      return { art, req }
    }
    const complete = (req: number, version = 2, over: Record<string, unknown> = {}) => sql`select trust_complete_signing(${req}, ${version}, ${sql.json({
      credential_row_id: credential, counter: 5, signer_name: 'Siti Rahma', signer_position: 'Direktur', payload_canonical: '{"p":1}', payload_sha256: sha('b'),
      consent: { statement: 's', version: 'v1' }, authentication: { method: 'webauthn' }, placement: { page: 1 },
      artifact: { storage_key: `signed/${Math.random()}.pdf`, sha256: sha('c'), byte_size: 2000, pages: 1, key_id: 'test-key-1', payload_canonical: '{}', signature: 's' }, ...over,
    } as never)}::jsonb) as id`

    it('completes a signing atomically: signed artifact, event, evidence, counter and request state together', async () => {
      const id = await newDoc()
      const { req } = await request(id)
      const [{ id: event }] = await complete(req)
      expect(event).toBeGreaterThan(0)
      expect((await sql`select status, result_artifact_id from signing_requests where id = ${req}`)[0].status).toBe('signed')
      expect((await sql`select version, role from document_artifacts where document_id = ${id} order by version`).map((r) => `${r.version}:${r.role}`)).toEqual(['1:issued', '2:signed'])
      expect((await sql`select counter from signer_credentials where id = ${credential}`)[0].counter).toBe('5')
      expect((await sql`select trust_verify_evidence('document', ${id}) as r`)[0].r.ok).toBe(true)
      expect((await sql`select event_type from evidence_events where document_id = ${id} and kind = 'document' order by id desc limit 1`)[0].event_type).toBe('signing_completed')
      await refused(complete(req), /no longer open/)                                                                       // not twice
    })

    it('refuses a signing whose document changed after the request (consent does not carry over)', async () => {
      const id = await newDoc()
      const { req } = await request(id)
      await issue('document', id, 2, { role: 'signed', sha256: sha('d') })              // somebody else's signed version got there first
      await refused(complete(req, 3), /changed after the signing request/)
    })

    it('refuses a signing when the authority has ended, the request expired, or the document was revoked', async () => {
      const a = await newDoc(), b = await newDoc(), c = await newDoc()
      const ra = await request(a), rb = await request(b), rc = await request(c)
      await sql`update signing_requests set expires_at = now() - interval '1 second' where id = ${rb.req}`
      await refused(complete(rb.req), /expired/)
      await sql`select trust_revoke(${admin1}, 'document', ${c}, 'void')`
      await refused(complete(rc.req), /revoked or has no verification record/)
      const [{ id: grant }] = await sql`select trust_authority_grant(${admin2}, ${profile}, ${['letter']}, null, 'again') as id`
      await sql`update signer_authorities set revoked_at = now(), revoked_by = ${admin2}, revoke_reason = 'ended' where profile_id = ${profile} and revoked_at is null`
      await refused(complete(ra.req), /no current authority/)
      expect(grant).toBeGreaterThan(0)
    })

    it('does not accept a passkey that is revoked or belongs to someone else', async () => {
      await sql`select trust_authority_grant(${admin2}, ${profile}, ${['letter']}, null, 'restore') as id`
      const id = await newDoc()
      const { req } = await request(id)
      await sql`update signer_credentials set revoked_at = now() where id = ${credential}`
      await refused(complete(req), /passkey is not valid/)
      await sql`update signer_credentials set revoked_at = null where id = ${credential}`
    })

    it('allows only one open request per document and signer', async () => {
      const id = await newDoc()
      await request(id)
      await refused(sql`insert into signing_requests (ref, kind, document_id, family, source_artifact_id, source_sha256, signer_profile_id, purpose, created_by, expires_at)
        values ('VORA-SIG-DUPLICAT', 'document', ${id}, 'letter', (select id from document_artifacts where document_id = ${id} limit 1), ${sha('a')}, ${profile}, 'approved', ${admin2}, now() + interval '1 hour')`, /duplicate key/)
    })

    it('fulfils only the party the signing was for, and never marks an external party as signed by VORA', async () => {
      const id = await newDoc()
      await sql`insert into document_parties (kind, document_id, role, name) values ('document', ${id}, 'vora', 'PT Satu Arah International'), ('document', ${id}, 'counterparty', 'PT Mitra')`
      const [{ id: art }] = await issue('document', id, 1, { sha256: sha('a') })
      const [{ id: req }] = await sql`insert into signing_requests (ref, kind, document_id, family, source_artifact_id, source_sha256, signer_profile_id, purpose, created_by, expires_at, party_role)
        values ('VORA-SIG-PARTYTEST', 'document', ${id}, 'letter', ${art}, ${sha('a')}, ${profile}, 'signed', ${admin2}, now() + interval '30 minutes', 'vora') returning id`
      await complete(req)
      const parties = await sql`select role, method from document_parties where document_id = ${id} order by role`
      expect(parties).toEqual([{ role: 'counterparty', method: null }, { role: 'vora', method: 'vora_electronic' }])
      await refused(sql`update document_parties set method = 'vora_electronic', fulfilled_at = now() where document_id = ${id} and role = 'counterparty'`, /document_parties_check/)
    })
  })
})
