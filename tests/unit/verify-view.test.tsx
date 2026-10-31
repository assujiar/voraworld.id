import { generateKeyPairSync } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VerifyView } from '@/components/verify/VerifyView'
import VerifyNotFound from '@/app/(docs)/verify/[token]/not-found'
import { attestationPayload, publicKeyOf, signAttestation, signerFrom } from '@/server/trust/attestation'
import { sha256Hex } from '@/server/crypto'
import { deriveView, type RawVerification } from '@/server/trust/verification-view'
import { canonicalize } from '@/server/trust/canonical'

const pair = generateKeyPairSync('ed25519')
const PRIV = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
const signer = signerFrom('k-1', PRIV)
const PUB = publicKeyOf(pair.privateKey)
const SHA = 'a'.repeat(64)

function attested(sha = SHA, over: Partial<NonNullable<RawVerification['artifacts'][number]['attestation']>> = {}) {
  const a = signAttestation(signer, attestationPayload({ kind: 'document', documentId: 1, number: 'LTR-1', documentType: 'letter', version: 1, role: 'issued', sha256: sha, tokenSha256: 'b'.repeat(64), issuedAt: new Date('2026-11-01T00:00:00Z'), issuedBy: 'user:1' }))
  return { keyId: 'k-1', canonical: a.canonical, signature: a.signature, publicKey: PUB, keyStatus: 'active', ...over }
}
const raw = (over: Partial<RawVerification> = {}): RawVerification => ({
  kind: 'document', documentKind: 'letter', number: 'LTR-1', issuedOn: '2026-11-01', status: 'issued', tokenRevoked: false, revokedReason: '', supersededByToken: null,
  createdAt: new Date('2026-11-01T00:00:00Z'), cutoff: '2026-10-31T00:00:00.000Z', live: [], holder: null, source: null, stampPending: false,
  artifacts: [{ id: 1, version: 1, role: 'issued', sha256: SHA, createdAt: new Date('2026-11-01T00:00:00Z'), attestation: attested() }],
  signings: [], openRequests: 0, parties: [], chain: { ok: true, events: 2 }, label: 'General letter', labelId: 'Surat Umum', ...over,
})

