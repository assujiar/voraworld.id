import { randomBytes } from 'node:crypto'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { b64url, sha256Hex } from '../crypto'
import { many, one, rpc, insert, update } from '../data'
import { businessDateTime } from '../dates'
import { documentType } from '../../content/document-types'
import { PURPOSE_LABELS, SIGNING_PURPOSES, signingEligibility, trustPolicy, type SigningPurpose } from '../../content/trust-policy'
import { ActionError } from '../errors'
import type { SessionUser } from '../auth/guard'
import { removeObject } from '../storage'
import { getVerification, type DocumentKind } from '../verification'
import { sealPdf } from '../pdf/seal'
import { artifactsOf, prepareSignedArtifact, readArtifact } from './artifacts'
import { canonicalize } from './canonical'
import { challengeOf, checkedConfirmations, checkedPlacement, consentStatement, consentStatementSha256, CONSENT_VERSION, signingPayload, type Placement } from './signing-payload'
import { challengeOfResponse, registrationOptions, relyingParty, signingRequestOptions, verifyAssertion, verifyRegistration, type StoredCredential } from './webauthn'

/**
 * The electronic signing ceremony: a non-certified electronic signature by an authorised individual, authenticated with a passkey of their own, after explicit consent to
 * one exact file. The steps, each refused if it does not hold (and each checked again inside `trust_complete_signing`, in the database, under lock):
 *   request    an administrator asks a named signer to sign a document that VORA issued; the document's policy must allow it (a high-risk kind waits for a recorded legal review);
 *   begin      the SIGNER, signed in as themselves, confirms the document (its version and SHA-256), the purpose, the placement and gives consent; the server builds the payload and
 *              the passkey challenge is that payload's hash;
 *   finish     the passkey answers; the challenge is used once; the assertion is verified for this site, with user verification; the file is signed, stored, attested and recorded.
 * Nobody else can complete it: the session's own account must be the signer, and a preparer's session is not a signer's consent.
 */
const REQUEST_DAYS = 3
const CHALLENGE_MINUTES = 5

export interface SignerProfile { id: number; userId: number; displayName: string; position: string; status: string }

export async function profileOfUser(userId: number): Promise<SignerProfile | undefined> {
  return (await one('signer_profiles', (q) => q.eq('user_id', userId))) as SignerProfile | undefined
}

const credentialsOf = async (profileId: number): Promise<Array<StoredCredential & { id: number }>> =>
  (await many('signer_credentials', (q) => q.eq('profile_id', profileId).is('revoked_at', null).order('id'))).map((c) => ({ id: c.id as number, credentialId: c.credentialId as string, publicKey: c.publicKey as string, counter: Number(c.counter), transports: (c.transports as string[] | null) ?? null }))

/** Creates the profile of a user: the name and position they will be called on documents, set by an administrator. It carries no authority until another administrator grants it. */
export async function createProfile(actor: SessionUser, userId: number, displayName: string, position: string): Promise<number> {
  const name = displayName.replace(/\s+/g, ' ').trim(), pos = position.replace(/\s+/g, ' ').trim()
  if (name.length < 3 || name.length > 160 || pos.length < 2 || pos.length > 160) throw new ActionError('Write the signer\'s full name and position')
  const user = await one('users', (q) => q.eq('id', userId), 'id,active,auth_user_id')
  if (!user || !user.active || !user.authUserId) throw new ActionError('The signer must be an active user with a Supabase Auth account', 422)
  if (await profileOfUser(userId)) throw new ActionError('This user already has a signer profile', 409)
  const [row] = await insert('signer_profiles', { user_id: userId, display_name: name, position: pos })
  await rpc('vr_audit', { p_actor: actor.id, p_verb: 'create', p_type: 'signer_profile', p_id: row.id as number, p_summary: name })
  return row.id as number
}

export async function grantAuthority(actor: SessionUser, profileId: number, scope: string[], validUntil: Date | null, note: string): Promise<number> {
  const clean = [...new Set(scope.map((s) => s.trim()).filter(Boolean))]
  if (!clean.length || clean.some((s) => !/^(\*|[a-z_]{2,30})$/.test(s))) throw new ActionError('Choose what the signer may sign')
  return rpc<number>('trust_authority_grant', { p_actor: actor.id, p_profile: profileId, p_scope: clean, p_valid_until: validUntil?.toISOString() ?? null, p_note: note.slice(0, 300) })
}

