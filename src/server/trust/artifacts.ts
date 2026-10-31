import { randomUUID } from 'node:crypto'
import { many, one, rpc } from '../data'
import { sha256Hex } from '../crypto'
import { ActionError } from '../errors'
import { maxUploadBytes } from '../env'
import { getObject, putObject, removeObject } from '../storage'
import { getVerification, type DocumentKind } from '../verification'
import { attestationPayload, configuredSigner, signAttestation, type AttestationSigner } from './attestation'

/**
 * Immutable issued files. When a document is issued, the exact PDF is stored once, in private storage, with its SHA-256 and a VORA attestation; every later
 * download is those bytes, never a new rendering. A signing makes a NEW version (the signed file) from the one before; no version is ever changed.
 *
 * A document issued before this system has no artifact. It is not given one retroactively (that would claim an archived original that was never kept): it keeps
 * being rendered live as before and the verification page says so.
 */
export interface Artifact {
  id: number; kind: string; documentId: number; version: number; role: 'issued' | 'signed'; storageKey: string; sha256: string; byteSize: number; pages: number | null
  sourceSha256: string | null; supersedesArtifactId: number | null; createdAt: Date
}

const row = (r: Record<string, unknown>): Artifact => r as unknown as Artifact

export async function artifactsOf(kind: DocumentKind, documentId: number): Promise<Artifact[]> {
  return (await many('document_artifacts', (q) => q.eq('kind', kind).eq('document_id', documentId).order('version'))).map(row)
}
export async function latestArtifact(kind: DocumentKind, documentId: number): Promise<Artifact | undefined> {
  return (await artifactsOf(kind, documentId)).at(-1)
}

/** The bytes of an artifact, after their SHA-256 has been compared with the one recorded when it was stored. A stored file that differs is refused, never served. */
export async function readArtifact(a: Pick<Artifact, 'storageKey' | 'sha256'>): Promise<Uint8Array> {
  const bytes = await getObject('documents', a.storageKey, maxUploadBytes() * 2 + 65536)
  if ((await sha256Hex(bytes)) !== a.sha256) throw new ActionError('The stored file does not match its recorded fingerprint', 409)
  return bytes
}

let checked: { id: string; at: number; ok: boolean } | undefined
/** The configured signer, only when it matches the ONE active key registered in the database (same id, same public key); otherwise null and the reason is logged. */
export async function activeSigner(): Promise<AttestationSigner | null> {
  let signer: AttestationSigner | null
  try { signer = configuredSigner() } catch (e) { console.error('[trust] the attestation key is not usable:', e instanceof Error ? e.message : e); return null }
  if (!signer) return null
  const fingerprint = `${signer.keyId}:${signer.publicKeyB64}`
  if (checked?.id === fingerprint && Date.now() - checked.at < 60_000) return checked.ok ? signer : null
  const key = await one('attestation_keys', (q) => q.eq('key_id', signer!.keyId), 'key_id,public_key,status')
  const ok = Boolean(key && key.status === 'active' && key.publicKey === signer.publicKeyB64)
  checked = { id: fingerprint, at: Date.now(), ok }
  if (!ok) console.error(`[trust] attestation key ${signer.keyId} is not the active key registered in attestation_keys: documents are issued WITHOUT an attestation until it is`)
  return ok ? signer : null
}

export interface IssueInput {
  kind: DocumentKind; documentId: number; number: string; documentType: string
  bytes: Uint8Array; pages: number | null
  role: 'issued' | 'signed'
  /** The user who issued it; null for the system. */
  actorId: number | null
  /** The original third-party file, for a document VORA stamps rather than writes. */
  sourceSha256?: string | null
  /** Signed artifacts only. */
  signing?: { ref: string; signerProfileId: number }
  summary?: Record<string, unknown>
}

export interface Issued { artifactId: number; sha256: string; version: number; attested: boolean; storageKey: string }

/**
 * Stores a PDF as the next artifact of a document and records it, with its attestation and evidence, in one transaction (trust_record_issuance). The file is
 * stored first under a name nobody can guess, and removed again if the record is refused (for example because another issuance won), so nothing is left behind.
 */
