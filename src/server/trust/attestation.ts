import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import { b64url, fromB64url } from '../crypto'
import { canonicalize } from './canonical'

/**
 * VORA's organisational issuance attestation: an Ed25519 signature over a canonical description of one issued file (its kind, number, version, SHA-256,
 * verification token digest and the time it was issued). The private key is a secret of the server (VORA_ATTESTATION_PRIVATE_KEY, never in the database or
 * the repository); its public half and its key id are listed in `attestation_keys`, so that anybody can check an attestation, long after the key was
 * rotated out, with the public key alone.
 *
 * WHAT THIS IS NOT: it is an internal application attestation. It is not a PSrE-certified electronic seal (segel elektronik) and not anyone's electronic signature.
 */
export const ISSUER_NAME = 'PT Satu Arah International'
export const ATTESTATION_TYPE = 'vora.document.attestation'

export interface AttestationInput {
  kind: string; documentId: number; number: string; documentType: string; version: number; role: 'issued' | 'signed'
  sha256: string; sourceSha256?: string | null; previousSha256?: string | null; tokenSha256: string; issuedAt: Date
  issuedBy: string
  signingRef?: string | null; signerProfileId?: number | null
}

/** The payload that is signed. Every field is an integer, a boolean, text or null, so its canonical form is unambiguous. */
export function attestationPayload(a: AttestationInput): Record<string, string | number | null> {
  return {
    v: 1, type: ATTESTATION_TYPE, issuer: ISSUER_NAME, domain: 'voraworld.id',
    kind: a.kind, document_id: a.documentId, number: a.number, document_type: a.documentType, version: a.version, role: a.role,
    sha256: a.sha256, source_sha256: a.sourceSha256 ?? null, previous_sha256: a.previousSha256 ?? null, token_sha256: a.tokenSha256,
    issued_at: a.issuedAt.toISOString(), issued_by: a.issuedBy, signing_ref: a.signingRef ?? null, signer_profile_id: a.signerProfileId ?? null,
  }
}

export interface AttestationSigner { keyId: string; publicKeyB64: string; sign(canonical: string): string }

/** The private key as configured: base64 of the PKCS#8 DER, or a PEM. Anything else is refused rather than guessed at. */
function loadPrivateKey(raw: string): KeyObject {
  const text = raw.trim()
  const key = text.includes('BEGIN') ? createPrivateKey(text) : createPrivateKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'pkcs8' })
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('The attestation key must be an Ed25519 key')
  return key
}

export const publicKeyOf = (key: KeyObject): string => createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64')

export function signerFrom(keyId: string, privateKeyRaw: string): AttestationSigner {
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(keyId)) throw new Error('VORA_ATTESTATION_KEY_ID is not a valid key id')
  const key = loadPrivateKey(privateKeyRaw)
  return { keyId, publicKeyB64: publicKeyOf(key), sign: (canonical) => b64url(sign(null, Buffer.from(canonical, 'utf8'), key)) }
}

/** The configured signer, or null when no key is provisioned (issuance then proceeds and records that no attestation could be made). */
export function configuredSigner(): AttestationSigner | null {
  const id = process.env.VORA_ATTESTATION_KEY_ID?.trim(), key = process.env.VORA_ATTESTATION_PRIVATE_KEY?.trim()
  if (!id || !key) return null
  return signerFrom(id, key)
}

export function signAttestation(signer: AttestationSigner, payload: Record<string, string | number | null>): { keyId: string; canonical: string; signature: string } {
  const canonical = canonicalize(payload)
  return { keyId: signer.keyId, canonical, signature: signer.sign(canonical) }
}

/** Checks a signature over a canonical text with a public key (base64 SPKI DER). False for anything malformed. */
export function verifyAttestation(canonical: string, signature: string, publicKeyB64: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' })
    return verify(null, Buffer.from(canonical, 'utf8'), key, Buffer.from(fromB64url(signature)))
  } catch { return false }
}