describe('what the page concludes', () => {
  it('separates the findings: a found record, a verified attestation, signing evidence and the file are four things', () => {
    const m = deriveView(raw())
    expect(m).toMatchObject({ banner: 'record_found', issuance: 'verified', signing: 'none_yet', assurance: 'archived' })
    expect(m.artifacts[0]).toMatchObject({ sha256: SHA, attested: 'verified', keyId: 'k-1' })
  })
  it('does not accept an attestation over another file, a forged signature or a compromised key', () => {
    expect(deriveView(raw({ artifacts: [{ ...raw().artifacts[0], sha256: 'c'.repeat(64) }] })).issuance).toBe('invalid_signature')       // a valid signature, but for a different file
    expect(deriveView(raw({ artifacts: [{ ...raw().artifacts[0], attestation: attested(SHA, { signature: 'AAAA' }) }] })).issuance).toBe('invalid_signature')
    expect(deriveView(raw({ artifacts: [{ ...raw().artifacts[0], attestation: attested(SHA, { publicKey: publicKeyOf(generateKeyPairSync('ed25519').privateKey) }) }] })).issuance).toBe('invalid_signature')
    const compromised = deriveView(raw({ artifacts: [{ ...raw().artifacts[0], attestation: attested(SHA, { keyStatus: 'compromised' }) }] }))
    expect(compromised.issuance).toBe('key_compromised'); expect(compromised.banner).toBe('incomplete')
    expect(deriveView(raw({ artifacts: [{ ...raw().artifacts[0], attestation: attested(SHA, { keyStatus: 'retired' }) }] })).issuance).toBe('verified')      // a retired key still verifies what it signed
  })
  it('says so when there is no attestation, no file, or the document is older than the system, and claims nothing for it', () => {
    expect(deriveView(raw({ artifacts: [{ ...raw().artifacts[0], attestation: null }] })).issuance).toBe('not_attested')
    const legacy = deriveView(raw({ artifacts: [], createdAt: new Date('2026-01-01'), chain: null }))
    expect(legacy).toMatchObject({ issuance: 'legacy', assurance: 'legacy', banner: 'record_found' }); expect(legacy.artifacts).toEqual([])
    expect(deriveView(raw({ artifacts: [], kind: 'invoice', documentKind: undefined, chain: null })).issuance).toBe('not_archived')        // live by policy
    expect(deriveView(raw({ artifacts: [], kind: 'invoice', documentKind: undefined, createdAt: new Date('2026-01-01'), chain: null })).issuance).toBe('legacy')
    expect(deriveView(raw({ artifacts: [], cutoff: null, chain: null })).issuance).toBe('legacy')
  })
  it('puts revocation, supersession, draft, pending e-meterai and awaiting approval above any approval look', () => {
    expect(deriveView(raw({ tokenRevoked: true })).banner).toBe('revoked')
    expect(deriveView(raw({ status: 'void' })).banner).toBe('revoked')
    expect(deriveView(raw({ tokenRevoked: true, supersededByToken: 'newtoken' })).banner).toBe('superseded')
    expect(deriveView(raw({ status: 'draft', artifacts: [], chain: null })).banner).toBe('draft')
    expect(deriveView(raw({ kind: 'receipt', documentKind: undefined, status: 'pending_stamp', stampPending: true, artifacts: [], chain: null })).banner).toBe('pending_emeterai')
    expect(deriveView(raw({ kind: 'quotation', documentKind: undefined, status: 'awaiting_approval', artifacts: [], chain: null })).banner).toBe('awaiting_approval')
    const revoked = deriveView(raw({ tokenRevoked: true, live: [{ label: { en: 'Payment status', id: 'x' }, value: 'PAID' }], holder: { name: 'A', title: 'B', validUntil: '' } }))
    expect(revoked.live).toEqual([]); expect(revoked.holder).toBeNull()          // nothing that reads as a current approval
  })
  it('does not call an agreement executed until every required party has signed, and never counts VORA\'s signing for another party', () => {
    const parties = [{ role: 'vora', name: 'PT Satu Arah International', required: true, fulfilled: true, method: 'vora_electronic' }, { role: 'counterparty', name: 'PT Mitra', required: true, fulfilled: false, method: null }]
    const m = deriveView(raw({ documentKind: 'nda', parties }))
    expect(m.executed).toBe(false); expect(m.banner).toBe('not_fully_executed')
    expect(deriveView(raw({ documentKind: 'nda', parties: parties.map((p) => ({ ...p, fulfilled: true, method: p.role === 'vora' ? 'vora_electronic' : 'wet_ink_uploaded' })) })).banner).toBe('record_found')
    expect(deriveView(raw({ documentKind: 'nda', parties: [parties[0], { ...parties[1], required: false }] })).executed).toBe(true)
  })
  it('reports a broken evidence history as incomplete verification', () => { expect(deriveView(raw({ chain: { ok: false, events: 3 } })).banner).toBe('incomplete') })
  it('classifies signing: not applicable for a delivery note, none yet, available with an event, incomplete with an open request', () => {
    expect(deriveView(raw({ kind: 'delivery', documentKind: undefined })).signing).toBe('not_applicable')
    expect(deriveView(raw()).signing).toBe('none_yet')
    const ev = { ref: 'VORA-SIG-1', purpose: 'approved', signerName: 'Siti Rahma', signerPosition: 'Direktur', signedAt: '2026-11-02T03:00:00.000Z', version: 2, method: 'webauthn' as const }
    expect(deriveView(raw({ signings: [ev] })).signing).toBe('available')
    expect(deriveView(raw({ signings: [ev], openRequests: 1 })).signing).toBe('incomplete')
    expect(deriveView(raw({ openRequests: 1 })).signing).toBe('incomplete')
  })
})