export async function revokeAuthority(actor: SessionUser, authorityId: number, reason: string): Promise<void> {
  if (reason.trim().length < 5) throw new ActionError('Give a reason of at least 5 characters')
  const done = await update('signer_authorities', { revoked_at: new Date(), revoked_by: actor.id, revoke_reason: reason.trim().slice(0, 300) }, (q) => q.eq('id', authorityId).is('revoked_at', null))
  if (!done.length) throw new ActionError('That authority is already ended', 409)
}

export async function revokePasskey(user: SessionUser, credentialRowId: number): Promise<void> {
  const profile = await profileOfUser(user.id)
  if (!profile) throw new ActionError('No signer profile', 404)
  await update('signer_credentials', { revoked_at: new Date() }, (q) => q.eq('id', credentialRowId).eq('profile_id', profile.id).is('revoked_at', null))
}

// ------------------------------------------------------------------ passkeys

async function activeProfile(user: SessionUser): Promise<SignerProfile> {
  const profile = await profileOfUser(user.id)
  if (!profile) throw new ActionError('You have no signer profile: ask an administrator to create one', 403)
  if (profile.status === 'suspended') throw new ActionError('Your signer profile is suspended', 403)
  return profile
}

export async function beginPasskeyRegistration(user: SessionUser) {
  const profile = await activeProfile(user)
  const options = await registrationOptions({ userId: user.id, email: user.email, displayName: profile.displayName, existing: await credentialsOf(profile.id) })
  await insert('signing_challenges', { purpose: 'register', profile_id: profile.id, challenge: options.challenge, expires_at: new Date(Date.now() + CHALLENGE_MINUTES * 60_000) })
  return options
}

export async function finishPasskeyRegistration(user: SessionUser, response: RegistrationResponseJSON, label: string): Promise<void> {
  const profile = await activeProfile(user)
  const challenge = challengeOfResponse(response)
  await rpc('trust_consume_challenge', { p_challenge: challenge, p_profile: profile.id, p_purpose: 'register' })
  let c: Awaited<ReturnType<typeof verifyRegistration>>
  try { c = await verifyRegistration(response, challenge) } catch (e) { throw new ActionError(e instanceof Error ? e.message : 'The passkey could not be verified', 422) }
  await insert('signer_credentials', { profile_id: profile.id, credential_id: c.credentialId, public_key: c.publicKey, counter: c.counter, transports: c.transports, device_type: c.deviceType, backed_up: c.backedUp, label: label.trim().slice(0, 80) || null })
  await rpc('vr_audit', { p_actor: user.id, p_verb: 'register', p_type: 'signer_passkey', p_id: profile.id, p_summary: c.deviceType })
}

// ------------------------------------------------------------------ requests

interface DocFacts { kind: DocumentKind; id: number; number: string; documentKind?: string; language: 'id' | 'en'; status: string }

async function docFacts(kind: DocumentKind, id: number): Promise<DocFacts> {
  const table = { invoice: 'invoices', quotation: 'quotations', receipt: 'receipts', prepayment: 'prepayment_receipts', document: 'documents', delivery: 'deliveries', pod: 'delivery_proofs' }[kind]
  const row = await one(table, (q) => q.eq('id', id))
  if (!row) throw new ActionError('Document not found', 404)
  const number = kind === 'pod' ? String((await one('deliveries', (q) => q.eq('id', row.deliveryId as number), 'number'))?.number ?? '') : String(row.number)
  return { kind, id, number, documentKind: kind === 'document' ? (row.kind as string) : undefined, language: kind === 'document' ? (row.language as 'id' | 'en') : 'en', status: String(row.status) }
}

export interface RequestInput { kind: DocumentKind; documentId: number; signerProfileId: number; purpose: string; partyRole?: string; legalReviewNote?: string }

