import { errorResponse } from '@/server/http'
import { ActionError } from '@/server/errors'
import { loadVerification } from '@/server/trust/verification-view'

/**
 * The evidence summary behind a verification page, as JSON: what the page shows and nothing more (document reference, type, issuer, status findings, the SHA-256 of each
 * recorded file, the signer's name and position, the signing references). No customer, no amount, no e-mail, no authentication data. It is read-only and it authorises
 * nothing: a token can never fetch a file, an artifact or anything private.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = (await params).token
    const model = token.length <= 150 ? await loadVerification(token) : null
    if (!model) throw new ActionError('No verification record found', 404)
    const body = {
      schema: 'vora.verification.summary/1', generatedAt: new Date().toISOString(), domain: 'voraworld.id',
      document: { type: model.label, reference: model.reference, issuer: model.issuer, date: model.issuedOn },
      status: model.banner,
      findings: { issuance: model.issuance, signing: model.signing, assurance: model.assurance, executed: model.executed, evidenceHistory: model.chain },
      files: model.artifacts.map((a) => ({ version: a.version, role: a.role, sha256: a.sha256, recordedAt: a.issuedAt, attestation: a.attested, attestationKeyId: a.keyId })),
      originalFileSha256: model.source?.originalSha256 ?? null,
      signings: model.signings.map((s) => ({ reference: s.ref, signer: s.signerName, position: s.signerPosition, purpose: s.purpose, signedAt: s.signedAt, version: s.version, method: 'electronic signature, non-certified, passkey-authenticated' })),
      parties: model.parties.map((p) => ({ role: p.role, name: p.name, required: p.required, fulfilled: p.fulfilled, method: p.method })),
      notice: 'A screenshot is not independent verification evidence. Check the document on the official verification page. This summary is a record of what VORA holds; it is not a certified electronic seal or a certified signature.',
    }
    return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': `inline; filename="verification-${model.reference.replace(/[^A-Za-z0-9._-]/g, '_')}.json"` } })
  } catch (e) {
    return errorResponse(e)
  }
}