describe('what the page says', () => {
  const html = (m = deriveView(raw()), viewedAt = new Date('2026-10-31T04:42:00Z')) => renderToStaticMarkup(<VerifyView model={m} token="AbCdEfGhIjKlMnOpQrStUvWxYz0123456789" origin="https://voraworld.id" viewedAt={viewedAt} />)

  it('never says "authentic", shows the official domain and the server time of the view, and the screenshot notice in both languages', () => {
    const h = html()
    expect(h).not.toMatch(/authentic(?!ity)/i)
    expect(h).toContain('ISSUANCE RECORD FOUND'); expect(h).toContain('CATATAN PENERBITAN DITEMUKAN')
    expect(h).toContain('Viewed on voraworld.id'); expect(h).toContain('31 Oct 2026, 11:42 WIB')        // 04:42 UTC is 11:42 in Jakarta
    expect(h).toContain('A screenshot alone is not independent verification evidence.')
    expect(h).toContain('Tangkapan layar bukan bukti verifikasi yang berdiri sendiri.')
    expect(h).toContain('Ref ABCDEFGH')
  })
  it('shows the status words for each state', () => {
    for (const [m, words] of [[raw({ tokenRevoked: true }), 'REVOKED'], [raw({ tokenRevoked: true, supersededByToken: 't' }), 'SUPERSEDED'], [raw({ status: 'draft', artifacts: [], chain: null }), 'DRAFT'], [raw({ chain: { ok: false, events: 1 } }), 'VERIFICATION INCOMPLETE']] as const) {
      expect(html(deriveView(m)), words).toContain(words)
    }
    expect(html(deriveView(raw({ tokenRevoked: true })))).toContain('DICABUT')
    expect(html(deriveView(raw({ tokenRevoked: true, supersededByToken: 't' })))).toContain('DIGANTIKAN')
    expect(html(deriveView(raw({ status: 'draft', artifacts: [], chain: null })))).toContain('BELUM DITANDATANGANI')
    expect(html(deriveView(raw({ chain: { ok: false, events: 1 } })))).toContain('VERIFIKASI BELUM LENGKAP')
  })
  it('states what an attestation is, and carries no "not a signature" disclaimers', () => {
    const h = html()
    expect(h).not.toMatch(/PSrE|tersertifikasi|non-certified/i)
    expect(h).not.toMatch(/not a (personal )?signature|bukan tanda tangan/i)
    for (const kind of ['letter', 'certificate', 'nda', 'statement', 'authorization']) expect(html(deriveView(raw({ documentKind: kind }))), kind).not.toMatch(/not a (personal |certified )?(electronic )?signature|bukan tanda tangan/i)
    for (const kind of ['quotation', 'pod', 'delivery', 'prepayment'] as const) expect(html(deriveView(raw({ kind, documentKind: undefined }))), kind).not.toMatch(/not a (personal |certified )?(electronic )?signature|not the customer's signature|bukan tanda tangan/i)
  })
  it('names the signer, the position, the purpose and the non-certified method, from the records', () => {
    const h = html(deriveView(raw({ signings: [{ ref: 'VORA-SIG-1', purpose: 'approved', signerName: 'Siti Rahma', signerPosition: 'Direktur', signedAt: '2026-11-02T03:00:00.000Z', version: 2, method: 'webauthn' }] })))
    for (const w of ['Siti Rahma', 'Direktur', 'Approved by', 'VORA-SIG-1', 'Signing evidence available', 'Electronically signed within VORA']) expect(h, w).toContain(w)
  })
  it('puts the repeating watermark behind the information, hidden from assistive technology, and nothing in the way of a click', () => {
    const h = html()
    expect((h.match(/data-watermark="back"/g) ?? []).length).toBe(1)
    expect((h.match(/data-watermark="front"/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((h.match(/<svg class="vf-wm [^"]*" aria-hidden="true" focusable="false"/g) ?? []).length).toBe((h.match(/class="vf-wm /g) ?? []).length)
    expect(h).toContain('patternTransform="rotate(-24)"')
    expect(h).toContain('PT SATU ARAH INTERNATIONAL')
  })
  it('puts no customer, amount, e-mail or secret on the page', () => {
    const h = html(deriveView(raw({ live: [{ label: { en: 'Payment status', id: 'Status pembayaran' }, value: 'AWAITING PAYMENT / MENUNGGU PEMBAYARAN' }] })))
    expect(h).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i)
    expect(h).not.toMatch(/IDR|USD|\d{1,3}(,\d{3}){2,}/)
  })
  it('shows an unknown address as a plain not-found, with no document details and no watermark', () => {
    const h = renderToStaticMarkup(<VerifyNotFound />)
    expect(h).toContain('NO VERIFICATION RECORD FOUND'); expect(h).not.toContain('data-watermark'); expect(h).not.toContain('ISSUANCE RECORD')
  })
  it('keeps a legacy document honest', () => {
    const h = html(deriveView(raw({ artifacts: [], createdAt: new Date('2026-01-01'), chain: null })))
    expect(h).toContain('Issued before the verification system'); expect(h).toContain('No file is recorded for this document')
    expect(h).not.toContain('Issuance attestation verified')
  })
})

describe('canonical JSON', () => {
  it('is the same text whatever order the keys came in, and refuses what it cannot write unambiguously', () => {
    expect(canonicalize({ b: 1, a: [2, { d: null, c: 'x' }] })).toBe('{"a":[2,{"c":"x","d":null}],"b":1}')
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }))
    expect(() => canonicalize({ a: 1.5 })).toThrow(); expect(() => canonicalize({ a: NaN })).toThrow(); expect(() => canonicalize({ a: () => 1 })).toThrow()
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}')
  })
  it('signs and verifies, and a changed byte fails', async () => {
    const a = signAttestation(signer, attestationPayload({ kind: 'invoice', documentId: 1, number: 'N', documentType: 'invoice', version: 1, role: 'issued', sha256: await sha256Hex('x'), tokenSha256: 'b'.repeat(64), issuedAt: new Date(0), issuedBy: 'service' }))
    const { verifyAttestation } = await import('@/server/trust/attestation')
    expect(verifyAttestation(a.canonical, a.signature, PUB)).toBe(true)
    expect(verifyAttestation(a.canonical.replace('"N"', '"M"'), a.signature, PUB)).toBe(false)
    expect(verifyAttestation(a.canonical, a.signature, publicKeyOf(generateKeyPairSync('ed25519').privateKey))).toBe(false)
    expect(verifyAttestation(a.canonical, 'not-a-signature', 'not-a-key')).toBe(false)
  })
})

