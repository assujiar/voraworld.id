import { describe, expect, it } from 'vitest'
import { challengeOfResponse, relyingParty, signingRequestOptions, verifyAssertion, verifyRegistration } from '@/server/trust/webauthn'
import { CONFIRMATIONS, challengeOf, checkedConfirmations, checkedPlacement, consentStatement, consentStatementSha256, signingPayload, type SigningPayloadInput } from '@/server/trust/signing-payload'
import { SoftPasskey } from './helpers/authenticator'

const BASE = 'https://voraworld.id'
const rp = relyingParty(BASE)
const all = Object.fromEntries(CONFIRMATIONS.map((c) => [c, true])) as SigningPayloadInput['confirmations']
const input = (over: Partial<SigningPayloadInput> = {}): SigningPayloadInput => ({
  requestRef: 'VORA-SIG-A1B2C3D4', kind: 'document', documentId: 7, documentNumber: 'LTR-1', sourceArtifactId: 11, sourceVersion: 1, sourceSha256: 'a'.repeat(64),
  signerProfileId: 3, signerUserId: 5, signerName: 'Siti Rahma', signerPosition: 'Direktur', purpose: 'approved', partyRole: 'vora',
  placement: { pages: 'last', page_number: null, corner: 'custom', size: 'medium', pos_x: '0.3000', pos_y: '0.4000', background: false }, confirmations: all,
  nonce: 'n'.repeat(22), issuedAt: new Date('2026-11-02T03:00:00Z'), expiresAt: new Date('2026-11-02T03:05:00Z'), ...over,
})

describe('the signing payload', () => {
  it('is bound to the document, its version and fingerprint, the signer, the purpose, the placement and the consent: change any and the challenge changes', () => {
    const base = challengeOf(signingPayload(input()))
    expect(base.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challengeOf(signingPayload(input())).challenge).toBe(base.challenge)                                      // deterministic
    const changes: Array<Partial<SigningPayloadInput>> = [
      { sourceSha256: 'b'.repeat(64) }, { sourceVersion: 2 }, { sourceArtifactId: 12 }, { documentId: 8 }, { kind: 'invoice' }, { signerProfileId: 4 }, { signerUserId: 6 }, { signerName: 'Budi' }, { signerPosition: 'Staf' },
      { purpose: 'verified' }, { partyRole: 'counterparty' }, { placement: { pages: 'last', page_number: null, corner: 'custom', size: 'medium', pos_x: '0.3001', pos_y: '0.4000', background: false } },
      { placement: { pages: 'all', page_number: null, corner: 'custom', size: 'medium', pos_x: '0.3000', pos_y: '0.4000', background: false } }, { nonce: 'm'.repeat(22) }, { expiresAt: new Date('2026-11-02T03:06:00Z') }, { requestRef: 'VORA-SIG-FFFFFFFF' },
    ]
    for (const c of changes) expect(challengeOf(signingPayload(input(c))).challenge, JSON.stringify(c)).not.toBe(base.challenge)
  })
  it('records the consent statement, by its hash, with the payload', () => {
    const p = signingPayload(input()) as { consent: { statement_sha256: string; version: string; confirmations: Record<string, boolean> } }
    expect(p.consent.statement_sha256).toBe(consentStatementSha256()); expect(p.consent.version).toBe('consent-v1')
    expect(consentStatement()).toContain('non-certified electronic signature'); expect(consentStatement()).toContain('tidak tersertifikasi')
    expect(Object.keys(p.consent.confirmations).sort()).toEqual([...CONFIRMATIONS].sort())
  })
  it('refuses a signing unless every confirmation is explicitly true', () => {
    expect(checkedConfirmations(all)).toEqual(all)
    for (const c of CONFIRMATIONS) expect(() => checkedConfirmations({ ...all, [c]: false }), c).toThrow(/Every confirmation is required/)
    for (const c of CONFIRMATIONS) { const { [c]: _o, ...rest } = all; expect(() => checkedConfirmations(rest), c).toThrow() }
    expect(() => checkedConfirmations({ ...all, consent_to_sign: 'true' })).toThrow()                               // a string is not consent
    expect(() => checkedConfirmations(null)).toThrow()
  })
  it('refuses a placement the PDF would have to guess at', () => {
    expect(checkedPlacement({ pages: 'last', corner: 'bottom-right', size: 'small' })).toMatchObject({ corner: 'bottom-right', pos_x: null })
    expect(checkedPlacement({ pages: 'last', corner: 'bottom-right', size: 'small' }).background).toBe(false)                      // transparent unless chosen (an older request has no such field)
    expect(checkedPlacement({ pages: 'last', corner: 'bottom-right', size: 'small', background: true }).background).toBe(true)
    expect(checkedPlacement({ pages: 'last', corner: 'bottom-right', size: 'small', background: 'yes' }).background).toBe(false)   // only a real boolean counts
    expect(checkedPlacement({ pages: 'one', page_number: '2', corner: 'custom', size: 'medium', pos_x: '0.25', pos_y: '1', background: false })).toMatchObject({ page_number: 2, pos_x: '0.25', pos_y: '1' })
    for (const bad of [{ pages: 'some', corner: 'custom', size: 'small' }, { pages: 'last', corner: 'middle', size: 'small' }, { pages: 'last', corner: 'custom', size: 'huge' }, { pages: 'last', corner: 'custom', size: 'small' },
      { pages: 'last', corner: 'custom', size: 'small', pos_x: '2', pos_y: '0.5', background: false }, { pages: 'last', corner: 'custom', size: 'small', pos_x: 'left', pos_y: '0.5' }, { pages: 'one', corner: 'top-left', size: 'small' }, null]) expect(() => checkedPlacement(bad), JSON.stringify(bad)).toThrow()
  })
})

