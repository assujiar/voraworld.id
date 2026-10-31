import { documentType } from '../../content/document-types'
import { createDocument, setDocumentStatus, storeSourcePdf } from '../documents/general'
import { rpc } from '../data'
import { ActionError } from '../errors'
import type { SessionUser } from '../auth/guard'
import { renderDocumentPdf } from '../pdf/documents'
import { removeObject } from '../storage'
import { profileOfUser, signNow } from './signing'

export interface UploadToSign { file: File; title: string; issuer: string; reference: string; language: string; baseUrl: string }

/**
 * A signer signs a document that somebody else issued, without anybody asking them to. The PDF is checked and stored, the document is made and issued as the original file
 * (no company seal: the one mark on it will be the signer's), the issued file is archived, and the signing request is made for the signer, who is then taken to the ceremony to
 * place the mark and sign with their passkey. Everything the ceremony requires still holds: nothing is signed here. Returns the signing request's id.
 *
 * The person must be an active signer with a passkey and current authority for third-party documents, which is checked BEFORE the file is stored. If anything fails after the
 * document was made, it is voided again so that no half-made document is left to be mistaken for a finished one.
 */
export async function uploadAndSign(user: SessionUser, i: UploadToSign): Promise<number> {
  const profile = await profileOfUser(user.id)
  if (!profile || profile.status !== 'active') throw new ActionError('You are not a signer: an administrator sets up your signer profile and your authority on the Signers page', 403)
  if (!(await rpc<boolean>('trust_signer_authorized', { p_profile: profile.id, p_family: 'seal' }))) throw new ActionError('You hold no authority to sign third-party documents: another administrator grants it on the Signers page ("seal", or all)', 403)
  const type = documentType('seal')!
  const title = i.title.trim(), issuer = i.issuer.trim()
  if (title.length < 2 || issuer.length < 2) throw new ActionError('Write the title of the document and who issued it')
  const source = await storeSourcePdf(i.file)
  let id = 0
  try {
    const values: Record<string, string> = Object.fromEntries(type.fields.map((f) => [f.name, '']))
    Object.assign(values, {
      source_title: title, source_issuer: issuer, source_reference: i.reference.trim(), signatory_name: profile.displayName, signatory_title: profile.position, purpose: 'verified',
      pages: 'last', corner: 'bottom-right', size: 'medium', placement_confirmed: 'yes', mode: 'sign',
    })
    id = await createDocument(user.id, { kind: 'seal', language: i.language === 'en' ? 'en' : 'id', customerId: null, documentDate: '', values, invoiceIds: [], source })
    await setDocumentStatus(user.id, id, 'issue', i.baseUrl)
    await renderDocumentPdf('document', id, i.baseUrl)                                  // archives the issued file: it is what the signer signs
    return await signNow(user, { kind: 'document', documentId: id, purpose: 'signed' })
  } catch (e) {
    if (id) await setDocumentStatus(user.id, id, 'void').catch(() => undefined)
    else await removeObject('documents', source.key).catch(() => undefined)
    throw e
  }
}