describe('the configured attestation key', () => {
  it('is read from the environment, and absent means no attestation rather than a made-up key', async () => {
    const { configuredSigner } = await import('@/server/trust/attestation')
    const saved = { id: process.env.VORA_ATTESTATION_KEY_ID, key: process.env.VORA_ATTESTATION_PRIVATE_KEY }
    try {
      delete process.env.VORA_ATTESTATION_KEY_ID; delete process.env.VORA_ATTESTATION_PRIVATE_KEY
      expect(configuredSigner()).toBeNull()
      process.env.VORA_ATTESTATION_KEY_ID = 'prod-key-1'; process.env.VORA_ATTESTATION_PRIVATE_KEY = PRIV
      expect(configuredSigner()?.keyId).toBe('prod-key-1'); expect(configuredSigner()?.publicKeyB64).toBe(PUB)
      process.env.VORA_ATTESTATION_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
      expect(() => configuredSigner()).toThrow(/Ed25519/)                                  // a key of another kind is refused, not used
      process.env.VORA_ATTESTATION_KEY_ID = 'bad id!'; process.env.VORA_ATTESTATION_PRIVATE_KEY = PRIV
      expect(() => configuredSigner()).toThrow(/key id/)
    } finally { for (const [k, v] of [['VORA_ATTESTATION_KEY_ID', saved.id], ['VORA_ATTESTATION_PRIVATE_KEY', saved.key]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
  })
})