export async function requestSigning(actor: SessionUser, i: RequestInput): Promise<{ id: number; ref: string }> {
  if (!SIGNING_PURPOSES.includes(i.purpose as SigningPurpose)) throw new ActionError('Choose the purpose of the signature')
  const doc = await docFacts(i.kind, i.documentId)
  const policy = trustPolicy(i.kind, doc.documentKind)
  const eligible = signingEligibility(policy)
  if (!eligible.ok) throw new ActionError(eligible.message.en, 422)
  if (doc.status !== 'issued' && !['paid', 'partially_paid', 'delivered', 'validated', 'approved', 'awaiting_approval'].includes(doc.status)) throw new ActionError('Only an issued document can be signed', 409)
  const verification = await getVerification(i.kind, i.documentId)
  if (!verification || verification.revoked) throw new ActionError('The document is revoked or has no verification record', 409)
  const artifacts = await artifactsOf(i.kind, i.documentId)
  const latest = artifacts.at(-1)
  if (!latest) throw new ActionError('This document has no archived issued file to sign: documents issued before the signing system are re-issued to be signed (see KNOWN_LIMITATIONS)', 409)
  const profile = (await one('signer_profiles', (q) => q.eq('id', i.signerProfileId))) as SignerProfile | undefined
  if (!profile) throw new ActionError('Signer not found', 404)
  const authorised = await rpc<boolean>('trust_signer_authorized', { p_profile: profile.id, p_family: policy.family })
  if (!authorised) throw new ActionError(`${profile.displayName} holds no current authority to sign this kind of document`, 403)
  const note = (i.legalReviewNote ?? '').trim()
  if (eligible.needsLegalReview && note.length < 10) throw new ActionError('This kind of document needs a recorded legal review before it is signed electronically: write who reviewed it and what was decided (at least 10 characters)', 422)
  const ref = `VORA-SIG-${randomBytes(4).toString('hex').toUpperCase()}`
  const [row] = await insert('signing_requests', {
    ref, kind: i.kind, document_id: i.documentId, family: policy.family, source_artifact_id: latest.id, source_sha256: latest.sha256, signer_profile_id: profile.id, purpose: i.purpose, party_role: i.partyRole || 'vora',
    created_by: actor.id, legal_review_note: eligible.needsLegalReview ? note.slice(0, 500) : null, legal_review_by: eligible.needsLegalReview ? actor.id : null, expires_at: new Date(Date.now() + REQUEST_DAYS * 86_400_000),
  }).catch((e: Error & { code?: string }) => { if (e.code === '23505') throw new ActionError('There is already an open signing request for this document and signer', 409); throw e })
  await rpc('trust_append_evidence', { p_kind: i.kind, p_document: i.documentId, p_type: 'signing_requested', p_actor: actor.id, p_artifact: latest.id, p_payload: { ref, signer_profile_id: profile.id, purpose: i.purpose } })
  if (eligible.needsLegalReview) await rpc('trust_append_evidence', { p_kind: i.kind, p_document: i.documentId, p_type: 'legal_review_recorded', p_actor: actor.id, p_artifact: latest.id, p_payload: { ref, note: note.slice(0, 500) } })
  return { id: row.id as number, ref }
}

export async function cancelRequest(actor: SessionUser, requestId: number, reason: string): Promise<void> {
  const done = await update('signing_requests', { status: 'cancelled', completed_at: new Date() }, (q) => q.eq('id', requestId).eq('status', 'pending'))
  if (!done.length) throw new ActionError('That request is not open', 409)
  const r = done[0]
  await rpc('trust_append_evidence', { p_kind: r.kind as string, p_document: r.documentId as number, p_type: 'signing_cancelled', p_actor: actor.id, p_artifact: r.sourceArtifactId as number, p_payload: { ref: r.ref, reason: reason.slice(0, 200) } })
}

interface OpenRequest { id: number; ref: string; kind: DocumentKind; documentId: number; family: string; sourceArtifactId: number; sourceSha256: string; signerProfileId: number; purpose: string; partyRole: string; status: string; expiresAt: Date }

/** The request, for the signer only: anyone else's session is refused, whoever they are and whatever role they hold. */
async function requestForSigner(user: SessionUser, requestId: number): Promise<{ request: OpenRequest; profile: SignerProfile }> {
  const request = (await one('signing_requests', (q) => q.eq('id', requestId))) as OpenRequest | undefined
  if (!request) throw new ActionError('Signing request not found', 404)
  const profile = await activeProfile(user)
  if (request.signerProfileId !== profile.id) throw new ActionError('This request is for another signer: only the person named can sign', 403)
  if (request.status !== 'pending') throw new ActionError('This signing request is no longer open', 409)
  if (new Date(request.expiresAt).getTime() <= Date.now()) throw new ActionError('This signing request has expired', 409)
  return { request, profile }
}

