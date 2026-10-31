import { requireUser } from '@/server/auth/guard'
import { many, rpc } from '@/server/data'
import { ActionError } from '@/server/errors'
import { errorResponse, routeId } from '@/server/http'
import { isTrustKind } from '@/content/trust-policy'

/**
 * The controlled evidence export of one document, for an administrator: its files and their fingerprints, the attestations with the public key to check them, the whole
 * hash-linked evidence history, and the signing events (who, in what position, for what, when, with which consent and which kind of authentication). It carries no secret
 * and no personal data beyond the signer's name and position that the verification page shows anyway: no e-mail, no IP address, no key material of any kind other than
 * PUBLIC keys. Exporting is itself recorded in the history.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const user = await requireUser(request)
    const { kind, id: raw } = await params
    const id = routeId(raw)
    if (!isTrustKind(kind) || !id) throw new ActionError('Not found', 404)
    const artifacts = await many('document_artifacts', (q) => q.eq('kind', kind).eq('document_id', id).order('version'))
    if (!artifacts.length) throw new ActionError('This document has no recorded evidence (it was issued before the evidence system, or is not issued)', 404)
    const attestations = await many('document_attestations', (q) => q.in('artifact_id', artifacts.map((a) => a.id as number)))
    const keys = await many('attestation_keys', (q) => q.in('key_id', [...new Set(attestations.map((a) => a.keyId as string))]), 'key_id,algorithm,public_key,status,created_at,retired_at,compromised_at')
    const events = await many('evidence_events', (q) => q.eq('kind', kind).eq('document_id', id).order('id'), 'id,event_type,artifact_id,actor_id,payload,prev_hash,hash,created_at')
    const signings = await many('signing_events', (q) => q.eq('kind', kind).eq('document_id', id).order('id'), 'ref,purpose,signer_name,signer_position,payload_canonical,payload_sha256,consent,authentication,placement,signed_at,source_artifact_id,signed_artifact_id')
    const parties = await many('document_parties', (q) => q.eq('kind', kind).eq('document_id', id).order('id'), 'role,name,required,method,evidence_note,fulfilled_at')
    const chain = await rpc('trust_verify_evidence', { p_kind: kind, p_document: id })
    await rpc('trust_append_evidence', { p_kind: kind, p_document: id, p_type: 'evidence_exported', p_actor: user.id, p_artifact: null, p_payload: {} })
    const body = {
      schema: 'vora.evidence.export/1', exportedAt: new Date().toISOString(), kind, documentId: id,
      files: artifacts.map((a) => ({ version: a.version, role: a.role, sha256: a.sha256, bytes: a.byteSize, pages: a.pages, sourceSha256: a.sourceSha256, recordedAt: a.createdAt })),
      attestations: attestations.map((a) => ({ artifactId: a.artifactId, keyId: a.keyId, algorithm: a.algorithm, payload: a.payloadCanonical, signature: a.signature, issuedAt: a.issuedAt })),
      attestationKeys: keys, evidenceHistory: { chain, events }, signings, parties,
      verify: 'Each attestation is an Ed25519 signature (base64url) over its payload text; check it with the SPKI public key of keyId (base64 DER). Each history event hash is SHA-256 over prev_hash|kind|document|type|actor|artifact|payload|time, as trust_event_hash defines it.',
      notice: 'An internal application attestation and a non-certified electronic signature. Neither is a PSrE-certified electronic seal or signature.',
    }
    return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': `attachment; filename="evidence-${kind}-${id}.json"` } })
  } catch (e) { return errorResponse(e) }
}