describe('passkeys: the signer\'s own authentication', () => {
  it('registers a passkey made for this site, with user verification', async () => {
    const key = new SoftPasskey(rp.id, rp.origin)
    const out = await verifyRegistration(key.register('reg-challenge-1'), 'reg-challenge-1', rp)
    expect(out).toMatchObject({ credentialId: key.credentialId, counter: 0 })
    expect(out.publicKey.length).toBeGreaterThan(40)
  })
  it('refuses a registration for another origin, one answering another challenge, and an authenticator that did not verify the user', async () => {
    const key = new SoftPasskey(rp.id, rp.origin)
    await expect(verifyRegistration(key.register('c1', { origin: 'https://voraworld.id.evil.example' }), 'c1', rp)).rejects.toThrow(/origin/i)
    await expect(verifyRegistration(key.register('c1'), 'c2', rp)).rejects.toThrow(/challenge/i)
    await expect(verifyRegistration(key.register('c1', { verified: false }), 'c1', rp)).rejects.toThrow(/user verification/i)
  })

  async function enrolled() {
    const key = new SoftPasskey(rp.id, rp.origin)
    const c = await verifyRegistration(key.register('reg'), 'reg', rp)
    return { key, stored: { credentialId: c.credentialId, publicKey: c.publicKey, counter: c.counter, transports: c.transports } }
  }

  it('accepts an assertion over exactly the payload that was shown, and nothing else', async () => {
    const { key, stored } = await enrolled()
    const { challenge } = challengeOf(signingPayload(input()))
    const options = await signingRequestOptions(challenge, [stored], rp)
    expect(options.challenge).toBe(challenge)                                                                         // the challenge IS the payload's hash
    expect(options.userVerification).toBe('required'); expect(options.rpId).toBe('voraworld.id'); expect(options.allowCredentials).toHaveLength(1)
    const response = key.assert(challenge)
    expect(challengeOfResponse(response)).toBe(challenge)
    const out = await verifyAssertion(response, challenge, stored, rp)
    expect(out).toMatchObject({ userVerified: true, newCounter: 1, rpId: 'voraworld.id', origin: 'https://voraworld.id' })
    // The same assertion does not authenticate a document with a different fingerprint or a different placement.
    const other = challengeOf(signingPayload(input({ sourceSha256: 'c'.repeat(64) }))).challenge
    await expect(verifyAssertion(response, other, stored, rp)).rejects.toThrow(/challenge/i)
    const moved = challengeOf(signingPayload(input({ placement: { pages: 'last', page_number: null, corner: 'custom', size: 'medium', pos_x: '0.9000', pos_y: '0.9000', background: false } }))).challenge
    await expect(verifyAssertion(response, moved, stored, rp)).rejects.toThrow(/challenge/i)
  })
  it('refuses an assertion made for another site, a replayed one (a counter that does not advance), and one without user verification', async () => {
    const { key, stored } = await enrolled()
    const { challenge } = challengeOf(signingPayload(input()))
    await expect(verifyAssertion(key.assert(challenge, { origin: 'https://phish.example' }), challenge, stored, rp)).rejects.toThrow(/origin/i)
    await expect(verifyAssertion(key.assert(challenge, { rpId: 'phish.example' }), challenge, stored, rp)).rejects.toThrow(/RP ID/i)
    await expect(verifyAssertion(key.assert(challenge, { verified: false }), challenge, stored, rp)).rejects.toThrow(/user verification/i)
    const first = key.assert(challenge)
    const ok = await verifyAssertion(first, challenge, stored, rp)
    await expect(verifyAssertion(first, challenge, { ...stored, counter: ok.newCounter }, rp)).rejects.toThrow(/counter/i)       // a clone or a replay: the counter did not go up
  })
  it('refuses an assertion from a passkey that is not the signer\'s, even for the right payload', async () => {
    const { stored } = await enrolled()
    const intruder = new SoftPasskey(rp.id, rp.origin)
    const { challenge } = challengeOf(signingPayload(input()))
    await expect(verifyAssertion(intruder.assert(challenge), challenge, stored, rp)).rejects.toThrow()                  // signed with another key
  })
  it('takes the relying party from the configuration, not from a request', () => {
    expect(relyingParty('https://voraworld.id')).toEqual({ id: 'voraworld.id', origin: 'https://voraworld.id', name: 'VORA' })
    expect(relyingParty('http://localhost:3000').id).toBe('localhost')
  })
})