/** What the signer sees before anything is signed: the document, the exact version and fingerprint, and the text of the consent. */
export async function ceremonyView(user: SessionUser, requestId: number) {
  const { request, profile } = await requestForSigner(user, requestId)
  const doc = await docFacts(request.kind, request.documentId)
  const latest = (await artifactsOf(request.kind, request.documentId)).at(-1)!
  const policy = trustPolicy(request.kind, doc.documentKind)
  return { request, profile, doc, artifact: { id: latest.id, version: latest.version, sha256: latest.sha256 }, changed: latest.id !== request.sourceArtifactId || latest.sha256 !== request.sourceSha256, family: policy.family, passkeys: (await credentialsOf(profile.id)).length, consent: consentStatement(), signatureType: policy.signature, purposeLabel: PURPOSE_LABELS[doc.language][request.purpose as SigningPurpose], verifyToken: (await getVerification(request.kind, request.documentId))?.token }
}

export async function beginSigning(user: SessionUser, requestId: number, body: { placement: unknown; confirmations: unknown }) {
  const { request, profile } = await requestForSigner(user, requestId)
  let confirmations: ReturnType<typeof checkedConfirmations>, placement: Placement
  try { confirmations = checkedConfirmations(body.confirmations); placement = checkedPlacement(body.placement) } catch (e) { throw new ActionError(e instanceof Error ? e.message : 'Invalid request', 422) }
  const doc = await docFacts(request.kind, request.documentId)
  const latest = (await artifactsOf(request.kind, request.documentId)).at(-1)
  if (!latest || latest.id !== request.sourceArtifactId || latest.sha256 !== request.sourceSha256) throw new ActionError('The document changed after this request was made: a new request is needed', 409)
  if (!(await rpc<boolean>('trust_signer_authorized', { p_profile: profile.id, p_family: request.family }))) throw new ActionError('You hold no current authority to sign this kind of document', 403)
  const credentials = await credentialsOf(profile.id)
  if (!credentials.length) throw new ActionError('Register a passkey first: it is how you prove that you are the one signing', 409)
  const now = new Date(), expires = new Date(now.getTime() + CHALLENGE_MINUTES * 60_000)
  // The signer's name and position are those of the authorised profile, never anything typed by whoever prepared the document.
  const payload = signingPayload({
    requestRef: request.ref, kind: request.kind, documentId: request.documentId, documentNumber: doc.number, sourceArtifactId: latest.id, sourceVersion: latest.version, sourceSha256: latest.sha256,
    signerProfileId: profile.id, signerUserId: user.id, signerName: profile.displayName, signerPosition: profile.position, purpose: request.purpose, partyRole: request.partyRole, placement, confirmations,
    nonce: b64url(randomBytes(16)), issuedAt: now, expiresAt: expires,
  })
  const { canonical, challenge } = challengeOf(payload)
  await insert('signing_challenges', { purpose: 'sign', profile_id: profile.id, request_id: request.id, challenge, payload_canonical: canonical, expires_at: expires })
  return signingRequestOptions(challenge, credentials)
}

