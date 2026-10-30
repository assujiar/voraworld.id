'use server'
import { documentType } from '@/content/document-types'
import { ActionError, adminRun, adminRunForm, type FormState } from '@/server/action'
import { createDocument, setDocumentStatus, storeSourcePdf, updateDocument } from '@/server/documents/general'
import { publicBaseUrl } from '@/server/env'
import { rowsFromForm } from '@/server/form-rows'
import { int, rawStr, str } from '@/server/http'
import { removeObject } from '@/server/storage'

const MAX_ID = 2_147_483_647
const invoiceIds = (form: FormData) => form.getAll('invoice_ids').map((v) => Number.parseInt(String(v), 10)).filter((n) => Number.isSafeInteger(n) && n > 0 && n <= MAX_ID)

/** Creates a draft, or saves one when the form carries `record`. What each field may hold is the document type's business, not this action's. */
export async function saveDocumentAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const type = documentType(str(form, 'kind', 30))
    if (!type) throw new ActionError('Choose a document type')
    // One character more than the field allows is read, so that too much text is refused rather than quietly cut short.
    const values = Object.fromEntries(type.fields.map((f) => [f.name, rawStr(form, f.name, f.max + 1)]))
    const articles = type.family === 'agreement' ? rowsFromForm(form, 'item', { title: 120, body: 3000 }) : undefined
    const input = { kind: type.key, language: str(form, 'language', 2), customerId: int(form, 'customer_id') || null, documentDate: str(form, 'document_date', 10), values, invoiceIds: invoiceIds(form), articles }
    const record = int(form, 'record')
    // A PDF to seal is stored first; if the document cannot be saved afterwards, the file is removed again so that nothing is left behind.
    const upload = type.family === 'seal' ? form.get('source_pdf') : null
    const source = upload instanceof File && upload.size > 0 ? await storeSourcePdf(upload) : undefined
    try {
      if (record) {
        await updateDocument(user.id, record, { ...input, source })
        return { to: `/admin/documents/${record}`, notice: 'Document saved' }
      }
      const id = await createDocument(user.id, { ...input, source })
      return { to: `/admin/documents/${id}`, notice: 'Document draft created' }
    } catch (e) {
      if (source) await removeObject('documents', source.key).catch(() => undefined)
      throw e
    }
  })
}

export async function documentStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const action = str(form, 'action', 10)
    await setDocumentStatus(user.id, id, action, publicBaseUrl())
    return { to: `/admin/documents/${id}`, notice: 'Document state updated' }
  })
}
