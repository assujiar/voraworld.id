import { createHash } from 'node:crypto'
import { b64url } from '../crypto'
import { canonicalize } from './canonical'

/**
 * The exact thing a person signs. It names the file by its SHA-256 and version, the signer, the purpose, where the signing mark goes, and every confirmation the person
 * gave, in canonical JSON; the passkey is asked to sign the SHA-256 of that text (it IS the WebAuthn challenge). So the authentication belongs to this document, this
 * signer, this purpose, this placement and this consent, and to nothing else: change any of them and the challenge, and so the assertion, no longer fits.
 *
 * Authentication alone is not consent. The consent is a separate, explicit set of confirmations, recorded in the payload and in the evidence with the statement the person was shown.
 */
export const CONSENT_VERSION = 'consent-v1'
export const CONFIRMATIONS = ['reviewed_document', 'confirmed_version', 'confirmed_purpose', 'confirmed_placement', 'consent_to_sign'] as const
export type Confirmation = (typeof CONFIRMATIONS)[number]

export const CONFIRMATION_TEXT: Record<Confirmation, { en: string; id: string }> = {
  reviewed_document: { en: 'I have read the complete document.', id: 'Saya telah membaca dokumen secara lengkap.' },
  confirmed_version: { en: 'I confirm that the version and fingerprint (SHA-256) shown are the file I am signing.', id: 'Saya mengonfirmasi bahwa versi dan sidik jari (SHA-256) yang ditampilkan adalah berkas yang saya tandatangani.' },
  confirmed_purpose: { en: 'I confirm the purpose of my signature shown above.', id: 'Saya mengonfirmasi tujuan tanda tangan saya yang tertera di atas.' },
  confirmed_placement: { en: 'I confirm where my signing mark appears on the pages, as shown in the preview.', id: 'Saya mengonfirmasi posisi tanda tangan saya pada halaman, sebagaimana ditampilkan pada pratinjau.' },
  consent_to_sign: { en: 'I sign this document electronically, in my own name. I understand this is a non-certified electronic signature.', id: 'Saya menandatangani dokumen ini secara elektronik atas nama saya sendiri. Saya memahami ini adalah tanda tangan elektronik tidak tersertifikasi.' },
}

/** The statement the person is shown, in both languages: it is hashed into the payload, so what they agreed to is on record exactly. */
export function consentStatement(): string {
  return CONFIRMATIONS.map((c) => `${CONFIRMATION_TEXT[c].en} | ${CONFIRMATION_TEXT[c].id}`).join('\n')
}
export const consentStatementSha256 = (): string => createHash('sha256').update(consentStatement(), 'utf8').digest('hex')

export interface Placement { pages: 'first' | 'last' | 'all' | 'one'; page_number: number | null; corner: string; size: 'small' | 'medium'; pos_x: string | null; pos_y: string | null }

export interface SigningPayloadInput {
  requestRef: string; kind: string; documentId: number; documentNumber: string
  sourceArtifactId: number; sourceVersion: number; sourceSha256: string
  signerProfileId: number; signerUserId: number; signerName: string; signerPosition: string
  purpose: string; partyRole: string; placement: Placement
  confirmations: Record<Confirmation, true>
  nonce: string; issuedAt: Date; expiresAt: Date
}

export function signingPayload(i: SigningPayloadInput): Record<string, unknown> {
  return {
    v: 1, type: 'vora.signing.payload', domain: 'voraworld.id', request_ref: i.requestRef, kind: i.kind, document_id: i.documentId, document_number: i.documentNumber,
    source: { artifact_id: i.sourceArtifactId, version: i.sourceVersion, sha256: i.sourceSha256 },
    signer: { profile_id: i.signerProfileId, user_id: i.signerUserId, name: i.signerName, position: i.signerPosition },
    purpose: i.purpose, party_role: i.partyRole, placement: i.placement,
    consent: { version: CONSENT_VERSION, statement_sha256: consentStatementSha256(), confirmations: i.confirmations },
    nonce: i.nonce, issued_at: i.issuedAt.toISOString(), expires_at: i.expiresAt.toISOString(),
  }
}

/** The WebAuthn challenge for a payload: the SHA-256 of its canonical text, base64url, and the canonical text itself. */
export function challengeOf(payload: Record<string, unknown>): { canonical: string; challenge: string; sha256: string } {
  const canonical = canonicalize(payload)
  const digest = createHash('sha256').update(canonical, 'utf8').digest()
  return { canonical, challenge: b64url(digest), sha256: digest.toString('hex') }
}

/** Every confirmation must be given, each explicitly true: one missing or false and nothing is signed. */
export function checkedConfirmations(raw: unknown): Record<Confirmation, true> {
  const given = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const missing = CONFIRMATIONS.filter((c) => given[c] !== true)
  if (missing.length) throw new TypeError(`Every confirmation is required before signing (missing: ${missing.join(', ')})`)
  return Object.fromEntries(CONFIRMATIONS.map((c) => [c, true])) as Record<Confirmation, true>
}

const SIZES = ['small', 'medium'], PAGES = ['first', 'last', 'all', 'one'], CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom']
/** The placement as submitted, checked: nothing the PDF would have to guess. */
export function checkedPlacement(raw: unknown): Placement {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pages = String(p.pages), corner = String(p.corner), size = String(p.size)
  if (!PAGES.includes(pages) || !CORNERS.includes(corner) || !SIZES.includes(size)) throw new TypeError('The placement is not valid')
  const frac = (v: unknown) => (typeof v === 'string' && /^(0|1|0?\.\d{1,4}|1\.0{1,4})$/.test(v) ? v : null)
  const x = frac(p.pos_x), y = frac(p.pos_y)
  if (corner === 'custom' && (x === null || y === null)) throw new TypeError('Place the signing mark on the page')
  const page = p.page_number === null || p.page_number === undefined || p.page_number === '' ? null : Number(p.page_number)
  if (pages === 'one' && (!Number.isInteger(page) || (page as number) < 1 || (page as number) > 500)) throw new TypeError('Choose the page')
  return { pages: pages as Placement['pages'], page_number: pages === 'one' ? page : null, corner, size: size as Placement['size'], pos_x: corner === 'custom' ? x : null, pos_y: corner === 'custom' ? y : null }
}