export async function finishSigning(user: SessionUser, requestId: number, response: AuthenticationResponseJSON): Promise<{ ref: string; version: number }> {
  const { request, profile } = await requestForSigner(user, requestId)
  const challenge = challengeOfResponse(response)
  // Used once, here, before anything else: a failed attempt burns the challenge, and a replay finds it gone.
  const used = await rpc<{ request_id: number | null; payload_canonical: string | null }>('trust_consume_challenge', { p_challenge: challenge, p_profile: profile.id, p_purpose: 'sign' })
  if (used.request_id !== request.id || !used.payload_canonical) throw new ActionError('This authentication was not made for this request', 409)
  const canonical = used.payload_canonical
  if (b64url(Buffer.from(await sha256Hex(canonical), 'hex')) !== challenge) throw new ActionError('The signed payload does not match the authentication', 409)
  const payload = JSON.parse(canonical) as ReturnType<typeof signingPayload> & { placement: Placement; signer: { name: string; position: string; user_id: number }; source: { artifact_id: number; sha256: string; version: number }; consent: { confirmations: unknown; statement_sha256: string; version: string } }
  if (payload.request_ref !== request.ref || payload.signer.user_id !== user.id || payload.source.artifact_id !== request.sourceArtifactId) throw new ActionError('The signed payload is not for this request or this signer', 403)
  if (new Date(String(payload.expires_at)).getTime() <= Date.now()) throw new ActionError('The authentication request expired: start again', 409)

  const credential = (await credentialsOf(profile.id)).find((c) => c.credentialId === response.id)
  if (!credential) throw new ActionError('That passkey is not registered to you', 403)
  let auth: Awaited<ReturnType<typeof verifyAssertion>>
  try { auth = await verifyAssertion(response, challenge, credential) } catch (e) { throw new ActionError(e instanceof Error ? e.message : 'The authentication could not be verified', 403) }

  // The file being signed is read back from the archive (its SHA-256 re-checked) and must be the one the signer saw.
  const artifacts = await artifactsOf(request.kind, request.documentId)
  const source = artifacts.at(-1)
  if (!source || source.id !== request.sourceArtifactId || source.sha256 !== payload.source.sha256) throw new ActionError('The document changed after the request was made: the consent given does not apply to it', 409)
  const bytes = await readArtifact(source)
  const doc = await docFacts(request.kind, request.documentId)
  const verification = await getVerification(request.kind, request.documentId)
  if (!verification || verification.revoked) throw new ActionError('The document is revoked', 409)
  const signedAt = new Date()
  const p = payload.placement
  const made = await sealPdf(bytes, {
    type: trustPolicy(request.kind, doc.documentKind).signature, verificationUrl: `${relyingParty().origin}/verify/${verification.token}`, number: doc.number, lang: doc.language, pages: p.pages, corner: p.corner, size: p.size,
    pageNumber: p.page_number ? String(p.page_number) : undefined, posX: p.pos_x ?? undefined, posY: p.pos_y ?? undefined, issuedAt: `${businessDateTime(signedAt)} WIB`, signer: { name: payload.signer.name, position: payload.signer.position },
  })
  const prepared = await prepareSignedArtifact({
    kind: request.kind, documentId: request.documentId, number: doc.number, documentType: doc.documentKind ?? request.kind, bytes: made.bytes, pages: null, sourceSha256: source.sourceSha256,
    signing: { ref: request.ref, signerProfileId: profile.id }, actorId: user.id,
  })
  try {
    const event = await rpc<number>('trust_complete_signing', {
      p_request: request.id, p_expected_version: prepared.version,
      p: {
        credential_row_id: credential.id, counter: auth.newCounter, signer_name: payload.signer.name, signer_position: payload.signer.position, payload_canonical: canonical, payload_sha256: await sha256Hex(canonical),
        consent: { version: CONSENT_VERSION, statement: consentStatement(), statement_sha256: consentStatementSha256(), confirmations: payload.consent.confirmations, source_sha256: source.sha256, source_version: source.version },
        authentication: { method: 'webauthn', rp_id: auth.rpId, origin: auth.origin, user_verified: auth.userVerified, device_type: auth.deviceType, backed_up: auth.backedUp, counter_before: credential.counter, counter_after: auth.newCounter, displayed_signed_at: signedAt.toISOString() },
        placement: p, artifact: prepared.payload,
      },
    })
    void event
    return { ref: request.ref, version: prepared.version }
  } catch (e) {
    await removeObject('documents', prepared.storageKey)
    throw e
  }
}

export { canonicalize }

/** The archived file of a request, for its signer only. */
export async function ceremonyFile(user: SessionUser, requestId: number): Promise<{ bytes: Uint8Array; filename: string }> {
  const { request } = await requestForSigner(user, requestId)
  const source = (await artifactsOf(request.kind, request.documentId)).find((a) => a.id === request.sourceArtifactId)
  if (!source) throw new ActionError('Not found', 404)
  return { bytes: await readArtifact(source), filename: `${request.ref}-v${source.version}.pdf` }
}
