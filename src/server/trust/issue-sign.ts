import { documentType } from '../../content/document-types'
import { signingEligibility, trustPolicy } from '../../content/trust-policy'
import type { SessionUser } from '../auth/guard'
import { one, rpc } from '../data'
import { setDocumentStatus } from '../documents/general'
import { ActionError } from '../errors'
import { renderDocumentPdf } from '../pdf/documents'
import { requestSigning } from './signing'

/**
 * Issues a draft in one of two ways, chosen by the person issuing:
 *   company     it is issued with the company's own (universal) signature: Signature Type 1 in a letter's room for the signature, the company's closing block in an agreement;
 *   personal    it is issued for a personal signature: the issued file is archived and the chosen signer is asked to sign it (it then waits in their "Documents you can sign"; when the
 *               person issuing is that signer, they go straight to the signing page, since nobody else has to ask them).
 * The personal route is checked BEFORE the document is issued (the signer holds authority, a review is recorded where one is required), so that a refusal leaves the draft as it was.
 */
export async function issueWithSignature(user: SessionUser, id: number, o: { signature: string; signerProfileId: number; legalReviewNote: string; baseUrl: string }): Promise<{ to: string; notice: string }> {
  const doc = await one('documents', (q) => q.eq('id', id), 'id,kind,status')
  if (!doc) throw new ActionError('Document not found', 404)
  const type = documentType(doc.kind as string)
  if (!type) throw new ActionError('Unknown document type', 409)
  const here = `/admin/documents/${id}`
  if (o.signature !== 'personal') {
    await setDocumentStatus(user.id, id, 'issue', o.baseUrl, { signature: 'company' })
    return { to: here, notice: 'Document issued with the company signature' }
  }
  const policy = trustPolicy('document', type.key)
  if (type.family === 'seal' || !signingEligibility(policy).ok) throw new ActionError('This kind of document is not signed by a person: issue it with the company signature', 422)
  const profile = o.signerProfileId ? await one('signer_profiles', (q) => q.eq('id', o.signerProfileId), 'id,status,user_id,display_name') : undefined
  if (!profile || profile.status !== 'active') throw new ActionError('Choose who is to sign it', 422)
  if (!(await rpc<boolean>('trust_signer_authorized', { p_profile: profile.id, p_family: policy.family }))) throw new ActionError(`${profile.displayName} holds no authority to sign this kind of document`, 403)
  const eligible = signingEligibility(policy)
  if (eligible.ok && eligible.needsLegalReview && o.legalReviewNote.trim().length < 10) throw new ActionError('This kind of document needs a recorded legal review before it is signed: write who reviewed it and what was decided (at least 10 characters)', 422)
  await setDocumentStatus(user.id, id, 'issue', o.baseUrl, { signature: 'personal' })
  await renderDocumentPdf('document', id, o.baseUrl)                                    // archives the issued file: it is what the signer signs
  const made = await requestSigning(user, { kind: 'document', documentId: id, signerProfileId: profile.id as number, purpose: 'signed', legalReviewNote: o.legalReviewNote })
  if (profile.userId === user.id) return { to: `/admin/signing/${made.id}`, notice: 'Document issued. Place your mark and sign it.' }
  return { to: here, notice: `Document issued. ${profile.displayName} was asked to sign it (it waits in their Verification & Signing).` }
}
