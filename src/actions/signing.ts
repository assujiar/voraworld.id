'use server'
import { ActionError, adminRun } from '@/server/action'
import { int, str } from '@/server/http'
import { cancelRequest, createProfile, grantAuthority, removeProfile, requestSigning, revokeAuthority, revokePasskey, signNow } from '@/server/trust/signing'
import { isTrustKind } from '@/content/trust-policy'
import { publicBaseUrl } from '@/server/env'
import { discardOwnSigning, uploadAndSign } from '@/server/trust/upload-sign'

/**
 * Who may sign, and the requests to sign. These are administrator actions; the SIGNING itself is not an action of an administrator: it is done by the signer, in their own
 * session, with their own passkey (see the ceremony routes under /admin/signing), so no action here can sign for anybody.
 */
export async function createSignerProfileAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await createProfile(user, int(form, 'user_id'), str(form, 'display_name', 160), str(form, 'position', 160))
    return { to: '/admin/signers', notice: 'Signer profile created. It carries no authority until another administrator grants it.' }
  })
}

export async function removeSignerProfileAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await removeProfile(user, int(form, 'profile_id'), str(form, 'reason', 300))
    return { to: '/admin/signers', notice: 'Signer removed. Its authority and passkeys ended; what it signed stays on record.' }
  })
}

export async function grantAuthorityAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const until = str(form, 'valid_until', 10)
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new ActionError('The end date must be a valid date')
    await grantAuthority(user, int(form, 'profile_id'), form.getAll('scope').map(String), until ? new Date(`${until}T23:59:59+07:00`) : null, str(form, 'note', 300))
    return { to: '/admin/signers', notice: 'Authority granted' }
  })
}

export async function revokeAuthorityAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await revokeAuthority(user, int(form, 'authority_id'), str(form, 'reason', 300))
    return { to: '/admin/signers', notice: 'Authority ended. It stays in the history.' }
  })
}

export async function revokePasskeyAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await revokePasskey(user, int(form, 'credential_id'))
    return { to: '/admin/signers', notice: 'Passkey removed' }
  })
}

export async function requestSigningAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const kind = str(form, 'kind', 20)
    if (!isTrustKind(kind)) throw new ActionError('Unknown document kind')
    const documentId = int(form, 'document_id')
    const made = await requestSigning(user, { kind, documentId, signerProfileId: int(form, 'signer_profile_id'), purpose: str(form, 'purpose', 20), partyRole: str(form, 'party_role', 30) || 'vora', legalReviewNote: str(form, 'legal_review_note', 500) })
    return { to: str(form, 'back', 200).startsWith('/admin/') ? str(form, 'back', 200) : '/admin', notice: `Signing requested (${made.ref}). The signer completes it from their own account.` }
  })
}

/** A signer signs a document themselves: the request is made for them and they are taken straight to the signing page (nobody has to ask them first). */
export async function signNowAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const kind = str(form, 'kind', 20)
    if (!isTrustKind(kind)) throw new ActionError('Unknown document kind')
    const id = await signNow(user, { kind, documentId: int(form, 'document_id'), purpose: str(form, 'purpose', 20) || 'signed', partyRole: str(form, 'party_role', 30) || 'vora', legalReviewNote: str(form, 'legal_review_note', 500) })
    return { to: `/admin/signing/${id}` }
  })
}

/** A signer uploads a document that somebody else issued and signs it, with nobody asking them to: they are taken straight to the signing page. */
export async function uploadAndSignAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const file = form.get('source_pdf')
    if (!(file instanceof File) || !file.size) throw new ActionError('Choose the PDF to sign')
    const id = await uploadAndSign(user, { file, title: str(form, 'source_title', 160), issuer: str(form, 'source_issuer', 160), reference: str(form, 'source_reference', 100), language: str(form, 'language', 2), baseUrl: publicBaseUrl() })
    return { to: `/admin/signing/${id}` }
  })
}

/** A signer drops a signing they started themselves and did not finish. */
export async function discardSigningAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await discardOwnSigning(user, int(form, 'request_id'))
    return { to: '/admin/signing', notice: 'Dropped. Nothing was signed.' }
  })
}

export async function cancelSigningRequestAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await cancelRequest(user, int(form, 'request_id'), str(form, 'reason', 200) || 'cancelled')
    return { to: str(form, 'back', 200).startsWith('/admin/') ? str(form, 'back', 200) : '/admin', notice: 'Signing request cancelled' }
  })
}

const EXTERNAL_METHODS = ['external_pdf_uploaded', 'wet_ink_uploaded', 'manually_validated', 'external_certified_verified']

/** The parties an agreement needs, taken from its first and second party. Tracking them starts when someone asks; VORA's own signing fulfils only its own part. */
export async function trackPartiesAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'document_id')
    const { one, insert } = await import('@/server/data')
    const doc = await one('documents', (q) => q.eq('id', id), 'id,status,fields')
    if (!doc) throw new ActionError('Document not found', 404)
    const v = ((doc.fields as { values?: Record<string, string> }).values) ?? {}
    const rows = [['first', v.first_company], ['second', v.second_company]].filter(([, name]) => name).map(([role, name]) => ({ kind: 'document', document_id: id, role, name }))
    if (!rows.length) throw new ActionError('This document names no parties to track', 422)
    await insert('document_parties', rows).catch((e: Error & { code?: string }) => { if (e.code === '23505') throw new ActionError('The parties are already tracked', 409); throw e })
    void user
    return { to: `/admin/documents/${id}`, notice: 'The parties are now tracked: the agreement counts as executed only when each required party has signed or its evidence is recorded' }
  })
}

/** Records how an EXTERNAL party fulfilled its part (an uploaded signed PDF, a wet-ink document, evidence VORA validated by hand, or a certified signature checked elsewhere). It never claims a cryptographic validation. */
export async function fulfilPartyAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const method = str(form, 'method', 40), note = str(form, 'note', 500)
    if (!EXTERNAL_METHODS.includes(method)) throw new ActionError('Choose how the party signed')
    if (note.length < 5) throw new ActionError('Write what evidence you saw (at least 5 characters)')
    const { update } = await import('@/server/data')
    const rows = await update('document_parties', { method, evidence_note: note, fulfilled_at: new Date(), fulfilled_by: user.id }, (q) => q.eq('id', int(form, 'party_id')).is('method', null))
    if (!rows.length) throw new ActionError('That party has already signed', 409)
    const { rpc } = await import('@/server/data')
    await rpc('trust_append_evidence', { p_kind: rows[0].kind as string, p_document: rows[0].documentId as number, p_type: 'party_fulfilled', p_actor: user.id, p_artifact: null, p_payload: { role: rows[0].role, method } })
    return { to: `/admin/documents/${rows[0].documentId}`, notice: 'Recorded. It is shown as evidence uploaded or validated by VORA, not as a signature made in VORA.' }
  })
}