export async function issueArtifact(i: IssueInput): Promise<Issued> {
  const verification = await getVerification(i.kind, i.documentId)
  if (!verification || verification.revoked) throw new ActionError('The document has no active verification record', 409)
  const sha256 = await sha256Hex(i.bytes)
  const version = await rpc<number>('trust_next_version', { p_kind: i.kind, p_document: i.documentId })
  const previous = version > 1 ? (await artifactsOf(i.kind, i.documentId)).at(-1) : undefined
  const storageKey = `trust/${i.kind}/${i.documentId}/v${version}-${randomUUID()}.pdf`
  const signer = await activeSigner()
  let attestation: { keyId: string; canonical: string; signature: string } | null = null
  if (signer) {
    attestation = signAttestation(signer, attestationPayload({
      kind: i.kind, documentId: i.documentId, number: i.number, documentType: i.documentType, version, role: i.role, sha256, sourceSha256: i.sourceSha256 ?? null,
      previousSha256: previous?.sha256 ?? null, tokenSha256: await sha256Hex(verification.token), issuedAt: new Date(), issuedBy: i.actorId ? `user:${i.actorId}` : 'service',
      signingRef: i.signing?.ref ?? null, signerProfileId: i.signing?.signerProfileId ?? null,
    }))
  }
  await putObject('documents', storageKey, i.bytes, 'application/pdf')
  try {
    if (i.role !== 'issued') throw new Error('A signed artifact is recorded by the signing transaction (prepareSignedArtifact + trust_complete_signing)')
    const id = await rpc<number>('trust_record_issuance', {
      p_actor: i.actorId, p_kind: i.kind, p_document: i.documentId, p_expected_version: version,
      p: { storage_key: storageKey, sha256, byte_size: i.bytes.length, pages: i.pages, source_sha256: i.sourceSha256 ?? null, role: i.role, key_id: attestation?.keyId ?? null,
           payload_canonical: attestation?.canonical ?? null, signature: attestation?.signature ?? null, summary: i.summary ?? {} },
    })
    return { artifactId: id, sha256, version, attested: Boolean(attestation), storageKey }
  } catch (e) {
    await removeObject('documents', storageKey)
    throw e
  }
}

/**
 * Prepares a signed artifact for the signing transaction: stores the file and builds its attestation, but records nothing. The caller passes `artifact` to
 * `trust_complete_signing`, which records it together with the signing event, or removes the stored file when that is refused.
 */
export async function prepareSignedArtifact(i: Omit<IssueInput, 'role' | 'actorId'> & { signing: { ref: string; signerProfileId: number }; actorId: number }): Promise<{
  storageKey: string; sha256: string; version: number; payload: { storage_key: string; sha256: string; byte_size: number; pages: number | null; key_id: string | null; payload_canonical: string | null; signature: string | null }
}> {
  const verification = await getVerification(i.kind, i.documentId)
  if (!verification || verification.revoked) throw new ActionError('The document has no active verification record', 409)
  const sha256 = await sha256Hex(i.bytes)
  const version = await rpc<number>('trust_next_version', { p_kind: i.kind, p_document: i.documentId })
  const previous = (await artifactsOf(i.kind, i.documentId)).at(-1)
  const storageKey = `trust/${i.kind}/${i.documentId}/v${version}-${randomUUID()}.pdf`
  const signer = await activeSigner()
  const attestation = signer ? signAttestation(signer, attestationPayload({
    kind: i.kind, documentId: i.documentId, number: i.number, documentType: i.documentType, version, role: 'signed', sha256, sourceSha256: i.sourceSha256 ?? null,
    previousSha256: previous?.sha256 ?? null, tokenSha256: await sha256Hex(verification.token), issuedAt: new Date(), issuedBy: `user:${i.actorId}`, signingRef: i.signing.ref, signerProfileId: i.signing.signerProfileId,
  })) : null
  await putObject('documents', storageKey, i.bytes, 'application/pdf')
  return { storageKey, sha256, version, payload: { storage_key: storageKey, sha256, byte_size: i.bytes.length, pages: i.pages, key_id: attestation?.keyId ?? null, payload_canonical: attestation?.canonical ?? null, signature: attestation?.signature ?? null } }
}
