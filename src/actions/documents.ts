'use server'
import { documentType } from '@/content/document-types'
import { ActionError, adminRun, adminRunForm, type FormState } from '@/server/action'
import { createDocument, setDocumentStatus, updateDocument } from '@/server/documents/general'
import { int, rawStr, str } from '@/server/http'

const MAX_ID = 2_147_483_647
const invoiceIds = (form: FormData) => form.getAll('invoice_ids').map((v) => Number.parseInt(String(v), 10)).filter((n) => Number.isSafeInteger(n) && n > 0 && n <= MAX_ID)

/** Creates a draft, or saves one when the form carries `record`. What each field may hold is the document type's business, not this action's. */
export async function saveDocumentAction(_prev: FormState, form: FormData): Promise<FormState> {
  return adminRunForm(form, async ({ user }) => {
    const type = documentType(str(form, 'kind', 30))
    if (!type) throw new ActionError('Choose a document type')
    // One character more than the field allows is read, so that too much text is refused rather than quietly cut short.
    const values = Object.fromEntries(type.fields.map((f) => [f.name, rawStr(form, f.name, f.max + 1)]))
    const input = { kind: type.key, language: str(form, 'language', 2), customerId: int(form, 'customer_id') || null, documentDate: str(form, 'document_date', 10), values, invoiceIds: invoiceIds(form) }
    const record = int(form, 'record')
    if (record) {
      await updateDocument(user.id, record, input)
      return { to: `/admin/documents/${record}`, notice: 'Document saved' }
    }
    const id = await createDocument(user.id, input)
    return { to: `/admin/documents/${id}`, notice: 'Document draft created' }
  })
}

export async function documentStatusAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    await setDocumentStatus(user.id, id, str(form, 'action', 10))
    return { to: `/admin/documents/${id}`, notice: 'Document state updated' }
  })
}
