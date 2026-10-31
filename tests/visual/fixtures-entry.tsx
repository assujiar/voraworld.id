import { renderToStaticMarkup } from 'react-dom/server'
import { generateKeyPairSync } from 'node:crypto'
import { VerifyView } from '@/components/verify/VerifyView'
import VerifyNotFound from '@/app/(docs)/verify/[token]/not-found'
import { attestationPayload, publicKeyOf, signAttestation, signerFrom } from '@/server/trust/attestation'
import { deriveView, type RawVerification } from '@/server/trust/verification-view'

/** HTML of the verification page in each state, drawn from the real component with the real stylesheet, for the browser tests. No database is involved. */
const pair = generateKeyPairSync('ed25519')
const signer = signerFrom('k-1', pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'))
const SHA = 'a1b2c3d4'.repeat(8)
const att = signAttestation(signer, attestationPayload({ kind: 'document', documentId: 1, number: 'LTR-VORA-C001-202611-00001', documentType: 'letter', version: 1, role: 'issued', sha256: SHA, tokenSha256: 'b'.repeat(64), issuedAt: new Date('2026-11-01T00:00:00Z'), issuedBy: 'user:1' }))
const raw = (over: Partial<RawVerification> = {}): RawVerification => ({
  kind: 'document', documentKind: 'letter', number: 'LTR-VORA-C001-202611-00001', issuedOn: '2026-11-01', status: 'issued', tokenRevoked: false, revokedReason: '', supersededByToken: null,
  createdAt: new Date('2026-11-01T00:00:00Z'), cutoff: '2026-10-31T00:00:00.000Z', live: [], holder: null, source: null, stampPending: false,
  artifacts: [{ id: 1, version: 1, role: 'issued', sha256: SHA, createdAt: new Date('2026-11-01T00:00:00Z'), attestation: { keyId: 'k-1', canonical: att.canonical, signature: att.signature, publicKey: publicKeyOf(pair.privateKey), keyStatus: 'active' } }],
  signings: [{ ref: 'VORA-SIG-A1B2C3D4', purpose: 'approved', signerName: 'Siti Rahma', signerPosition: 'Direktur', signedAt: '2026-11-02T03:00:00.000Z', version: 2, method: 'webauthn' }], openRequests: 0, parties: [], chain: { ok: true, events: 5 }, label: 'General letter', labelId: 'Surat Umum', ...over,
})
const view = (r: RawVerification) => renderToStaticMarkup(<VerifyView model={deriveView(r)} token="AbCdEfGhIjKlMnOpQrStUvWxYz0123456789" origin="https://voraworld.id" viewedAt={new Date('2026-10-31T04:42:00Z')} />)
const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/static/css/site.css"><link rel="stylesheet" href="/static/css/feedback.css"><link rel="stylesheet" href="/static/css/verify.css"></head><body>${body}</body></html>`

export function models(): Record<string, unknown> { return { valid: deriveView(raw()), legacy: deriveView(raw({ artifacts: [], signings: [], createdAt: new Date('2026-01-01'), chain: null })) } }

export function fixtures(): Record<string, string> {
  const parties = [{ role: 'vora', name: 'PT Satu Arah International', required: true, fulfilled: true, method: 'vora_electronic' }, { role: 'counterparty', name: 'PT Mitra Dagang Contoh', required: true, fulfilled: false, method: null }]
  return {
    valid: page(view(raw())),
    revoked: page(view(raw({ tokenRevoked: true, revokedReason: 'Replaced by a corrected letter' }))),
    superseded: page(view(raw({ tokenRevoked: true, supersededByToken: 'NEWTOKEN12345678' }))),
    draft: page(view(raw({ status: 'draft', artifacts: [], signings: [], chain: null }))),
    legacy: page(view(raw({ artifacts: [], signings: [], createdAt: new Date('2026-01-01'), chain: null }))),
    agreement: page(view(raw({ documentKind: 'nda', label: 'Non-disclosure agreement (NDA)', labelId: 'Perjanjian Kerahasiaan (NDA)', parties }))),
    invoice: page(view(raw({ kind: 'invoice', documentKind: undefined, label: 'Invoice', labelId: 'Faktur (Invoice)', artifacts: [], signings: [], chain: null, live: [{ label: { en: 'Payment status', id: 'Status pembayaran' }, value: 'AWAITING PAYMENT / MENUNGGU PEMBAYARAN' }] }))),
    notfound: page(renderToStaticMarkup(<VerifyNotFound />)),
  }
}
